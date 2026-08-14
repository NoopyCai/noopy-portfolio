"use client";
import { useEffect, useRef, type RefObject } from "react";
import { clamp, smooth } from "@/lib/progress";
import type { DoorMode, DoorScene } from "./door3d/scene";

/** 每幀由 ScrollJourney 的 applyFrame 直呼。三個值必須同一次呼叫送進來(見下方註解)。 */
export type DoorApply = (progress: number, mode: DoorMode, active: boolean) => void;

// 車門開啟過場的 React 外殼 —— 薄到只剩三件事:一個 canvas、把 three 的場景
// 用 dynamic import() 拉進來、把 progress 餵給 render()。
//
// 為什麼是 dynamic import:three 即使 tree-shake 過也有 ~150KB gzip,而它只服務
// 這 1.5 秒的過場。拆成 async chunk 之後首頁的 First Load JS 一個位元組都不會增加,
// chunk 在 gate 相位(使用者還在看「開始乘車」)就用 idle callback 悄悄預載完。
//
// 為什麼元件永不卸載、cleanup 也不 dispose:見 CLAUDE.md 坑 10。一個 <canvas> 一輩子
// 只有一個 WebGL context,被 loseContext()/dispose() 殺掉就再也活不過來 —— 舊版
// 「離開門相位就卸載」實測會在上下捲一趟之後整頁白屏。現在只用 CSS display:none 收起來。
//
// 一個元件、一個 canvas、一個 context 服務兩段門(mode):進站的開門推軌、出站的關門。
// 兩段共用同一份幾何(不新增任何 mesh),所以 exit 的三角形數 = enter 的同一組。
//
// 階段 0(audit §4.3):progress / mode / active **不再是 prop**。它們每幀都在變,
// 走 prop 就是每幀一次 re-render;更糟的是三個值會被 React 拆成不同時機生效 ——
// exit 起點的 exitDoorP 是 0(門全開),用 enter 的分鏡去解讀 0 卻是「門全關」,
// 只要 mode 晚一幀,交界就會閃一扇滿版關著的門。改成一次 apply() 三個值一起進來。
export function Door3D({ register }: { register: RefObject<DoorApply | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DoorScene | null>(null);
  const bootRef = useRef<(() => void) | null>(null);
  // resize 回呼與 boot 完成時要重畫「最後一次」的那一幀,所以最新值留在 ref 裡
  const lastP = useRef(0);
  const lastMode = useRef<DoorMode>("enter");

  useEffect(() => {
    let cancelled = false;
    const boot = () => {
      import("./door3d/scene")
        .then(({ createDoorScene }) => {
          const canvas = canvasRef.current;
          // sceneRef 已有值 = StrictMode 的第二次 mount,場景要沿用同一個 context
          if (cancelled || !canvas || sceneRef.current) return;
          const s = createDoorScene(canvas, () => sceneRef.current?.render(lastP.current, lastMode.current));
          if (!s) return; // 沒有 WebGL:canvas 保持透明,門相位直接看到底下的車廂
          sceneRef.current = s;
          s.render(lastP.current, lastMode.current);
          // 開發用的量測窗口(三角形數、draw call、context 是否還活著)。
          // 生產不掛:window 上多一個全域物件對觀眾沒有價值。
          if (process.env.NODE_ENV !== "production") {
            (window as typeof window & { __door3d?: DoorScene }).__door3d = s;
          }
        })
        .catch(() => {
          // chunk 載入失敗(離線、CDN 掛掉):同樣讓 canvas 保持透明,過場退化成直接切換
        });
    };
    // 預載排在 idle:別和 cabin.jpg / 字型搶第一屏的頻寬。timeout 是保險,
    // 使用者如果馬上就按「開始乘車」,1.2 秒內一定會排到。
    const ric = (window as typeof window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = ric ? ric(boot, { timeout: 1200 }) : window.setTimeout(boot, 400);
    bootRef.current = boot; // 使用者可能比 idle callback 還快(見 apply)
    return () => {
      cancelled = true;
      bootRef.current = null;
      if (!ric) window.clearTimeout(id);
    };
  }, []);

  // 每幀的入口。不自己開 rAF —— 與 scrub 天然同步,倒著捲門就倒著關。
  useEffect(() => {
    const apply: DoorApply = (progress, mode, active) => {
      lastP.current = progress;
      lastMode.current = mode;
      // 門已經開始開、場景卻還沒進來 = 使用者比 idle callback 快(冷載入時馬上按「開始乘車」)。
      // 這裡補叫一次 boot 就好(叫完就清掉 ref):沒有 WebGL 的機器每一幀都叫會白白產生 promise,
      // 而排在 idle 的那次仍然會照跑,等於還有第二次機會。
      // 出站的門是從 progress = 0 開始的(門全開),所以不能只看 progress > 0 —— 用 active
      // 一起判斷,否則有人直接捲到最後時場景還沒 boot,出站門會整段消失。
      if ((progress > 0 || active) && !sceneRef.current && bootRef.current) {
        const boot = bootRef.current;
        bootRef.current = null;
        boot();
      }
      const canvas = canvasRef.current;
      if (canvas) {
        // 門的區間外只收成 display:none(坑 10:元件本身永不卸載)
        const cls = active ? "door-canvas" : "door-canvas door-canvas-idle";
        if (canvas.className !== cls) canvas.className = cls;
        // 交棒用淡出而不是硬切:
        //   enter — 場景畫的是 cabin.jpg 原圖(車窗全黑、LED 是照片裡烤死的字),DOM 車廂則有
        //           即時窗景與跑馬燈。最後 15% 讓 canvas 透出下層,「上車後設備通電」就變成
        //           漸亮而不是啪一聲全亮。這段相機已停在末幀機位,畫面靜止,溶接才不會抖。
        //   exit  — 反過來:0.18→0.48(e 0.68→0.78)淡入,刻意排在 .camera 收乾之後才起步
        //           (兩個不同的空間 50/50 疊起來是雙重曝光,見 ScrollJourney 的註解),
        //           之後一路留在畫面上讓門關完,最後由 Concourse hero(不透明)蓋上去。
        const fade = mode === "exit" ? smooth(clamp((progress - 0.18) / 0.3)) : 1 - clamp((progress - 0.85) / 0.15);
        canvas.style.opacity = String(fade);
      }
      // className 先寫再 render:從 display:none 回到可見的那一幀要補畫一次
      // (隱藏期間 canvas.clientWidth = 0,render 會直接 return)。
      sceneRef.current?.render(progress, mode);
    };
    register.current = apply;
    return () => {
      if (register.current === apply) register.current = null;
    };
  }, [register]);

  // 初始屬性 = p 0 的狀態(門關著、canvas 可見、不透明):開頁一定從 progress 0 起算
  // (scrollRestoration = manual + scrollTo(0,0)),所以第一次 paint 就是對的。
  return <canvas ref={canvasRef} className="door-canvas" style={{ opacity: 1 }} aria-hidden />;
}

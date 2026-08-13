"use client";
import { useEffect, useRef } from "react";
import { clamp } from "@/lib/progress";
import type { DoorScene } from "./door3d/scene";

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
export function Door3D({ progress, active }: { progress: number; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DoorScene | null>(null);
  const bootRef = useRef<(() => void) | null>(null);
  const lastP = useRef(progress);
  lastP.current = progress;

  useEffect(() => {
    let cancelled = false;
    const boot = () => {
      import("./door3d/scene")
        .then(({ createDoorScene }) => {
          const canvas = canvasRef.current;
          // sceneRef 已有值 = StrictMode 的第二次 mount,場景要沿用同一個 context
          if (cancelled || !canvas || sceneRef.current) return;
          const s = createDoorScene(canvas, () => sceneRef.current?.render(lastP.current));
          if (!s) return; // 沒有 WebGL:canvas 保持透明,門相位直接看到底下的車廂
          sceneRef.current = s;
          s.render(lastP.current);
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
    bootRef.current = boot; // 使用者可能比 idle callback 還快(見下方 effect)
    return () => {
      cancelled = true;
      bootRef.current = null;
      if (!ric) window.clearTimeout(id);
    };
  }, []);

  // progress 是 prop:ScrollTrigger 每次 onUpdate 重畫一幀,不需要自己的 rAF —— 與 scrub
  // 天然同步,倒著捲門就倒著關。active 也進依賴:從 display:none 回到可見的那一幀要補畫
  // 一次(隱藏期間 canvas.clientWidth = 0,render 會直接 return)。
  useEffect(() => {
    // 門已經開始開、場景卻還沒進來 = 使用者比 idle callback 快(冷載入時馬上按「開始乘車」)。
    // 這裡補叫一次 boot 就好(叫完就清掉 ref):沒有 WebGL 的機器每一幀都叫會白白產生 promise,
    // 而排在 idle 的那次仍然會照跑,等於還有第二次機會。
    if (progress > 0 && !sceneRef.current && bootRef.current) {
      const boot = bootRef.current;
      bootRef.current = null;
      boot();
    }
    sceneRef.current?.render(progress);
  }, [progress, active]);

  // 交棒用淡出而不是硬切:場景畫的是 cabin.jpg 原圖(車窗全黑、LED 是照片裡烤死的字),
  // DOM 車廂則有即時窗景與跑馬燈。最後 15% 讓 canvas 透出下層,「上車後設備通電」
  // 就變成漸亮而不是啪一聲全亮。這段相機已經停在末幀機位,畫面是靜止的,溶接才不會抖。
  const fade = 1 - clamp((progress - 0.85) / 0.15);

  return (
    <canvas
      ref={canvasRef}
      className={active ? "door-canvas" : "door-canvas door-canvas-idle"}
      style={{ opacity: fade }}
      aria-hidden
    />
  );
}

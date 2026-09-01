"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STATIONS } from "@/content/stations";
import { phaseOf, doorProgress, rideProgress, exitProgress, tunnelProgress, lerpGrade, clamp, smooth, stationEase, PHASE, TUNNEL } from "@/lib/progress";
// pin 長度與平滑捲動放在 lib/scroll.ts:時刻表(Concourse)跳站要用同一組數字,
// 兩邊都只 import 這個葉子模組,誰也不用 import 對方。
import { TOTAL_LEN, smoothScrollTo, gateRideEase, GATE_RIDE_MS, GATE_RIDE_P } from "@/lib/scroll";
import { createFrameBus, useIsoLayoutEffect, type TunnelFx } from "@/lib/frame";
import { CabinComposite } from "./CabinComposite";
import { CabinFrame } from "./CabinFrame";
import { Door3D, type DoorApply, type DoorFrame } from "./Door3D";
import { StationPanel } from "./StationPanel";
import { RouteMap } from "./RouteMap";
import { startSoundtrack } from "./SoundToggle";
import { useLang } from "./LangProvider";

gsap.registerPlugin(ScrollTrigger);

// 開頁歸零只做一次(module scope,不是 ref)。dev 的 StrictMode 會把 effect 跑兩次、
// HMR 會再跑一次 —— 那時使用者可能已經在車廂裡,scrollTo(0,0) 會把人硬拉回月台,
// 途中 pin 重算 + 相位跳變就是「往上滑白屏」的來源之一。
let didInitialReset = false;

// L1 立柱前景層相對於 sway(1.035)的縮放:1.035 × 1.0241546 = 1.06,也就是前景在螢幕上的
// 過掃描倍率。**這個數字有三處必須同步**:globals.css 的 .cabin-front(第一幀的預設值)、
// door3d/cabin.ts 的 FRONT_REL(場景版的立柱平面),以及這裡。
// L2a 之後這裡只服務**降級路徑**(沒有 WebGL 的 DOM 車廂):場景版的立柱是場景裡的一個
// 平面,滑鼠視差整片走 canvas 的 CSS transform,沒有獨立係數(見下方 tick 的註解)。
const FRONT_SCALE_REL = 1.0241546;

// 站切換 crossfade 的半寬(eased x 單位)。DOM 版是「換站 → 掛新層 → CSS transition .6s」,
// 計時器驅動;L2a 改由 x 驅動,所以倒著捲就是倒著溶,而且完全不需要 re-render。
//
// 代價:x 驅動沒有時間軸,**停在正中間就會停在 50/50 的疊影上**(計時器版停久了會自己
// 收斂到新的一站)。所以窗口要窄:0.07 換算成捲動約 93px(巡航段 dx/dscroll 最快的一段),
// 兩三格滾輪就過完,而且 scrub 0.5 還會再平滑一次;真的停在那裡的機率被壓到最低。
// [0.43, 0.57] 也完全落在停站窗口(dist < 0.15)之外 —— 卡片在讀的時候窗景不會在溶。
const XFADE = 0.07;

// L2b:exit 的 DOM 疊層(跑馬燈 + 玻璃反光)淡出的窗口。
// 它們是**釘在螢幕上**的,而場景相機從 e ≈ 0.06 起就開始升高 —— 牆一動,貼在牆上的
// 跑馬燈就會漂移。所以在相機真正走遠之前先收掉。0.16 這個長度是算出來的:起身有
// PITCH_COMP = 0.85 的俯角補償,牆在 e = 0.16 時只滑了約 2px(見 door3d/scene.ts),
// 淡出走完之前的錯位都在一個像素等級。語意上就是「到站,車內顯示器熄了」。
const EXIT_DOM_FADE = 0.16;

// 離散狀態:**只有這四個值變化才會 re-render**(audit §4.3 的整個重點)。
// 連續量(x / grade / doorP / camera transform / 隧道與月台插值)全部走 applyFrame 直寫 DOM。
type Discrete = {
  phase: "gate" | "ride" | "exit";
  /** 目前站(驅動資訊卡內容、LED 文字、窗景 crossfade、路線圖亮點) */
  index: number;
  /** 資訊卡淡入門檻(dist < 0.34) */
  panelVisible: boolean;
  /** 路線圖:門開完才出現 */
  routeVisible: boolean;
};

export function ScrollJourney() {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sway = useRef<HTMLDivElement>(null);
  const canvasWrap = useRef<HTMLDivElement>(null); // L2a:canvas 的外殼(自帶 3.5% 過掃描,不吃 sway 的 scale)
  const frame3d = useRef<HTMLDivElement>(null); // L2a:疊在 canvas 車廂上的 DOM 層(LED + 玻璃)
  const front = useRef<HTMLDivElement>(null); // L1:立柱前景層的容器(img + 它自己的 tint),sway 迴圈直接寫它的 transform
  const camera = useRef<HTMLDivElement>(null); // A6:玻璃視差的 CSS 變數掛在這層,往下傳給每扇窗
  const gateBtn = useRef<HTMLButtonElement>(null);
  // 出站大廳(exit 尾段的簾幕)。它不是 ScrollJourney 的子節點 —— 是 page.tsx 的兄弟,
  // 上拉一個視口疊在 stage 上(.concourse-overlap)。整頁只有一個,而 applyFrame 本來就
  // 是一路直寫 DOM 的通道,為了一個 style 字串把 ref 從 page.tsx 對穿兩層 props 不划算,
  // 所以第一次用到時就地 querySelector 一次記起來(class 名與 CSS 同一個來源)。
  const concourse = useRef<HTMLElement | null>(null);
  const doorApply = useRef<DoorApply | null>(null); // Door3D 註冊進來的 imperative 入口
  const phaseRef = useRef<"gate" | "ride" | "exit">("gate");
  const doorRef = useRef(0); // 給 sway 迴圈:門開完才開始跟滑鼠,交棒瞬間位移趨近 0
  const distRef = useRef(1); // 給 sway 迴圈:eased 的到站距離,底噪靠它在停站時收斂到 0
  const pRef = useRef(0); // 最後一次的 scroll progress(離散變化後要用它重跑一次 applyFrame)
  // L2b:這裡原本有一個 narrow(max-width 640)的 state,專門給 exit 的 CSS 假 3D 換一套
  // 2.5D 變體。整段 exit 進場景之後那個分支沒有意義了 —— 場景相機的運鏡本來就依
  // camera.aspect 連續調整(出站構圖的 fill、視差振幅),不需要斷點。

  // WebGL 能不能用(**用能力判斷,不用 UA/寬度**)。pending 期間先掛 DOM 車廂:
  // 場景是在 idle callback 才 boot 的,而 gate 相位本來就閒著 —— 這樣任何時刻畫面上
  // 都有一個車廂,不會有「兩邊都還沒好」的黑幀。ok 之後 DOM 那一套整個卸載。
  const [gl, setGl] = useState<"pending" | "ok" | "fail">("pending");
  const ride3dRef = useRef(false);
  ride3dRef.current = gl === "ok";
  const onGlStatus = useCallback((ok: boolean) => setGl(ok ? "ok" : "fail"), []);

  // 連續量的通道。frame 是就地改寫的單一物件,emit() 同步叫所有訂閱者(見 lib/frame.ts)。
  const busRef = useRef<ReturnType<typeof createFrameBus> | null>(null);
  if (!busRef.current) busRef.current = createFrameBus(STATIONS[0].grade, STATIONS[0].scene);
  const bus = busRef.current;
  // 送進 Door3D 的那一包。**就地改寫**同一個物件:每幀 new 一個在 4× throttle 的手機上
  // 就是白給 GC 的壓力(和 frame bus 同一個理由)。
  const doorFrame = useRef<DoorFrame>({ progress: 0, mode: "enter", active: true, fade: 1, frame: bus.frame });

  const [d, setD] = useState<Discrete>({ phase: "gate", index: 0, panelVisible: false, routeVisible: false });
  const dRef = useRef(d);

  // ─────────────────────────────────────────────────────────────────────────
  // applyFrame:每幀的**唯一**入口。ScrollTrigger 的 onUpdate 直接叫它,不經過 React。
  //
  //   progress p
  //     ├─ 連續 ─→ bus.frame { x, grade, platform, tunnel } ─→ emit()
  //     │            ├─ CabinComposite:img.filter / tint.background / 隧道三層
  //     │            └─ Window ×3 ─→ SceneLayer.blit / PlatformLayer.blit / 壓暗 / 暗帶
  //     ├─ 連續 ─→ gateBtn.style.opacity
  //     ├─ 連續 ─→ camera.style.{transform, opacity, willChange}
  //     ├─ 連續 ─→ doorApply(doorP, mode, active) ─→ Door3D 的 canvas + three 場景
  //     ├─ 連續 ─→ .concourse 的 opacity(出站大廳當簾幕蓋上來)
  //     ├─ 連續 ─→ phaseRef / doorRef / distRef(sway 的 rAF 迴圈每幀讀這三個)
  //     └─ 離散 ─→ setD({ phase, index, panelVisible, routeVisible })  ← 只在真的變了才叫
  //
  // 所有數學(相位、eased x、grade 插值、A5 隧道、B2 月台、exit 分鏡)都是從舊的 render
  // body **原樣搬過來**的,一個常數都沒動 —— 這裡只換執行通道,不換畫面。
  // ─────────────────────────────────────────────────────────────────────────
  const applyFrame = useCallback((p: number) => {
    pRef.current = p;
    const n = STATIONS.length;
    const phase = phaseOf(p);
    phaseRef.current = phase;
    const doorP = doorProgress(p);
    doorRef.current = doorP;
    const rp = rideProgress(p);
    // eased x 是唯一的列車座標:index / dist / pan / grade 全部吃它。
    // 留兩套(線性一套、eased 一套)會讓「卡片浮出來」和「車停下來」對不上,那正是要修的東西。
    const x = stationEase(rp * (n - 1));
    const index = Math.round(clamp(x, 0, n - 1));
    const dist = Math.abs(x - index);
    distRef.current = dist;
    const lo = STATIONS[Math.floor(x)];
    const hi = STATIONS[Math.min(Math.ceil(x), n - 1)];
    const grade = lerpGrade(lo.grade, hi.grade, x - Math.floor(x));

    // B2 月台進站:中央窗第二層的不透明度。dist 是 eased 的 → 減速曲線免費繼承,
    // 月台隨列車減速滑進來、停站期間(dist 恆 0)定格不動。
    // 第 0 站本來就是月台場景,再疊一層就是雙重月台。
    const platform = index === 0 ? 0 : smooth(clamp((0.12 - dist) / 0.12));

    // A5 隧道段(LIFF → AI 之間的巡航段中央)。u 是洞內進度,全部由 eased x 插值,
    // 沒有任何時間項 —— 倒著捲就是倒著出洞,而亮度變化的頻率由使用者的捲速決定
    // (最壞情況還有 scrub 0.5 幫忙平滑)。區間外整組收起來:巡航段零合成層。
    const u = tunnelProgress(x);
    const inTunnel = phase === "ride" && x > TUNNEL.from && x < TUNNEL.to;
    const enter = smooth(clamp(u / 0.15));         // 進洞 0–0.15
    const leave = smooth(clamp((u - 0.85) / 0.15)); // 出洞 0.85–1
    const tunnel: TunnelFx | null = inTunnel
      ? {
          dim: 0.94 * enter * (1 - leave),
          // 洞口那道垂直暗帶只在進洞時掃過中央窗;方向跟著 pan(窗景往左流,牆從右邊來)
          band: u < 0.16 ? 120 - 240 * enter : null,
          lift: 0.05 * enter * (1 - leave),
          // 光帶橫掃:一整段隧道剛好掃過一輪。刻意只有一輪 —— 這段換算成實際捲動只有
          // ~126px,一格滾輪就掃完,兩輪以上在快速捲動下會逼近 WCAG 2.3.1 的 3Hz 紅線。
          sweep: u * 50,
          // 出洞回光:0.85 起快速亮到 0.12 再退回 0(spec 寫「0.12→0」,但直接從 0.12 起跳
          // 會在 u=0.85 那一幀出現硬邊,所以前 5% 用來把它接上去)
          flash: 0.12 * smooth(clamp((u - 0.85) / 0.05)) * (1 - smooth(clamp((u - 0.9) / 0.1))),
        }
      : null;

    // L2a 站切換 crossfade:A = 正在離開的站、B = 正在進入的站,mix 由 x 插值。
    // 中點(frac = 0.5)正好是 index 翻面的地方,所以 LED / 資訊卡換字與窗景換景同步。
    const xc = clamp(x, 0, n - 1);
    const li = Math.min(Math.floor(xc), n - 1);
    const frac = xc - li;
    const f = bus.frame;
    f.x = x;
    f.grade = grade;
    f.platform = platform;
    f.tunnel = tunnel;
    f.sceneA = STATIONS[li].scene;
    f.sceneB = STATIONS[Math.min(li + 1, n - 1)].scene;
    f.mix = smooth(clamp((frac - (0.5 - XFADE)) / (2 * XFADE)));
    bus.emit();

    // gate 按鈕:進門前先淡出,不要硬切消失
    if (gateBtn.current) gateBtn.current.style.opacity = String(1 - smooth(clamp((p - 0.09) / 0.04)));

    // 到站的相機動畫:e 0→1。
    // **L2b:整段 exit 已經搬進場景**(door3d/scene.ts 的 EXIT 分鏡表)—— 起身、半拍、
    // 轉身、退出門外、門關,全部由場景那一台 PerspectiveCamera 演,一鏡到底。
    // 這裡原本那一組 `.camera` 的 rotateY/translateX/scale(CSS 假 3D)整組刪掉了:
    // 它是把一整片已經合成好的畫面當紙板轉,轉到 85° 就是一張紙 —— 而場景相機轉的時候
    // 立柱層(z=-6.5)與牆(z=-8)會真的錯開。
    const e = phase === "exit" ? exitProgress(p) : 0;
    const ride3d = ride3dRef.current;

    // 出站的門與相機都在同一顆鏡頭裡,所以 progress 直接送 e(場景自己算門的開合)。
    // progress / mode / active 必須**同一幀一起**送進去:拆成 prop 讓 React 追,mode 會
    // 晚一幀 —— 而 exit 起點的門是全開的,用 enter 的分鏡去解讀 0 就是「門全關」,
    // 交界那一幀會閃一扇滿版關著的門。
    const exitScene = ride3d && phase === "exit";
    const df = doorFrame.current;
    df.progress = exitScene ? e : doorP;
    df.mode = exitScene ? "exit" : "enter";
    // 3D 模式下 canvas 就是車廂,全程都要在;降級模式只有進站門的區間需要它
    // (降級沒有場景可以轉身,exit 不再有門 —— 見下面的 fallback 分鏡)。
    df.active = ride3d || p < PHASE.doorEnd + 0.02;
    // 3D:門開完就不再淡出,exit 也不淡 —— 唯一保留的交棒是最後出站大廳蓋上來,
    //     而它自帶不透明底色(.concourse 的 background),沒有對位問題。
    // 降級:enter 最後 15% 淡出交給 DOM 車廂(「上車後設備通電」)。
    df.fade = ride3d ? 1 : 1 - clamp((doorP - 0.85) / 0.15);
    doorApply.current?.(df);

    const cam = camera.current;
    if (cam) {
      // 3D:`.camera` 這一層全程不動(場景相機才是相機)。
      // 降級(無 WebGL):沒有場景可以轉身,退回**最單純的一組** —— 起身(上移 + 微推)
      // 然後整層淡出,黑幕之後 hero 亮起來。刻意不留 rotateY:那正是這次要刪掉的假 3D,
      // 而且降級路徑的車廂是一張 DOM 照片,轉起來只會更像紙板。
      const fbRise = smooth(clamp(e / 0.40));
      const fbFade = phase === "exit" ? 1 - smooth(clamp((e - 0.48) / 0.32)) : 1;
      cam.style.transform = ride3d ? "none" : `translateY(${(fbRise * 9).toFixed(2)}vh) scale(${(1 + fbRise * 0.16).toFixed(3)})`;
      cam.style.opacity = ride3d ? "1" : String(fbFade);
      // 看不見了就別再留合成層(§4.4 的 will-change 收斂)
      cam.style.willChange = !ride3d && phase === "exit" && fbFade > 0 ? "transform, opacity" : "auto";
      // L2a 留下的 sway 收合已經沒有用途了(門不再另外接手),永遠是 1
      if (sway.current) sway.current.style.opacity = "1";
    }

    // 疊在 canvas 車廂上的 DOM 層(跑馬燈 + 玻璃反光)。
    // 淡入:doorP 0.85 是推軌停下的那一點,從這裡開始場景是靜止的、cover 幾何與 DOM 完全
    //   一致,所以這段純粹是「設備通電」,不是在對位。
    // 淡出:exit 一開始就收(見 EXIT_DOM_FADE)—— 它釘在螢幕上,相機一動就會跟牆脫節。
    if (frame3d.current) {
      const domFade = phase === "exit" ? 1 - smooth(clamp(e / EXIT_DOM_FADE)) : 1;
      frame3d.current.style.opacity = String(smooth(clamp((doorP - 0.85) / 0.15)) * domFade);
    }

    // 出站大廳隨門閉合淡入(曲線與舊的 .concourse-intro 疊層逐位相同)。
    // 它與 stage 的最後一屏完全重疊,所以 e = 1 那一幀螢幕上就是真的大廳 ——
    // pin 解除時沒有東西換手,繼續捲就是繼續讀時刻表。
    // pointer-events:淡入途中它是半透明地蓋在 stage 上,滑鼠事件不該被它吃掉
    // (完全不透明之後才交還)。CSS 不寫初值,JS 沒跑時大廳照樣可以點。
    // 門檻是 0.99 不是 1:e = 1 時 (1 - 0.80) / 0.20 在浮點下是 0.9999999999999998,
    // 拿 `< 1` 當條件會讓旅程走到底的大廳**永遠不可點**(連結、跳站都失效)。
    // 選擇器是 **.concourse-overlap** 而不是 .concourse:只有「當簾幕用」的那一份該被
    // 這裡驅動。reduced-motion 的大廳沒有這個 class,不會被寫成 opacity 0。
    const conc = (concourse.current ??= document.querySelector<HTMLElement>(".concourse-overlap"));
    if (conc) {
      const op = smooth(clamp((e - 0.80) / 0.20));
      // 淡入期間把它**釘在視口頂端**:大廳是一般流元素,不釘的話這 320px 捲動裡站名牌
      // 會一邊淡入一邊往上滑 320px —— 舊疊層是釘在 pin 住的 stage 裡,原本的感受是
      // 「原地亮起來」。反向位移 = 版面位置(doc 上 TOTAL_LEN 處)到目前捲動的差,
      // 所以 p = 1 時它剛好是 0:pin 解除那一刻 transform 歸零、大廳無縫接回一般流,
      // 不需要任何交棒。exit 之外不套(那時 op = 0,位移多大都看不見)。
      conc.style.opacity = String(op);
      conc.style.transform = e > 0 ? `translateY(${(-TOTAL_LEN * (1 - p)).toFixed(2)}px)` : "";
      conc.style.pointerEvents = op > 0.99 ? "" : "none";
    }

    // ── 這裡以下才是 React ──
    const panelVisible = phase === "ride" && doorP >= 1 && dist < 0.34;
    const routeVisible = phase === "ride" && doorP >= 1;
    const prev = dRef.current;
    if (prev.phase !== phase || prev.index !== index || prev.panelVisible !== panelVisible || prev.routeVisible !== routeVisible) {
      const next: Discrete = { phase, index, panelVisible, routeVisible };
      dRef.current = next;
      setD(next);
    }
  }, [bus]);

  // 離散更新剛 commit 完 → 新掛上來的節點(gate 按鈕、.camera)還沒有任何連續量。
  // 在 paint 之前補跑一次 applyFrame,它們就不會有「先畫一張預設值再修正」的那一幀。
  // (bus 的訂閱者自己在 useFrame 裡就會立即套用,這裡補的是 ScrollJourney 自己持有的 ref。)
  useIsoLayoutEffect(() => {
    applyFrame(pRef.current);
  }, [d, gl, applyFrame]);

  useEffect(() => {
    if (!wrap.current || !stage.current) return;
    // pin 建立前文件只有 ~1916px(stage + 出站大廳),之後才被撐到 ~9516px。
    // 瀏覽器預設的 scrollRestoration 會在那之前就還原位置 → 被 clamp 進出站大廳,
    // 於是重整時第一屏是大廳的站名牌(CONCOURSE / NoopyCai)而不是月台。直接關掉還原。
    //
    // ⚠️ **必須走 ScrollTrigger.clearScrollMemory,不能只寫 history.scrollRestoration**:
    // ScrollTrigger 在 module 初始化時就把當下的值快照成 `_scrollRestoration`
    // (ScrollTrigger.js:2018,發生在 registerPlugin 那一刻,比這個 effect 早),
    // 之後**每次 refresh 都會把快照寫回去**(_clearScrollMemory,同檔 452 行)。
    // refresh 至少會在 ScrollTrigger 建立後與 window "load" 各跑一次 —— 也就是說
    // 我們寫進去的 "manual" 會在幾百毫秒內被 gsap 改回 "auto",這個防護等於沒有。
    // clearScrollMemory 同時更新 gsap 的快照與 history,refresh 之後才留得住。
    const prevRestore = history.scrollRestoration;
    ScrollTrigger.clearScrollMemory("manual");
    if (!didInitialReset) {
      didInitialReset = true;
      window.scrollTo(0, 0);
    }

    const st = ScrollTrigger.create({
      trigger: wrap.current,
      start: "top top",
      end: `+=${TOTAL_LEN}`,
      pin: stage.current,
      pinSpacing: true,
      scrub: 0.5,
      // 每幀的唯一出口。舊寫法是 setP(self.progress) —— 一幀一次 state 更新、整棵樹重算,
      // 而真正會變的只有幾個 style 字串跟一次 canvas blit(audit §4.3)。
      onUpdate: (self) => applyFrame(self.progress),
    });
    applyFrame(st.progress); // pin 建好的當下先對一次,不要等第一次捲動
    return () => {
      st.kill();
      ScrollTrigger.clearScrollMemory(prevRestore);
      // 大廳不是這個元件的子節點,卸載不會帶走 applyFrame 寫在它身上的 inline style。
      // reduced-motion 是「先掛 ScrollJourney、effect 跑完才翻旗標」——不還原的話那三個
      // 值就永遠停在旅程還沒開始的狀態(opacity 0),整頁文字對 reduced-motion 使用者
      // 直接消失。StrictMode/HMR 的 cleanup→re-run 也走這裡,還原完下一輪自然會再寫。
      const c = concourse.current;
      if (c) { c.style.opacity = ""; c.style.transform = ""; c.style.pointerEvents = ""; }
      concourse.current = null;
    };
  }, [applyFrame]);

  // 滑鼠視差晃動(只在 ride 生效;gate/exit 平滑收斂回 0,不與相機動畫打架)
  // + A1 行進底噪:疊在同一個 rAF 裡(每幀多四個 sin),不開第二條迴圈 —— 手機的每幀預算
  //   是這頁最緊的資源,而且兩個迴圈各自寫同一個 transform 必然互相蓋掉。
  useEffect(() => {
    // reduced-motion 要能「中途切換」生效:掛 change,不是 mount 時查一次就算了。
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // 有沒有滑鼠用能力查詢判斷,不用寬度猜 —— iPad 外接滑鼠、觸控筆電都會被寬度誤判。
    const mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let reduced = mqReduce.matches;
    let fine = mqFine.matches;
    const onReduce = () => { reduced = mqReduce.matches; };
    const onFine = () => { fine = mqFine.matches; };
    mqReduce.addEventListener("change", onReduce);
    mqFine.addEventListener("change", onFine);
    // 分頁切走時 rAF 會被節流但不保證停;明確關掉,回來才不會接在「時間跳了好幾秒」的相位上抖一下。
    let visible = !document.hidden;
    const onVis = () => { visible = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    // ── L1 前景立柱層的視差係數 ────────────────────────────────────────────────
    // 近的東西動得多。「多多少」不是美感問題,是被過掃描餘裕鎖死的:
    //   餘裕(px) = (cover 邊長 × (scale − 1)) ÷ 2
    //   需求(px) = K × 該軸的最大位移;背景層的最大位移是 15 + 2.0 = 17(橫)
    //              與 12 + 1.5 = 13.5(縱)—— 滑鼠 ±15/±12 加上 A1 底噪的 2.0/1.5。
    // 用 1440×900(cover 1599×900)算給規格的 K = 1.7:
    //   · 沿用 sway 的 1.035 → 垂直餘裕只有 900×0.035÷2 = 15.75px,而需求是 1.7×13.5 =
    //     22.95px,**差 7.2px** —— 立柱層的上下緣會被拉進畫面。這就是前景必須自帶
    //     過掃描的原因。
    //   · 自帶 scale 1.06 → 垂直餘裕 27.0px,剩 4.05px;水平餘裕 127.5px vs 28.9px。
    //   1920×958(cover 1920×1080.6)則是水平 57.6 vs 28.9、垂直 93.7 vs 22.95,寬鬆得多。
    // 螢幕上的實際倍率因此是 1.035(sway) × 1.0241546(.cabin-front) = 1.06。
    //
    // 直式手機把 K 降下來,兩個理由:
    //   · 幾何:直式的垂直是全站最緊的一軸(視窗高 = 圖高,餘裕全靠 scale)。
    //     390×844 → 1.06 的餘裕 25.3px;K=1.25 需 16.9px,剩 8.4px(1.7 只會剩 2.4px,
    //     再加上 sway 那層 ±1.1° 的 rotateX 在 perspective 下多吃的幾 px 就會露)。
    //   · 觀感:直式 cover 橫向裁掉三分之二(1499px 的圖只看得見 390px),同一段 px
    //     位移在小螢幕上讀起來幅度大得多 —— 而直式其實只看得到頂端橫杆(兩根立柱在
    //     x 20% / 79%,早就被裁到畫面外),把它甩得太厲害只會像畫面在抖。
    const FRONT_K_NARROW = 1.25, FRONT_K_WIDE = 1.7;
    let frontK = FRONT_K_WIDE;
    // ── 視差振幅隨視窗寬度縮小(L2a)────────────────────────────────────────────
    // 過掃描的餘裕是**百分比**(canvas 外殼 inset -2.5%、DOM 那層 scale 1.035),
    // 而位移是**固定 px** —— 視窗越窄餘裕越小:390 寬只有 9.75px,而滿幅位移要 17px
    // (滑鼠 15 + A1 底噪 2),實測滑鼠推到角落整條左緣會露出舞台底色(817 列)。
    // 而且同一段 px 位移在小螢幕上讀起來幅度大得多(L1 的立柱係數已經是這個理由)。
    // 1400px 以上滿幅,以下線性縮小:390 → 0.279(位移 4.2px + 底噪,餘裕 9.75px)。
    let amp = 1;
    const onResize = () => {
      const a = window.innerWidth / window.innerHeight;
      // 0.62(≈ 直式手機)→ 1.30(已經是橫式)之間插值,不寫死斷點:平板轉向不該跳一下
      frontK = FRONT_K_NARROW + (FRONT_K_WIDE - FRONT_K_NARROW) * clamp((a - 0.62) / (1.3 - 0.62));
      amp = Math.min(1, window.innerWidth / 1400);
    };
    onResize();
    window.addEventListener("resize", onResize);

    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let gate = 0; // 底噪的開關也要平滑:硬切 0↔1 會在進出 ride 的那一幀憑空跳掉 2px
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    let raf = 0;
    const tick = (now: number) => {
      const active = phaseRef.current === "ride" && doorRef.current >= 1 && visible && !reduced;
      const tgx = active ? target.x : 0, tgy = active ? target.y : 0;
      cur.x += (tgx - cur.x) * 0.06;
      cur.y += (tgy - cur.y) * 0.06;
      gate += ((active ? 1 : 0) - gate) * 0.06;
      // 到站收斂:eased dist 在停站窗口是 0 → calm=1 → 振幅歸零。
      // 這就是 B4「停穩」的觸覺證據 —— 車真的停了,不是只有卡片浮出來。
      const calm = smooth(clamp((0.15 - distRef.current) / 0.15));
      const amp = gate * (1 - calm);
      // 兩個不成比例的頻率疊在一起,週期長到讀不出規律 ——「讀不出在動,只讀得出不是靜止」。
      // 垂直上限 1.5px:sway 那層的過掃描餘裕只有 ~14.5px,滑鼠已經吃掉 12px。
      const t = now / 1000;
      const nx = ((Math.sin(t * 1.3) + 0.5 * Math.sin(t * 3.7)) / 1.5) * 2.0 * amp;
      const ny = ((Math.sin(t * 1.7) + 0.6 * Math.sin(t * 2.9)) / 1.6) * 1.5 * amp;
      const nr = Math.sin(t * 1.1) * 0.08 * amp;
      const tx = (-cur.x * 15 + nx) * amp, ty = (-cur.y * 12 + ny) * amp;
      const ry = cur.x * 1.4, rx = -cur.y * 1.1;
      const move = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotate(${nr.toFixed(3)}deg)`;
      const el = sway.current;
      if (el) el.style.transform = `${move} scale(1.035)`;
      // L2a 的 canvas 外殼:同樣的位移與旋轉,**但沒有 scale** —— 它自己的盒子就已經
      // 大了 3.5%(.cabin-canvas 的 inset: -1.75%),場景也是照那個尺寸畫的。
      // 讓合成器去縮放一張已經畫好的點陣圖會多一次重取樣,小字會軟掉(見 JSX 的註解)。
      // 兩層的縮放中心都是舞台中心,所以「內容放大 3.5% + 同一組位移」在螢幕上完全重合。
      const cw = canvasWrap.current;
      if (cw) cw.style.transform = move;
      // L1:立柱層多走的那一段。除以 1.035 是因為這個 transform 活在已經被 sway 縮放過的
      // 座標系裡 —— 螢幕上真正多走的就是 (K-1)×(tx, ty)。A1 底噪(nx/ny)包在 tx/ty 裡,
      // 所以它自動同係數放大,不必另外處理。
      // 寫 inline transform 而不是 CSS 變數(A6 的 --glass-x/y 是那樣寫的):自訂屬性會
      // 繼承,寫在 sway 上等於每幀讓整個車廂子樹重算樣式,而這裡只有一個元素在讀它。
      const fr = front.current;
      if (fr) {
        const k = (frontK - 1) / 1.035;
        fr.style.transform = `translate3d(${(k * tx).toFixed(2)}px, ${(k * ty).toFixed(2)}px, 0) scale(${FRONT_SCALE_REL})`;
      }
      // A6:玻璃比景多動 ±3.5px(近的東西動得多)。觸控裝置恆 0 —— 沒有游標就沒有視角,
      // 但靜態反光層留著,那是玻璃的實體感,不是互動。
      const cam = camera.current;
      if (cam) {
        const gx = fine ? -cur.x * 3.5 : 0, gy = fine ? -cur.y * 3.5 : 0;
        cam.style.setProperty("--glass-x", `${gx.toFixed(2)}px`);
        cam.style.setProperty("--glass-y", `${gy.toFixed(2)}px`);
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      mqReduce.removeEventListener("change", onReduce);
      mqFine.removeEventListener("change", onFine);
      cancelAnimationFrame(raf);
    };
  }, []);

  const { t } = useLang();
  const n = STATIONS.length;
  const cur = STATIONS[d.index];

  // 跳到第 i 站(路線圖點擊)。下限 doorEnd:跳站不要落在半開的車門裡。
  // 這裡**刻意不做 stationEase 的反函式**:線性目標 i/(n-1) 對應到 rp*(n-1) = i(整數),
  // 而 stationEase(整數) === 整數,所以落點正是停站窗口的正中間 —— 反函式反而會把人
  // 丟到窗口邊緣。B1 之後這段維持原樣是正確的,不是漏改。
  const jumpTo = (i: number) => {
    if (!wrap.current) return;
    const r = n > 1 ? i / (n - 1) : 0;
    const pTarget = clamp(PHASE.doorEnd + r * (PHASE.rideEnd - PHASE.doorEnd), PHASE.doorEnd + 0.005, PHASE.rideEnd - 0.01);
    smoothScrollTo(wrap.current.offsetTop + TOTAL_LEN * pTarget, 1200);
  };

  const showRide = d.phase === "ride" || d.phase === "exit";

  return (
    // minHeight = pin 之後 pin-spacer 會撐出來的高度(舞台 100vh + TOTAL_LEN),**先用 CSS 佔住**。
    // 沒有它的話,從 SSR 的 HTML 到 GSAP 建好 pin 之間(手機冷啟動可以是好幾秒、JS 掛掉就是
    // 永遠)整份文件只有 ~1.8 屏高,出站大廳就直接貼在第一屏底下 —— 只要捲動被還原或使用者
    // 手動捲一下,第一屏看到的就是大廳的站名牌。pin 建好之後 spacer 高度剛好等於這個值,
    // min-height 就不再作用(兩者都是 100vh + TOTAL_LEN),對既有版面零影響。
    <div ref={wrap} style={{ position: "relative", minHeight: `calc(100vh + ${TOTAL_LEN}px)` }}>
      <div
        ref={stage}
        className="stage"
        style={{ position: "relative", height: "100vh", width: "100%", overflow: "hidden", display: "grid", placeItems: "center", background: "var(--bg)", perspective: "1200px", perspectiveOrigin: "center" }}
      >
        {d.phase === "gate" && (
          <>
            {/* 月台等車的氛圍:頂棚燈微顫 + 對向列車每 ~10s 掠過一道亮帶。
                全部 CSS animation(compositor),離開 gate 相位節點整組消失 = 動畫停。
                月台本身不動 —— 你站著等車,動的是對面軌道的車。 */}
            <div className="gate-ambience" aria-hidden>
              <div className="gate-lamp" />
              <div className="gate-pass" />
            </div>
            <button
              ref={gateBtn}
              className="start"
              onClick={() => {
                startSoundtrack(); // 使用者手勢啟動,不是 autoplay
                const w = wrap.current!;
                // 捲過整段開門,停在第一站(月台)。時長與「多少時間分給門」都是 lib/scroll.ts
                // 的具名常數(GATE_RIDE_MS / GATE_SPLIT_T),要再調快慢改那裡就好。
                smoothScrollTo(w.offsetTop + TOTAL_LEN * GATE_RIDE_P, GATE_RIDE_MS, gateRideEase);
              }}
            >
              {/* 與 LED 跑馬燈同一套箭頭字元:同樣吃 --font-led 與綠色光暈(不用 icon 就是為了發光) */}
              {`${t({ zh: "開始乘車", en: "Start ride" })} ►`}
            </button>
          </>
        )}
        {/* .camera 從 gate 相位就掛著:車門過場的 canvas 現在住在它底下的 sway 層裡
            (見下面),而 canvas 一輩子只能有一個、永不卸載(坑 10)。gate 期間這一層
            是 identity + opacity 1,只有那個 canvas 在裡面,不影響按鈕(z-index 8)。

            **這一層必須是 flat(坑 16)**:它底下的 sway 帶著滑鼠視差的
            rotateX/rotateY,preserve-3d 一旦生效,那片傾斜的平面就會與 z = 0 的資訊卡
            /路線圖**在 3D 裡相交**,合成器沿交線把卡片切兩半、遠的那半畫到車廂照後面
            —— 螢幕上就是「卡片被斜切掉一角、而且切線跟著滑鼠跑」。 */}
        <div
          ref={camera}
          className="camera"
          style={{ position: "absolute", inset: 0, transformOrigin: "center 82%" }}
        >
          {/* 車門過場 +(WebGL 可用時)整個車廂:three.js 場景。
              progress 0 = 關門待機(門縫漏光),1 = 相機已經穿過門框停在車廂裡 ——
              **然後就停在那裡當 ride 的舞台**,不再淡出交棒(L2a)。
              **永遠掛載**,不需要時只用 CSS 收成 display:none —— 條件式掛載會讓 WebGL
              context 隨著上下捲反覆建/毀,實測會整片白屏(詳見 Door3D 的註解)。
              同一個 canvas 也服務出站的門(E1,mode="exit")。**絕不能為了兩段門開
              兩個 canvas** —— 那就是兩個 WebGL context,坑 10 的另一種寫法。
              每幀的值不是 prop:它們是同一幀的一包,由 applyFrame 一起送進 apply()。

              為什麼**不**放進 sway 層而是自己一個外殼:sway 那層常駐 scale(1.035),
              而 canvas 是已經光柵化的點陣圖 —— 合成器縮放它就是多一次重取樣,實測小字
              梯度能量掉 12.6%(坑 13 拒絕過的量級)。所以這個外殼自己大 3.5%
              (.cabin-canvas 的 inset: -1.75%),場景直接畫在那個尺寸上,sway 迴圈只寫
              位移與旋轉(沒有 scale)。兩層的中心與縮放因此完全一致,DOM 疊層對得上。 */}
          <div ref={canvasWrap} className="cabin-canvas">
            <Door3D register={doorApply} onStatus={onGlStatus} />
          </div>
          {/* 只有 DOM 車廂/疊層進 sway 層:那層常駐 scale(1.035) 過掃描(讓 ±15px 平移
              不露邊),而 will-change + preserve-3d 會讓整層先光柵化再 GPU 縮放 ——
              文字和像素字型會被重新取樣而發糊,照片放大 3.5% 看不出來(坑 3)。 */}
          <div
            ref={sway}
            style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", placeContent: "center", transformStyle: "preserve-3d", willChange: "transform" }}
          >
            {showRide && (gl === "ok"
              // WebGL 可用:車廂在場景裡,DOM 只剩「永遠不進 WebGL」的東西 ——
              // 跑馬燈(文字)與玻璃反光(A6 要跟著滑鼠,留在 CSS 才不用重畫)。
              ? <CabinFrame rootRef={frame3d} ledText={t(cur.led)} />
              // 降級路徑(Q3a 降規格凍結):精簡 DOM 車廂。無隧道、無月台層、無窗景深度層。
              : <CabinComposite bus={bus} scene={cur.scene} ledText={t(cur.led)} frontRef={front} />)}
          </div>
          {showRide && <StationPanel station={cur} visible={d.panelVisible} />}
          {showRide && d.routeVisible && <RouteMap index={d.index} onJump={jumpTo} />}
        </div>
      </div>
    </div>
  );
}

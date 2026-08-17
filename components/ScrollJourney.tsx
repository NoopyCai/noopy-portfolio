"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STATIONS } from "@/content/stations";
import { phaseOf, doorProgress, rideProgress, exitProgress, exitDoorProgress, tunnelProgress, lerpGrade, clamp, smooth, stationEase, PHASE, TUNNEL, EXIT_DOOR } from "@/lib/progress";
// pin 長度與平滑捲動搬到 lib/scroll.ts —— 時刻表(Concourse)要用同一組數字跳站,
// 而 ScrollJourney 已經 import 了 ConcourseHero,反向 import 會 circular。
import { TOTAL_LEN, smoothScrollTo } from "@/lib/scroll";
import { createFrameBus, useIsoLayoutEffect, type TunnelFx } from "@/lib/frame";
import { CabinComposite } from "./CabinComposite";
import { CabinFrame } from "./CabinFrame";
import { Door3D, type DoorApply, type DoorFrame } from "./Door3D";
import { StationPanel } from "./StationPanel";
import { RouteMap } from "./RouteMap";
import { ConcourseHero } from "./Concourse";
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

// L2a 的出站交棒:車廂與出站的門是**同一個 canvas**(坑 10:一個 canvas 一個 context),
// 不能像 DOM 版那樣「車廂淡出」與「門淡入」兩層並存。所以門要等車廂那一層完全收乾才接手,
// 而 e = 0.72 正是 camOpacity 歸零的那一點(EXIT_DOOR.start + 0.10)—— 交界兩側都是
// 不透明度 0,接得上。代價是門比 DOM 版晚 ~0.04(e)出現,分鏡順序不變。
const EXIT_HANDOFF = EXIT_DOOR.start + 0.10;
const EXIT_HANDOFF_DP = (EXIT_HANDOFF - EXIT_DOOR.start) / (EXIT_DOOR.end - EXIT_DOOR.start);

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
  const intro = useRef<HTMLDivElement>(null);
  const doorApply = useRef<DoorApply | null>(null); // Door3D 註冊進來的 imperative 入口
  const phaseRef = useRef<"gate" | "ride" | "exit">("gate");
  const doorRef = useRef(0); // 給 sway 迴圈:門開完才開始跟滑鼠,交棒瞬間位移趨近 0
  const distRef = useRef(1); // 給 sway 迴圈:eased 的到站距離,底噪靠它在停站時收斂到 0
  const narrowRef = useRef(false); // 給 applyFrame:相機 transform 的手機分支(離散,但每幀要讀)
  const pRef = useRef(0); // 最後一次的 scroll progress(離散變化後要用它重跑一次 applyFrame)
  const [narrow, setNarrow] = useState(false); // 手機:轉場退化為 2.5D
  narrowRef.current = narrow;

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

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

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
  //     ├─ 連續 ─→ intro.style.opacity(Concourse hero 交棒)
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

    // 到站相機動畫(第一人稱起身 + 轉身):e 0→1
    const e = phase === "exit" ? exitProgress(p) : 0;
    // 分成兩個讀得出來的動作:起身 → 半拍 → 轉身。
    // 舊值 rise 0–0.45 與 turn 0.35–1 有 0.1 的重疊,人還沒站直就開始轉,兩個動作糊成一個。
    // 「停穩」不在這裡寫 —— A1 的 calm 在終點站已經把底噪收乾淨了。
    const rise = smooth(clamp(e / 0.40)); // 起身:e 0→0.40
    // e 0.40–0.48 是刻意的半拍:什麼都不動,身體定住,轉身才有起點
    const turn = smooth(clamp((e - 0.48) / 0.52)); // 轉身:e 0.48→1
    const camTransform = narrowRef.current
      ? // 手機 2.5D:起身 + 橫向滑出(輕微轉),省去重 3D rotateY
        `translateY(${(rise * 7).toFixed(2)}vh) scale(${(1 + rise * 0.1).toFixed(3)}) translateX(${(turn * -72).toFixed(2)}vw) rotateY(${(turn * -22).toFixed(2)}deg)`
      : // 桌機真 3D:起身 + 轉身
        `translateY(${(rise * 9).toFixed(2)}vh) scale(${(1 + rise * 0.16).toFixed(3)}) ` +
        `rotateX(${(rise * 5).toFixed(2)}deg) rotateY(${(turn * -85).toFixed(2)}deg) translateX(${(turn * -14).toFixed(2)}vw)`;
    // E1 重排的交棒窗口:.camera 在 e 0.62–0.72 淡出,hero 等到門快關上才浮出來
    // (0.80–1.0)。三段刻意首尾相接而不重疊太多,讀起來就是「轉身 → 門在身後關上 →
    // 大廳亮起來」。兩層**錯開**而不是等比對溶:車廂內裝與月台側的門是兩個不同的空間,
    // 50/50 疊在一起是一張雙重曝光(實測截圖確認),讀起來像 bug 不像轉場。
    // L2a 之後車廂與門是**同一個 canvas**,所以「錯開」從美學選擇變成硬性條件 ——
    // 門要等 camOpacity 歸零(e = 0.72 = EXIT_HANDOFF)才接手,見下面的 df.fade。
    const camOpacity = 1 - smooth(clamp((e - EXIT_DOOR.start) / 0.10));

    // 出站的門(E1)。progress / mode / active 必須**同一幀一起**送進去:
    // 拆成 prop 讓 React 追,mode 會晚一幀 —— 而 exit 起點的 exitDoorP 是 0(門全開),
    // 用 enter 的分鏡去解讀 0 就是「門全關」,交界那一幀會閃一扇滿版關著的門。
    const ride3d = ride3dRef.current;
    const exitDoorP = exitDoorProgress(p);
    // 3D:車廂就在這個 canvas 裡,門必須等車廂收乾才接手(見 EXIT_HANDOFF)。
    // 降級:canvas 只畫門,車廂在 DOM,兩層可以並存 → 沿用原本的 0.62 起手。
    const doorExitOn = phase === "exit" && e >= (ride3d ? EXIT_HANDOFF : EXIT_DOOR.start - 0.02);
    const df = doorFrame.current;
    df.progress = doorExitOn ? exitDoorP : doorP;
    df.mode = doorExitOn ? "exit" : "enter";
    // 3D 模式下 canvas 就是車廂,全程都要在;降級模式只有門的區間需要它
    df.active = ride3d || p < PHASE.doorEnd + 0.02 || doorExitOn;
    df.fade = ride3d
      ? // 門開完不再淡出(交棒消失,這就是 L2a 的全部重點)。出站的門則從交棒點起淡入,
        // 起點 opacity 0 接上剛歸零的 camOpacity;0.2 的長度讓它在 hero(e 0.80)之前站滿。
        doorExitOn ? smooth(clamp((exitDoorP - EXIT_HANDOFF_DP) / 0.15)) : 1
      : // 降級路徑:維持舊分鏡 —— enter 最後 15% 淡出交給 DOM 車廂(「上車後設備通電」),
        // exit 0.18→0.48 淡入(刻意排在 .camera 收乾之後,兩個空間 50/50 疊起來是雙重曝光)。
        df.mode === "exit" ? smooth(clamp((exitDoorP - 0.18) / 0.3)) : 1 - clamp((doorP - 0.85) / 0.15);
    doorApply.current?.(df);

    // §4.4:這裡原本有每幀的 filter: blur() —— 全視窗高斯模糊是這頁最貴的一筆,
    // 手機上轉身兩端都在跑。空間感改由 rotateY/translateX/opacity + 出站的門承擔。
    const cam = camera.current;
    if (cam) {
      // 3D 的出站門接手之後,.camera 這一層只剩下那個 canvas —— 起身/轉身的 transform
      // 與淡出都已經走完(camOpacity = 0),必須歸位,不然門會跟著轉了 85° 的座標系跑。
      const handedOver = ride3d && doorExitOn;
      cam.style.transform = handedOver ? "none" : camTransform;
      cam.style.opacity = handedOver ? "1" : String(camOpacity);
      // camOpacity 歸零之後這層已經看不見了,willChange 再留著只是白白佔一個
      // 合成層(§4.4 的 will-change 收斂)
      cam.style.willChange = !handedOver && camOpacity > 0 ? "transform, opacity" : "auto";
      // .camera 一歸位,底下的 DOM 疊層(跑馬燈 + 玻璃)也會跟著「復活」——
      // 但那時人已經下車了,跑馬燈不該再出現在月台上的門裡。sway 那層自己收掉。
      // (資訊卡/路線圖在 exit 早就 visible=false / 卸載了,只剩這一層要處理。)
      if (sway.current) sway.current.style.opacity = handedOver ? "0" : "1";
    }

    // L2a:疊在 canvas 車廂上的 DOM 層(跑馬燈 + 玻璃反光)。0.85 是推軌停下的那一點
    // (dolly 在 doorP 0.85 收斂到 1),從這裡開始場景是靜止的、cover 幾何與 DOM 完全一致,
    // 所以這段淡入純粹是「設備通電」,不是在對位 —— 舊版整片 canvas 交棒的語意留下來了,
    // 但要對齊的東西從「一整張車廂」縮到「一行字」。
    if (frame3d.current) frame3d.current.style.opacity = String(smooth(clamp((doorP - 0.85) / 0.15)));

    // concourse hero 隨門閉合淡入
    if (intro.current) intro.current.style.opacity = String(smooth(clamp((e - 0.80) / 0.20)));

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

  // 離散更新剛 commit 完 → 新掛上來的節點(gate 按鈕、.camera、hero)還沒有任何連續量。
  // 在 paint 之前補跑一次 applyFrame,它們就不會有「先畫一張預設值再修正」的那一幀。
  // (bus 的訂閱者自己在 useFrame 裡就會立即套用,這裡補的是 ScrollJourney 自己持有的 ref。)
  useIsoLayoutEffect(() => {
    applyFrame(pRef.current);
  }, [d, narrow, gl, applyFrame]);

  useEffect(() => {
    if (!wrap.current || !stage.current) return;
    // pin 建立前文件只有 ~1916px(stage + 出站大廳),之後才被撐到 ~9516px。
    // 瀏覽器預設的 scrollRestoration 會在那之前就還原位置 → 被 clamp 到出站大廳頂端,
    // 於是重整時先閃一下最下方的區塊。這頁本來就從「開始乘車」開始,直接關掉還原。
    const prevRestore = history.scrollRestoration;
    history.scrollRestoration = "manual";
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
      history.scrollRestoration = prevRestore;
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
    <div ref={wrap} style={{ position: "relative" }}>
      <div
        ref={stage}
        className="stage"
        style={{ position: "relative", height: "100vh", width: "100%", overflow: "hidden", display: "grid", placeItems: "center", background: "var(--bg)", perspective: "1200px", perspectiveOrigin: "center" }}
      >
        {d.phase === "gate" && (
          <button
            ref={gateBtn}
            className="start"
            onClick={() => {
              startSoundtrack(); // 使用者手勢啟動,不是 autoplay
              const w = wrap.current!;
              smoothScrollTo(w.offsetTop + TOTAL_LEN * (PHASE.doorEnd + 0.005), 2200); // 捲過整段開門,停在第一站(月台)。1800 太趕,門還沒「開完」人就進去了
            }}
          >
            {/* 與 LED 跑馬燈同一套箭頭字元:同樣吃 --font-led 與綠色光暈(不用 icon 就是為了發光) */}
            {`${t({ zh: "開始乘車", en: "Start ride" })} ►`}
          </button>
        )}
        {/* .camera 從 gate 相位就掛著:車門過場的 canvas 現在住在它底下的 sway 層裡
            (見下面),而 canvas 一輩子只能有一個、永不卸載(坑 10)。gate 期間這一層
            是 identity + opacity 1,只有那個 canvas 在裡面,不影響按鈕(z-index 8)。 */}
        <div
          ref={camera}
          className="camera"
          style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transformOrigin: "center 82%" }}
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
        {d.phase === "exit" && (
          <div ref={intro} className="concourse-intro" style={{ pointerEvents: "none" }}>
            <div className="concourse-intro-inner"><ConcourseHero /></div>
          </div>
        )}
      </div>
    </div>
  );
}

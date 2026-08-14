"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STATIONS } from "@/content/stations";
import { phaseOf, doorProgress, rideProgress, exitProgress, exitDoorProgress, tunnelProgress, lerpGrade, clamp, smooth, stationEase, PHASE, TUNNEL, EXIT_DOOR } from "@/lib/progress";
// pin 長度與平滑捲動搬到 lib/scroll.ts —— 時刻表(Concourse)要用同一組數字跳站,
// 而 ScrollJourney 已經 import 了 ConcourseHero,反向 import 會 circular。
import { TOTAL_LEN, smoothScrollTo } from "@/lib/scroll";
import { CabinComposite, type TunnelFx } from "./CabinComposite";
import { Door3D } from "./Door3D";
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

export function ScrollJourney() {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sway = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLDivElement>(null); // A6:玻璃視差的 CSS 變數掛在這層,往下傳給每扇窗
  const phaseRef = useRef<"gate" | "ride" | "exit">("gate");
  const doorRef = useRef(0); // 給 sway 迴圈:門開完才開始跟滑鼠,交棒瞬間位移趨近 0
  const distRef = useRef(1); // 給 sway 迴圈:eased 的到站距離,底噪靠它在停站時收斂到 0
  const [p, setP] = useState(0);
  const [narrow, setNarrow] = useState(false); // 手機:轉場退化為 2.5D

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

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
      onUpdate: (self) => setP(self.progress),
    });
    return () => {
      st.kill();
      history.scrollRestoration = prevRestore;
    };
  }, []);

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
      const el = sway.current;
      if (el) {
        const tx = -cur.x * 15 + nx, ty = -cur.y * 12 + ny;
        const ry = cur.x * 1.4, rx = -cur.y * 1.1;
        el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotate(${nr.toFixed(3)}deg) scale(1.035)`;
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
      document.removeEventListener("visibilitychange", onVis);
      mqReduce.removeEventListener("change", onReduce);
      mqFine.removeEventListener("change", onFine);
      cancelAnimationFrame(raf);
    };
  }, []);

  const { t } = useLang();
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
  const cur = STATIONS[index];

  // B2 月台進站:中央窗第二層的不透明度。dist 是 eased 的 → 減速曲線免費繼承,
  // 月台隨列車減速滑進來、停站期間(dist 恆 0)定格不動。
  // 第 0 站本來就是月台場景,再疊一層就是雙重月台。
  const platform = index === 0 ? 0 : smooth(clamp((0.12 - dist) / 0.12));

  // A5 隧道段(LIFF → AI 之間的巡航段中央)。u 是洞內進度,全部由 eased x 插值,
  // 沒有任何時間項 —— 倒著捲就是倒著出洞,而亮度變化的頻率由使用者的捲速決定
  // (最壞情況還有 scrub 0.5 幫忙平滑)。區間外整組 DOM 不掛:巡航段零合成層。
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

  // 到站相機動畫(第一人稱起身 + 轉身):e 0→1
  const e = phase === "exit" ? exitProgress(p) : 0;
  // 分成兩個讀得出來的動作:起身 → 半拍 → 轉身。
  // 舊值 rise 0–0.45 與 turn 0.35–1 有 0.1 的重疊,人還沒站直就開始轉,兩個動作糊成一個。
  // 「停穩」不在這裡寫 —— A1 的 calm 在終點站已經把底噪收乾淨了。
  const rise = smooth(clamp(e / 0.40)); // 起身:e 0→0.40
  // e 0.40–0.48 是刻意的半拍:什麼都不動,身體定住,轉身才有起點
  const turn = smooth(clamp((e - 0.48) / 0.52)); // 轉身:e 0.48→1
  const camTransform = narrow
    ? // 手機 2.5D:起身 + 橫向滑出(輕微轉),省去重 3D rotateY
      `translateY(${(rise * 7).toFixed(2)}vh) scale(${(1 + rise * 0.1).toFixed(3)}) translateX(${(turn * -72).toFixed(2)}vw) rotateY(${(turn * -22).toFixed(2)}deg)`
    : // 桌機真 3D:起身 + 轉身
      `translateY(${(rise * 9).toFixed(2)}vh) scale(${(1 + rise * 0.16).toFixed(3)}) ` +
      `rotateX(${(rise * 5).toFixed(2)}deg) rotateY(${(turn * -85).toFixed(2)}deg) translateX(${(turn * -14).toFixed(2)}vw)`;
  // E1 重排的交棒窗口:.camera 在 e 0.62–0.75 淡出(正好是出站門淡入的那段),
  // hero 則等到門快關上才浮出來(0.80–1.0)。三段刻意首尾相接而不重疊太多,
  // 讀起來就是「轉身 → 門在身後關上 → 大廳亮起來」。
  // 兩層**錯開**而不是等比對溶:車廂內裝與月台側的門是兩個不同的空間,50/50 疊在一起
  // 是一張雙重曝光(實測截圖確認),讀起來像 bug 不像轉場。所以 .camera 先在 0.62–0.72
  // 收乾,門再從 0.68 起浮上來 —— 中間那一小段幾乎全暗,語意剛好是「轉過身的那一瞬間」。
  const camOpacity = 1 - smooth(clamp((e - EXIT_DOOR.start) / 0.10));
  // §4.4:這裡原本有每幀的 filter: blur() —— 全視窗高斯模糊是這頁最貴的一筆,
  // 手機上轉身兩端都在跑。空間感改由 rotateY/translateX/opacity + 出站的門承擔。
  const introOpacity = smooth(clamp((e - 0.80) / 0.20)); // concourse hero 隨門閉合淡入
  // 出站的門(E1)
  const exitDoorP = exitDoorProgress(p);
  const doorExitOn = phase === "exit" && e >= EXIT_DOOR.start - 0.02;

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

  const showRide = phase === "ride" || phase === "exit";

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <div
        ref={stage}
        className="stage"
        style={{ position: "relative", height: "100vh", width: "100%", overflow: "hidden", display: "grid", placeItems: "center", background: "var(--bg)", perspective: "1200px", perspectiveOrigin: "center" }}
      >
        {phase === "gate" && (
          <button
            className="start"
            style={{ opacity: 1 - smooth(clamp((p - 0.09) / 0.04)) }} /* 進門前先淡出,不要硬切消失 */
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
        {showRide && (
          <div
            ref={camera}
            className="camera"
            /* camOpacity 歸零之後這層已經看不見了,willChange 再留著只是白白佔一個
               合成層(§4.4 的 will-change 收斂) */
            style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transformOrigin: "center 82%", transform: camTransform, opacity: camOpacity, willChange: camOpacity > 0 ? "transform, opacity" : "auto" }}
          >
            {/* 只有車廂進 sway 層:那層常駐 scale(1.035) 過掃描(讓 ±15px 平移不露邊),
                而 will-change + preserve-3d 會讓整層先光柵化再 GPU 縮放 —— 文字和像素字型
                會被重新取樣而發糊。照片和 canvas 放大 3.5% 看不出來,文字看得出來。 */}
            <div
              ref={sway}
              style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", placeContent: "center", transformStyle: "preserve-3d", willChange: "transform" }}
            >
              <CabinComposite scene={cur.scene} grade={grade} ledText={t(cur.led)} pan={x} platform={platform} tunnel={tunnel} />
            </div>
            <StationPanel station={cur} visible={phase === "ride" && doorP >= 1 && dist < 0.34} />
            {phase === "ride" && doorP >= 1 && <RouteMap index={index} onJump={jumpTo} />}
          </div>
        )}
        {/* 車門過場:three.js 的 3D 場景蓋在整個舞台上(含 gate 按鈕之下、車廂之上)。
            progress 0 = 關門待機(門縫漏光),1 = 相機已經穿過門框停在車廂前;最後 15%
            canvas 自己淡出,DOM 車廂(活窗景 + 跑馬燈)透出來接手。
            **永遠掛載**,離開門區間只用 CSS 收成 display:none —— 條件式掛載會讓 WebGL
            context 隨著上下捲反覆建/毀,實測會整片白屏(詳見 Door3D 的註解)。
            多留 0.02 的緩衝是為了讓 canvas 先淡到 0 再隱藏,不要在還看得見時消失。
            同一個 canvas 也服務出站的門(E1,mode="exit"):進站是門開 + 推軌穿門,
            出站是站在月台上看門關起來。**絕不能為了兩段門開兩個 canvas** —— 那就是
            兩個 WebGL context,坑 10 的另一種寫法。 */}
        <Door3D
          progress={doorExitOn ? exitDoorP : doorP}
          active={p < PHASE.doorEnd + 0.02 || doorExitOn}
          mode={doorExitOn ? "exit" : "enter"}
        />
        {phase === "exit" && (
          <div className="concourse-intro" style={{ opacity: introOpacity, pointerEvents: "none" }}>
            <div className="concourse-intro-inner"><ConcourseHero /></div>
          </div>
        )}
      </div>
    </div>
  );
}

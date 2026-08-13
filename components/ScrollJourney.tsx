"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STATIONS } from "@/content/stations";
import { phaseOf, doorProgress, rideProgress, exitProgress, lerpGrade, clamp, smooth, PHASE } from "@/lib/progress";
import { CabinComposite } from "./CabinComposite";
import { Door3D } from "./Door3D";
import { StationPanel } from "./StationPanel";
import { RouteMap } from "./RouteMap";
import { ConcourseHero } from "./Concourse";
import { startSoundtrack } from "./SoundToggle";
import { useLang } from "./LangProvider";

gsap.registerPlugin(ScrollTrigger);

const TOTAL_LEN = 8200; // pin 捲動總距離(px):gate → door(車門過場) → ride(六站) → exit(起身轉身)

// 開頁歸零只做一次(module scope,不是 ref)。dev 的 StrictMode 會把 effect 跑兩次、
// HMR 會再跑一次 —— 那時使用者可能已經在車廂裡,scrollTo(0,0) 會把人硬拉回月台,
// 途中 pin 重算 + 相位跳變就是「往上滑白屏」的來源之一。
let didInitialReset = false;

// 逐幀 window.scrollTo 的平滑捲動:每幀觸發真實 scroll 事件驅動 ScrollTrigger。
// (不用 gsap ScrollToPlugin —— 它與 pinned scrub ScrollTrigger 會回饋成死迴圈而凍結)
function smoothScrollTo(target: number, duration = 1300) {
  const start = window.scrollY;
  const dist = target - start;
  if (Math.abs(dist) < 1) return;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
    window.scrollTo(0, Math.round(start + dist * e));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function ScrollJourney() {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sway = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<"gate" | "ride" | "exit">("gate");
  const doorRef = useRef(0); // 給 sway 迴圈:門開完才開始跟滑鼠,交棒瞬間位移趨近 0
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
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    let raf = 0;
    const tick = () => {
      const active = phaseRef.current === "ride" && doorRef.current >= 1;
      const tgx = active ? target.x : 0, tgy = active ? target.y : 0;
      cur.x += (tgx - cur.x) * 0.06;
      cur.y += (tgy - cur.y) * 0.06;
      const el = sway.current;
      if (el) {
        const tx = -cur.x * 15, ty = -cur.y * 12;
        const ry = cur.x * 1.4, rx = -cur.y * 1.1;
        el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1.035)`;
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);

  const { t } = useLang();
  const n = STATIONS.length;
  const phase = phaseOf(p);
  phaseRef.current = phase;
  const doorP = doorProgress(p);
  doorRef.current = doorP;
  const rp = rideProgress(p);
  const x = rp * (n - 1);
  const index = Math.round(clamp(x, 0, n - 1));
  const dist = Math.abs(x - index);
  const lo = STATIONS[Math.floor(x)];
  const hi = STATIONS[Math.min(Math.ceil(x), n - 1)];
  const grade = lerpGrade(lo.grade, hi.grade, x - Math.floor(x));
  const cur = STATIONS[index];

  // 到站相機動畫(第一人稱起身 + 轉身):e 0→1
  const e = phase === "exit" ? exitProgress(p) : 0;
  const rise = smooth(clamp(e / 0.45)); // 起身:e 0→0.45
  const turn = smooth(clamp((e - 0.35) / 0.65)); // 轉身:e 0.35→1
  const camTransform = narrow
    ? // 手機 2.5D:起身 + 橫向滑出(輕微轉),省去重 3D rotateY
      `translateY(${(rise * 7).toFixed(2)}vh) scale(${(1 + rise * 0.1).toFixed(3)}) translateX(${(turn * -72).toFixed(2)}vw) rotateY(${(turn * -22).toFixed(2)}deg)`
    : // 桌機真 3D:起身 + 轉身
      `translateY(${(rise * 9).toFixed(2)}vh) scale(${(1 + rise * 0.16).toFixed(3)}) ` +
      `rotateX(${(rise * 5).toFixed(2)}deg) rotateY(${(turn * -85).toFixed(2)}deg) translateX(${(turn * -14).toFixed(2)}vw)`;
  const camOpacity = 1 - smooth(clamp((e - 0.72) / 0.28)); // 尾段淡出,交棒給 concourse
  const camFilter = turn > 0 ? `blur(${(turn * 4).toFixed(2)}px)` : "none";
  const introOpacity = smooth(clamp((e - 0.55) / 0.4)); // concourse hero 轉入淡入

  // 跳到第 i 站(路線圖點擊)。下限 doorEnd:跳站不要落在半開的車門裡
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
            className="camera"
            style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transformOrigin: "center 82%", transform: camTransform, opacity: camOpacity, filter: camFilter, willChange: "transform, opacity" }}
          >
            {/* 只有車廂進 sway 層:那層常駐 scale(1.035) 過掃描(讓 ±15px 平移不露邊),
                而 will-change + preserve-3d 會讓整層先光柵化再 GPU 縮放 —— 文字和像素字型
                會被重新取樣而發糊。照片和 canvas 放大 3.5% 看不出來,文字看得出來。 */}
            <div
              ref={sway}
              style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", placeContent: "center", transformStyle: "preserve-3d", willChange: "transform" }}
            >
              <CabinComposite scene={cur.scene} grade={grade} ledText={t(cur.led)} pan={x} />
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
            多留 0.02 的緩衝是為了讓 canvas 先淡到 0 再隱藏,不要在還看得見時消失。 */}
        <Door3D progress={doorP} active={p < PHASE.doorEnd + 0.02} />
        {phase === "exit" && (
          <div className="concourse-intro" style={{ opacity: introOpacity, pointerEvents: "none" }}>
            <div className="concourse-intro-inner"><ConcourseHero /></div>
          </div>
        )}
      </div>
    </div>
  );
}

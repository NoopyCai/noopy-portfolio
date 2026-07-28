"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STATIONS } from "@/content/stations";
import { phaseOf, rideProgress, exitProgress, lerpGrade, clamp, smooth, PHASE } from "@/lib/progress";
import { CabinComposite } from "./CabinComposite";
import { StationPanel } from "./StationPanel";
import { RouteMap } from "./RouteMap";
import { ConcourseHero } from "./Concourse";
import { useLang } from "./LangProvider";

gsap.registerPlugin(ScrollTrigger);

const TOTAL_LEN = 7600; // pin 捲動總距離(px):gate → ride(六站) → exit(到站起身轉身)

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
    const st = ScrollTrigger.create({
      trigger: wrap.current,
      start: "top top",
      end: `+=${TOTAL_LEN}`,
      pin: stage.current,
      pinSpacing: true,
      scrub: 0.5,
      onUpdate: (self) => setP(self.progress),
    });
    return () => st.kill();
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
      const active = phaseRef.current === "ride";
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

  // 跳到第 i 站(路線圖點擊)
  const jumpTo = (i: number) => {
    if (!wrap.current) return;
    const r = n > 1 ? i / (n - 1) : 0;
    const pTarget = clamp(PHASE.gateEnd + r * (PHASE.rideEnd - PHASE.gateEnd), PHASE.gateEnd + 0.02, PHASE.rideEnd - 0.01);
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
            onClick={() => {
              const w = wrap.current!;
              smoothScrollTo(w.offsetTop + TOTAL_LEN * (PHASE.gateEnd + 0.03), 1400); // 進入第一站(月台)
            }}
          >
            {t({ zh: "開始乘車", en: "Start ride" })} ▸
          </button>
        )}
        {showRide && (
          <div
            className="camera"
            style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transformOrigin: "center 82%", transform: camTransform, opacity: camOpacity, filter: camFilter, willChange: "transform, opacity" }}
          >
            <div
              ref={sway}
              style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", placeContent: "center", transformStyle: "preserve-3d", willChange: "transform" }}
            >
              <CabinComposite scene={cur.scene} grade={grade} ledText={t(cur.led)} pan={x} />
              <StationPanel station={cur} visible={phase === "ride" && dist < 0.34} />
              {phase === "ride" && <RouteMap index={index} onJump={jumpTo} />}
            </div>
          </div>
        )}
        {phase === "exit" && (
          <div className="concourse-intro" style={{ opacity: introOpacity, pointerEvents: "none" }}>
            <div className="concourse-intro-inner"><ConcourseHero /></div>
          </div>
        )}
      </div>
    </div>
  );
}

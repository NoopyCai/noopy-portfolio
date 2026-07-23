"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STATIONS } from "@/content/stations";
import { phaseOf, fillAmount, rideProgress, lerpGrade, clamp, PHASE } from "@/lib/progress";
import { WireCar } from "./WireCar";
import { CabinComposite } from "./CabinComposite";
import { StationPanel } from "./StationPanel";
import { RouteMap } from "./RouteMap";
import { startSoundtrack } from "./SoundToggle";
import { useLang } from "./LangProvider";

gsap.registerPlugin(ScrollTrigger);

const RIDE_LEN = 6000; // pin 捲動距離(px);gateEnd=0.16 之後為乘車段

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

export function ScrollJourney({ soundOn }: { soundOn: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sway = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    if (!wrap.current || !stage.current) return;
    const st = ScrollTrigger.create({
      trigger: wrap.current,
      start: "top top",
      end: `+=${RIDE_LEN}`,
      pin: stage.current,
      pinSpacing: true,
      scrub: 0.5,
      onUpdate: (self) => setP(self.progress),
    });
    return () => st.kill();
  }, []);

  // 滑鼠視差晃動:整體隨游標平滑位移 + 輕微 3D 傾斜(rAF lerp 產生緩動尾隨的「晃動」感)
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
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;
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
  const rp = rideProgress(p);
  const x = rp * (n - 1);
  const index = Math.round(clamp(x, 0, n - 1));
  const dist = Math.abs(x - index);
  const lo = STATIONS[Math.floor(x)];
  const hi = STATIONS[Math.min(Math.ceil(x), n - 1)];
  const grade = lerpGrade(lo.grade, hi.grade, x - Math.floor(x));
  const cur = STATIONS[index];

  // 跳到第 i 站(路線圖點擊):換算該站的捲動進度,GSAP 平滑過渡
  const jumpTo = (i: number) => {
    if (!wrap.current) return;
    const rp = n > 1 ? i / (n - 1) : 0;
    const pTarget = clamp(PHASE.gateEnd + rp * (1 - PHASE.gateEnd), 0.19, 0.97);
    smoothScrollTo(wrap.current.offsetTop + RIDE_LEN * pTarget, 1200);
  };

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <div
        ref={stage}
        className="stage"
        style={{ position: "relative", height: "100vh", width: "100%", overflow: "hidden", display: "grid", placeItems: "center", background: "var(--bg)", perspective: "1200px", perspectiveOrigin: "center" }}
      >
        {phase === "boot" && (
          <div style={{ width: "max(100vw, 177.78vh)", aspectRatio: "16 / 9" }}>
            <WireCar fill={fillAmount(p)} />
          </div>
        )}
        {phase === "gate" && (
          <button
            className="start"
            onClick={() => {
              if (soundOn) startSoundtrack();
              const w = wrap.current!;
              // 進入乘車段第一站(月台,rideProgress≈0.04 → index 0),平滑過渡
              smoothScrollTo(w.offsetTop + RIDE_LEN * 0.19, 1400);
            }}
          >
            {t({ zh: "開始乘車", en: "Start ride" })} ▸
          </button>
        )}
        {phase === "ride" && (
          <div
            ref={sway}
            style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", transformStyle: "preserve-3d", willChange: "transform" }}
          >
            <CabinComposite scene={cur.scene} grade={grade} ledText={t(cur.led)} pan={x} />
            <StationPanel station={cur} visible={dist < 0.34} />
            <RouteMap index={index} onJump={jumpTo} />
          </div>
        )}
      </div>
    </div>
  );
}

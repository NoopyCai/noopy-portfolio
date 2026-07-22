"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STATIONS } from "@/content/stations";
import { phaseOf, fillAmount, rideProgress, lerpGrade, clamp } from "@/lib/progress";
import { WireCar } from "./WireCar";
import { CabinComposite } from "./CabinComposite";
import { StationPanel } from "./StationPanel";
import { playArrivalChime } from "./SoundToggle";
import { useLang } from "./LangProvider";

gsap.registerPlugin(ScrollTrigger);

export function ScrollJourney({ soundOn }: { soundOn: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const prevIndex = useRef(-1);
  const [p, setP] = useState(0);

  useEffect(() => {
    if (!wrap.current || !stage.current) return;
    const st = ScrollTrigger.create({
      trigger: wrap.current,
      start: "top top",
      end: "+=6000",
      pin: stage.current,
      pinSpacing: true,
      scrub: 0.5,
      onUpdate: (self) => setP(self.progress),
    });
    return () => st.kill();
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

  useEffect(() => {
    if (phase === "ride" && index !== prevIndex.current) {
      if (soundOn) playArrivalChime();
      prevIndex.current = index;
    }
  }, [phase, index, soundOn]);

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <div
        ref={stage}
        className="stage"
        style={{ position: "relative", height: "100vh", width: "100%", overflow: "hidden", display: "grid", placeItems: "center", background: "var(--bg)" }}
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
              const w = wrap.current!;
              scrollTo({ top: w.offsetTop + w.offsetHeight * 0.3, behavior: "smooth" });
            }}
          >
            {t({ zh: "開始乘車", en: "Start ride" })} ▸
          </button>
        )}
        {phase === "ride" && (
          <>
            <CabinComposite scene={cur.scene} grade={grade} ledText={t(cur.led)} pan={x} />
            <StationPanel station={cur} visible={dist < 0.34} />
          </>
        )}
      </div>
    </div>
  );
}

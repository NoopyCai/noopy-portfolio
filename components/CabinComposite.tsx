"use client";
import { WIN, LED_RECT } from "@/lib/progress";
import { Window } from "./Window";
import { LedSign } from "./LedSign";
import type { SceneType, Grade } from "@/content/stations";

// 靜態車廂圖 + 三扇 live 車窗(idx0 中央=完整,其餘 bg)+ LED 覆蓋 + 燈光分級 overlay。
export function CabinComposite({ scene, grade, ledText, pan }: { scene: SceneType; grade: Grade; ledText: string; pan: number }) {
  return (
    <div style={{ position: "relative", width: "max(100vw, 177.68vh)", lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cabin.jpg"
        alt="EMU900 車廂內裝 · EMU900 train interior"
        style={{ width: "100%", height: "auto", display: "block", filter: grade.filter, transition: "filter .8s ease" }}
      />
      <div
        style={{ position: "absolute", inset: 0, pointerEvents: "none", background: grade.grade, mixBlendMode: grade.blend as React.CSSProperties["mixBlendMode"], transition: "background .8s ease" }}
      />
      {WIN.map((r, i) => (
        <Window key={i} scene={scene} rect={r} bg={i !== 0} pan={pan} />
      ))}
      <div style={{ position: "absolute", left: `${LED_RECT.left}%`, top: `${LED_RECT.top}%`, width: `${LED_RECT.w}%`, height: `${LED_RECT.h}%` }}>
        <LedSign text={ledText} />
      </div>
    </div>
  );
}

"use client";
import { useRef } from "react";
import { WIN, LED_RECT, gradeFilter } from "@/lib/progress";
import { useFrame, setShown, type FrameBus } from "@/lib/frame";
import { Window } from "./Window";
import { LedSign } from "./LedSign";
import { GRADE_BLEND, type SceneType } from "@/content/stations";

// TunnelFx 的定義搬到 lib/frame.ts —— 它現在是 frame bus 的一個欄位,不再是這裡的 prop。

// 靜態車廂圖 + 三扇 live 車窗(idx0 中央=完整,其餘 bg)+ LED 覆蓋 + 燈光分級 overlay。
//
// 這個元件只吃**離散**的 props(scene / ledText,換站才變)。grade、pan、月台層、隧道層
// 全部是連續量,走 frame bus 直接寫 DOM(階段 0,audit §4.3)—— 捲動時這裡零 re-render。
export function CabinComposite({
  bus,
  scene,
  ledText,
}: {
  bus: FrameBus;
  scene: SceneType;
  ledText: string;
}) {
  const img = useRef<HTMLImageElement>(null);
  const tint = useRef<HTMLDivElement>(null);
  const lift = useRef<HTMLDivElement>(null);
  const sweep = useRef<HTMLDivElement>(null);
  const sweepBand = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);

  useFrame(bus, () => {
    const { grade, tunnel } = bus.frame;
    if (img.current) img.current.style.filter = gradeFilter(grade);
    if (tint.current) tint.current.style.background = grade.tint;
    // 隧道三層:區間外收成 display:none(等價於舊的條件式掛載 —— 不進 paint、不產生
    // 合成層,只是不再需要一次 re-render 才能掛上來)。
    const on = tunnel !== null;
    setShown(lift.current, on);
    setShown(sweep.current, on);
    if (tunnel) {
      if (lift.current) lift.current.style.opacity = String(tunnel.lift);
      if (sweepBand.current) {
        sweepBand.current.style.transform = `translate3d(${-tunnel.sweep.toFixed(2)}%, 0, 0)`;
        sweepBand.current.style.opacity = tunnel.lift > 0 ? "1" : "0";
      }
    }
    const flashOn = tunnel !== null && tunnel.flash > 0;
    setShown(flash.current, flashOn);
    if (flashOn && flash.current) flash.current.style.opacity = String(tunnel!.flash);
  });

  return (
    // cover:任何比例都填滿畫面(寬螢幕吃 100vw、直式吃 177.68vh)。不要加上限 —— 加了直式就會出現上下留邊。
    <div style={{ position: "relative", width: "max(100vw, 177.68vh)", lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src="/cabin.jpg"
        alt="EMU900 車廂內裝 · EMU900 train interior"
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      {/* 沒有 transition:grade 已經是逐幀連續插值(lerpGrade),再加 .8s 追趕只會跟 scrub
          打架 —— 捲動停下後燈光還要自己再飄 0.8 秒,那正是「燈光跟不上窗景」的來源。 */}
      <div
        ref={tint}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: GRADE_BLEND as React.CSSProperties["mixBlendMode"] }}
      />
      {/* 隧道的兩層「車內光」擺在窗**之前**:光帶掃的是車廂內壁,不該把壓暗的窗景又提亮。
          用 % / inset 定位,直式 cover 裁切下位置自然跟著對(不寫死 px)。 */}
      <div ref={lift} className="tunnel-lift" style={{ display: "none" }} />
      <div ref={sweep} className="tunnel-sweep" style={{ display: "none" }}>
        <div ref={sweepBand} className="tunnel-sweep-band" />
      </div>
      {WIN.map((r, i) => (
        <Window key={i} bus={bus} scene={scene} rect={r} bg={i !== 0} center={i === 0} />
      ))}
      {/* 出洞回光:蓋在窗之上(光是從窗外潑進來的),但擺在 LED 之前,跑馬燈不該被洗白 */}
      <div ref={flash} className="tunnel-flash" style={{ display: "none" }} />
      <div style={{ position: "absolute", left: `${LED_RECT.left}%`, top: `${LED_RECT.top}%`, width: `${LED_RECT.w}%`, height: `${LED_RECT.h}%` }}>
        <LedSign text={ledText} />
      </div>
    </div>
  );
}

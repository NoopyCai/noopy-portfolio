"use client";
import { WIN, LED_RECT } from "@/lib/progress";
import { Window } from "./Window";
import { LedSign } from "./LedSign";
import type { SceneType, Grade } from "@/content/stations";

// A5 隧道段的所有覆蓋層參數。全部由 eased x 插值(見 ScrollJourney),不由時間 —— 所以
// 倒著捲就是倒著出洞。null = 不在隧道區間,整組 DOM 不掛(巡航段零合成層成本)。
export type TunnelFx = {
  dim: number;          // 三扇窗的壓暗(窗外近黑)
  band: number | null;  // 中央窗那道垂直暗帶的 X 位移(%),null = 已經掃完
  lift: number;         // 車廂內壁的暖色提亮(隧道裡「車內比車外亮」是對的)
  sweep: number;        // 暖色光帶橫掃的位移(%)
  flash: number;        // 出洞回光(白)
};

// 靜態車廂圖 + 三扇 live 車窗(idx0 中央=完整,其餘 bg)+ LED 覆蓋 + 燈光分級 overlay。
export function CabinComposite({
  scene,
  grade,
  ledText,
  pan,
  platform = 0,
  tunnel = null,
}: {
  scene: SceneType;
  grade: Grade;
  ledText: string;
  pan: number;
  /** B2:三扇窗的月台層不透明度(0 = 不疊,巡航段零 blit) */
  platform?: number;
  tunnel?: TunnelFx | null;
}) {
  return (
    // cover:任何比例都填滿畫面(寬螢幕吃 100vw、直式吃 177.68vh)。不要加上限 —— 加了直式就會出現上下留邊。
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
      {/* 隧道的兩層「車內光」擺在窗**之前**:光帶掃的是車廂內壁,不該把壓暗的窗景又提亮。
          用 % / inset 定位,直式 cover 裁切下位置自然跟著對(不寫死 px)。 */}
      {tunnel && (
        <>
          <div className="tunnel-lift" style={{ opacity: tunnel.lift }} />
          <div className="tunnel-sweep">
            <div className="tunnel-sweep-band" style={{ transform: `translate3d(${-tunnel.sweep.toFixed(2)}%, 0, 0)`, opacity: tunnel.lift > 0 ? 1 : 0 }} />
          </div>
        </>
      )}
      {WIN.map((r, i) => (
        <Window
          key={i}
          scene={scene}
          rect={r}
          bg={i !== 0}
          pan={pan}
          platform={platform}
          dim={tunnel ? tunnel.dim : 0}
          band={i === 0 && tunnel ? tunnel.band : null}
        />
      ))}
      {/* 出洞回光:蓋在窗之上(光是從窗外潑進來的),但擺在 LED 之前,跑馬燈不該被洗白 */}
      {tunnel && tunnel.flash > 0 && <div className="tunnel-flash" style={{ opacity: tunnel.flash }} />}
      <div style={{ position: "absolute", left: `${LED_RECT.left}%`, top: `${LED_RECT.top}%`, width: `${LED_RECT.w}%`, height: `${LED_RECT.h}%` }}>
        <LedSign text={ledText} />
      </div>
    </div>
  );
}

"use client";
import { useEffect } from "react";
import { WIN, LED_RECT } from "@/lib/progress";
import { LedSign } from "./LedSign";

// L2a:WebGL 可用時,車廂本體(牆、立柱、三扇窗、月台、隧道)全部在 three 場景裡,
// 這一層是**留在 DOM 的最後兩件東西**,疊在 canvas 上:
//
//   · LED 跑馬燈 —— 文字永不進 WebGL(坑 3 的升級版)。面板底色不在這裡:那是場景那張
//     牆貼圖裡被塗成 #050805 的矩形(door3d/cabin.ts)。少了這個分工,DOM 的不透明面板
//     會蓋掉場景裡橫杆壓在跑馬燈前面的那 8px —— 深度就反了(理由見 CabinComposite)。
//   · 車窗玻璃(A6)—— 反光要跟著滑鼠走 ±3.5px。留在 CSS 就是零重繪;搬進場景等於
//     每次滑鼠動一下就要重畫一幀,違反 render-on-demand。
//
// 幾何與 CabinComposite 同一組 cover(width: max(100vw, 177.68vh),坑 4 的紅線),
// 所以它與 canvas 裡的車廂落在同一格網 —— 兩邊都被 sway 層的 scale(1.035) 一起帶著走。
export function CabinFrame({
  rootRef,
  ledText,
}: {
  /** 淡入由 ScrollJourney 每幀寫 opacity(門推軌停下的 doorP 0.85 起) */
  rootRef: React.RefObject<HTMLDivElement | null>;
  ledText: string;
}) {
  // LED 時鐘:30 秒直寫三份 .led-clock 的 textContent —— 不走 setState,跑馬燈的
  // CSS 動畫不重啟、React 零 re-render。分頁掛起時 interval 停,回來立即重寫一次
  // (interval 恢復後只會從下一個 30s 開始,不重寫的話會顯示掛起前的舊時間)。
  useEffect(() => {
    const write = () => {
      const s = new Date().toTimeString().slice(0, 5);
      for (const el of document.querySelectorAll<HTMLElement>(".cabin-frame .led-clock")) el.textContent = s;
    };
    write();
    let id = window.setInterval(write, 30_000);
    const onVis = () => {
      clearInterval(id);
      if (!document.hidden) { write(); id = window.setInterval(write, 30_000); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  return (
    <div className="cabin-frame" ref={rootRef} style={{ opacity: 0 }}>
      {WIN.map((r, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${r.left}%`,
            top: `${r.top}%`,
            width: `${r.w}%`,
            height: `${r.h}%`,
            overflow: "hidden",
            borderRadius: r.r,
          }}
        >
          <div className="win-glass" />
        </div>
      ))}
      <div style={{ position: "absolute", left: `${LED_RECT.left}%`, top: `${LED_RECT.top}%`, width: `${LED_RECT.w}%`, height: `${LED_RECT.h}%` }}>
        <LedSign text={ledText} clock />
      </div>
    </div>
  );
}

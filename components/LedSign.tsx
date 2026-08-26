"use client";

// 包夾用的 ◄ ► 維持字元而不是 SVG:它們跟著 LED 字型與綠色光暈(text-shadow)一起渲染,
// 換成 icon 會失去發光、字重也對不上跑馬燈的其他字。
export function LedSign({ text, clock = false }: { text: string; clock?: boolean }) {
  // 時間槽渲染占位 --:--,由 CabinFrame 直寫 textContent(不能在 render 讀時鐘:
  // SSR 與 client 的時間不同,會 hydration mismatch)。全數字 + 拉丁,避開
  // --font-led 無 CJK 的既有缺陷。
  const seg = (i: number) => (
    <span key={i}>
      {`◄ ${text} ►　`}
      {clock && <>{"◄ "}<span className="led-clock">--:--</span>{" ►　"}</>}
    </span>
  );
  return (
    <div className="led" aria-hidden>
      <div className="led-run">{[0, 1, 2].map(seg)}</div>
    </div>
  );
}

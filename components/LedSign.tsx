"use client";

// 包夾用的 ◄ ► 維持字元而不是 SVG:它們跟著 LED 字型與綠色光暈(text-shadow)一起渲染,
// 換成 icon 會失去發光、字重也對不上跑馬燈的其他字。
export function LedSign({ text }: { text: string }) {
  return (
    <div className="led" aria-hidden>
      <div className="led-run">{`◄ ${text} ►　`.repeat(3)}</div>
    </div>
  );
}

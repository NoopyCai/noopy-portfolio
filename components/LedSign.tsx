"use client";

export function LedSign({ text }: { text: string }) {
  return (
    <div className="led" aria-hidden>
      <div className="led-run">{`◄ ${text} ►　`.repeat(3)}</div>
    </div>
  );
}

"use client";

let actx: AudioContext | null = null;

// 自製兩音「叮—咚」到站音,無版權
export function playArrivalChime() {
  actx ??= new AudioContext();
  const a = actx;
  const now = a.currentTime;
  [988, 660].forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(g);
    g.connect(a.destination);
    const s = now + i * 0.18;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.25, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.4);
    o.start(s);
    o.stop(s + 0.42);
  });
}

export function SoundToggle({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      className="ctrl"
      aria-pressed={enabled}
      onClick={() => {
        const v = !enabled;
        onToggle(v);
        if (v) playArrivalChime();
      }}
    >
      {enabled ? "🔊" : "🔇"} 報站 / Sound
    </button>
  );
}

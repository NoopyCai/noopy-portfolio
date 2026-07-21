"use client";
import { useLang } from "./LangProvider";
import { SoundToggle } from "./SoundToggle";

export function TopBar({ soundOn, onSound }: { soundOn: boolean; onSound: (v: boolean) => void }) {
  const { lang, toggle } = useLang();
  return (
    <div style={{ position: "fixed", top: 14, right: 14, zIndex: 50, display: "flex", gap: 8 }}>
      <button className="ctrl" onClick={toggle} aria-label="Toggle language / 切換語言">
        {lang === "zh" ? "中 / EN" : "EN / 中"}
      </button>
      <SoundToggle enabled={soundOn} onToggle={onSound} />
    </div>
  );
}

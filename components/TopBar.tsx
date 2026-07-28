"use client";
import { useLang } from "./LangProvider";

export function TopBar() {
  const { lang, toggle } = useLang();
  return (
    <div style={{ position: "fixed", top: 14, right: 14, zIndex: 50, display: "flex", gap: 8 }}>
      <button className="ctrl" onClick={toggle} aria-label="Toggle language / 切換語言">
        {lang === "zh" ? "中 / EN" : "EN / 中"}
      </button>
    </div>
  );
}

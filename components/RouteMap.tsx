"use client";
import { STATIONS } from "@/content/stations";
import { useLang } from "./LangProvider";

// 右側路線圖:6 站進度點,點擊跳站(火車主題的導覽 + 進度指示)。
export function RouteMap({ index, onJump }: { index: number; onJump: (i: number) => void }) {
  const { t } = useLang();
  return (
    <nav className="routemap" aria-label={t({ zh: "路線圖", en: "Route map" })}>
      {STATIONS.map((s, i) => (
        <button
          key={s.id}
          type="button"
          className={"routemap-dot" + (i === index ? " on" : i < index ? " past" : "")}
          onClick={() => onJump(i)}
          aria-current={i === index}
          aria-label={t(s.name)}
        >
          <span className="routemap-label">{t(s.name)}</span>
        </button>
      ))}
    </nav>
  );
}

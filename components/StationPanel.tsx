"use client";
import { useLang } from "./LangProvider";
import type { Station } from "@/content/stations";

// 站點內容面板(ride 疊層):依 panel.kind 渲染雙語內容,visible 控制淡入。
export function StationPanel({ station, visible }: { station: Station; visible: boolean }) {
  const { t } = useLang();
  const p = station.panel;
  const style: React.CSSProperties = {
    position: "absolute",
    left: "6%",
    bottom: "8%",
    maxWidth: "42%",
    opacity: visible ? 1 : 0,
    transform: `translateY(${visible ? 0 : 16}px)`,
    transition: "opacity .5s, transform .5s",
    color: "var(--text)",
    textShadow: "0 2px 12px rgba(0,0,0,.7)",
    pointerEvents: visible ? "auto" : "none",
  };
  return (
    <div style={style}>
      <div style={{ fontFamily: "var(--font-led)", color: "var(--amber)", letterSpacing: ".2em", fontSize: 12 }}>{t(station.name)}</div>
      <h2 style={{ margin: "4px 0 8px", fontSize: "clamp(20px,3vw,34px)", textWrap: "balance" }}>{t(p.title)}</h2>
      {p.subtitle && <div style={{ fontFamily: "var(--font-led)", color: "var(--muted)", fontSize: 13, marginBottom: 10 }}>{t(p.subtitle)}</div>}
      {p.body && <p style={{ lineHeight: 1.75, fontSize: 15 }}>{t(p.body)}</p>}
      {p.tags && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0" }}>
          {p.tags.map((x) => (
            <span key={x} style={{ fontFamily: "var(--font-led)", fontSize: 11, color: "var(--green)", border: "1px solid rgba(6,255,49,.4)", borderRadius: 999, padding: "4px 10px" }}>{x}</span>
          ))}
        </div>
      )}
      {p.metrics && (
        <div style={{ display: "flex", gap: 22, margin: "8px 0" }}>
          {p.metrics.map((m, i) => (
            <div key={i}>
              <div style={{ fontFamily: "var(--font-led)", fontWeight: 700, fontSize: 24, color: "var(--amber)" }}>{m.n}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{t(m.label)}</div>
            </div>
          ))}
        </div>
      )}
      {p.skills && (
        <div style={{ display: "grid", gap: 8 }}>
          {p.skills.map((g, i) => (
            <div key={i}><b style={{ color: "var(--emu-green)" }}>{t(g.group)}</b>：{g.items.join("、")}</div>
          ))}
        </div>
      )}
      {p.contacts && (
        <div style={{ display: "flex", gap: 14, margin: "10px 0", flexWrap: "wrap" }}>
          {p.contacts.map((c) => (
            <a key={c.label} href={c.href} rel="noopener" target="_blank">{c.label}</a>
          ))}
        </div>
      )}
      {p.link && (
        <a href={p.link} target="_blank" rel="noopener" style={{ fontFamily: "var(--font-led)", color: "var(--green)" }}>
          {t({ zh: "下載履歷 PDF", en: "Résumé PDF" })} ▸
        </a>
      )}
    </div>
  );
}

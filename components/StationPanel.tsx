"use client";
import { useEffect, useState } from "react";
import { useLang } from "./LangProvider";
import type { Station } from "@/content/stations";

// 站點內容面板(ride 疊層):依 panel.kind 渲染雙語內容,visible 控制淡入。
export function StationPanel({ station, visible }: { station: Station; visible: boolean }) {
  const { t } = useLang();
  const p = station.panel;
  const [open, setOpen] = useState(false);

  // 換站時關閉細節卡
  useEffect(() => {
    setOpen(false);
  }, [station.id]);

  const style: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: `translateY(${visible ? 0 : 16}px)`,
    transition: "opacity .5s, transform .5s",
    pointerEvents: visible ? "auto" : "none",
  };
  return (
    <>
      <div className="glasscard station-panel" style={style}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-led)", color: "var(--amber)", letterSpacing: ".2em", fontSize: 12 }}>{t(station.name)}</span>
          {(p.year || p.role) && (
            <span style={{ fontFamily: "var(--font-led)", color: "var(--muted)", fontSize: 11 }}>
              {[p.year, p.role && t(p.role)].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        <h2 style={{ margin: "4px 0 8px", fontSize: "clamp(20px,3vw,34px)", textWrap: "balance" }}>{t(p.title)}</h2>
        {p.subtitle && <div style={{ fontFamily: "var(--font-led)", color: "var(--muted)", fontSize: 13, marginBottom: 10 }}>{t(p.subtitle)}</div>}
        {p.impact && <p className="impact">▸ {t(p.impact)}</p>}
        {p.body && <p style={{ lineHeight: 1.75, fontSize: 15 }}>{t(p.body)}</p>}
        {p.tags && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0" }}>
            {p.tags.map((x) => (
              <span key={x} style={{ fontFamily: "var(--font-led)", fontSize: 11, color: "var(--green)", border: "1px solid rgba(6,255,49,.4)", borderRadius: 999, padding: "4px 10px" }}>{x}</span>
            ))}
          </div>
        )}
        {p.metrics && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, rowGap: 10, margin: "8px 0" }}>
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
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          {p.detail && (
            <button type="button" className="detail-btn" onClick={() => setOpen(true)}>
              {t({ zh: "看細節", en: "Details" })} ▾
            </button>
          )}
          {p.links?.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener" style={{ fontFamily: "var(--font-led)", fontSize: 12 }}>{l.label} ↗</a>
          ))}
          {p.link && (
            <a href={p.link} target="_blank" rel="noopener" style={{ fontFamily: "var(--font-led)", color: "var(--green)" }}>
              {t({ zh: "下載履歷 PDF", en: "Résumé PDF" })} ▸
            </a>
          )}
        </div>
      </div>

      {open && p.detail && (
        <div className="detail-modal" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="detail-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="detail-close" onClick={() => setOpen(false)} aria-label={t({ zh: "關閉", en: "Close" })}>✕</button>
            <div style={{ fontFamily: "var(--font-led)", color: "var(--amber)", letterSpacing: ".2em", fontSize: 12 }}>
              {t(station.name)}{p.year ? ` · ${p.year}` : ""}{p.role ? ` · ${t(p.role)}` : ""}
            </div>
            <h3 style={{ margin: "6px 0 14px", fontSize: "clamp(18px,2.4vw,26px)" }}>{t(p.title)}</h3>
            {([
              [{ zh: "問題", en: "Problem" }, p.detail.problem],
              [{ zh: "做法", en: "Approach" }, p.detail.approach],
              [{ zh: "成果", en: "Result" }, p.detail.result],
            ] as const).map(([label, val], i) => (
              <div key={i} className="detail-row">
                <div className="detail-label">{t(label)}</div>
                <p>{t(val)}</p>
              </div>
            ))}
            {p.tags && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {p.tags.map((x) => (
                  <span key={x} style={{ fontFamily: "var(--font-led)", fontSize: 11, color: "var(--green)", border: "1px solid rgba(6,255,49,.4)", borderRadius: 999, padding: "3px 9px" }}>{x}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

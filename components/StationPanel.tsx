"use client";
import { useEffect, useState } from "react";
import { useLang } from "./LangProvider";
import { Icon } from "./Icon";
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
      {/* 版面全部在 CSS(.sp-*):桌機浮出左下、手機改成靠左閱讀的資訊看板,見 globals.css */}
      <div className="glasscard station-panel" style={style}>
        <div className="sp-head">
          <span className="sp-station">{t(station.name)}</span>
          {(p.year || p.role) && (
            <span className="sp-meta">{[p.year, p.role && t(p.role)].filter(Boolean).join(" · ")}</span>
          )}
        </div>
        <h2>{t(p.title)}</h2>
        {p.subtitle && <div className="sp-sub">{t(p.subtitle)}</div>}
        {p.impact && <p className="impact"><Icon name="play" /> {t(p.impact)}</p>}
        {p.body && <p className="sp-body">{t(p.body)}</p>}
        {p.tags && (
          <div className="sp-tags">
            {p.tags.map((x) => (
              <span key={x} className="sp-tag">{x}</span>
            ))}
          </div>
        )}
        {p.metrics && (
          <div className="sp-metrics">
            {p.metrics.map((m, i) => (
              <div key={i}>
                <div className="sp-metric-n">{m.n}</div>
                <div className="sp-metric-l">{t(m.label)}</div>
              </div>
            ))}
          </div>
        )}
        {p.skills && (
          <div className="sp-skills">
            {p.skills.map((g, i) => (
              <div key={i}><b>{t(g.group)}</b>：{g.items.join("、")}</div>
            ))}
          </div>
        )}
        {/* 終點站的 contacts / 履歷連結刻意不在車廂裡渲染:行動點統一收在出站大廳
            (唯一 CTA),這裡只留情緒收尾。資料本身留在 STATIONS,由 Concourse 與
            StaticFallback 使用。 */}
        <div className="sp-actions">
          {p.detail && (
            <button type="button" className="detail-btn" onClick={() => setOpen(true)}>
              {t({ zh: "看細節", en: "Details" })} <Icon name="chevron" />
            </button>
          )}
          {p.links?.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener" className="sp-link">{l.label} <Icon name="external" /></a>
          ))}
        </div>
      </div>

      {open && p.detail && (
        <div className="detail-modal" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="detail-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="detail-close" onClick={() => setOpen(false)} aria-label={t({ zh: "關閉", en: "Close" })}><Icon name="close" size={14} /></button>
            <div style={{ fontFamily: "var(--font-led)", color: "var(--amber)", letterSpacing: ".2em", fontSize: 12 }}>
              {t(station.name)}{p.year ? ` · ${p.year}` : ""}{p.role ? ` · ${t(p.role)}` : ""}
            </div>
            <h3 style={{ margin: "6px 0 14px", fontSize: "clamp(18px,2.4vw,26px)" }}>{t(p.title)}</h3>
            {/* 截圖放在「問題/做法/成果」之前:三個專案站唯一的可驗證佐證,先給第一印象。
                lazy 是為了不讓三張圖進首屏的網路佇列(modal 沒開之前根本不該下載)。 */}
            {p.screenshot && (
              <img
                className="detail-shot"
                src={p.screenshot.src}
                alt={t(p.screenshot.alt)}
                loading="lazy"
                decoding="async"
              />
            )}
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
            {p.diagram && (
              <div className="detail-diagram">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.diagram.src} alt={t(p.diagram.alt)} loading="lazy" />
              </div>
            )}
            {p.tags && (
              <div className="sp-tags" style={{ marginTop: 14 }}>
                {p.tags.map((x) => (
                  <span key={x} className="sp-tag">{x}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

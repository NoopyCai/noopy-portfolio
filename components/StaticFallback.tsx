"use client";
import { STATIONS } from "@/content/stations";
import { useLang } from "./LangProvider";
import { Icon } from "./Icon";

// prefers-reduced-motion / 無 JS 時的語意化直向降級:每站一個 section。
export function StaticFallback() {
  const { t } = useLang();
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px", display: "grid", gap: 56 }}>
      <header>
        {/* h2 而不是 h1:Concourse 一律渲染,那裡的站名牌是全站唯一的 h1。
            這個降級版與它同時存在於 DOM,兩個 h1 會讓爬蟲與螢幕閱讀器都失去主標。 */}
        <h2 style={{ fontSize: "clamp(28px,6vw,52px)", margin: 0 }}>蔡守傑 NoopyCai</h2>
        <p style={{ color: "var(--muted)", fontFamily: "var(--font-led)" }}>夜車・區間 · Night Local · Frontend / Full-stack</p>
      </header>
      {STATIONS.map((s) => {
        const p = s.panel;
        return (
          <section key={s.id} aria-label={t(s.name)}>
            <div style={{ fontFamily: "var(--font-led)", color: "var(--amber)", letterSpacing: ".2em", fontSize: 12 }}>{t(s.name)}</div>
            {/* 上面的標題降成 h2 之後,每站往下一級才不會變成它的兄弟 */}
            <h3 style={{ margin: "6px 0 10px", fontSize: "clamp(22px,4vw,32px)" }}>{t(p.title)}</h3>
            {p.subtitle && <div style={{ color: "var(--muted)", fontFamily: "var(--font-led)", marginBottom: 10 }}>{t(p.subtitle)}</div>}
            {p.body && <p style={{ lineHeight: 1.8 }}>{t(p.body)}</p>}
            {p.tags && (
              <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {p.tags.map((x) => (
                  <span key={x} style={{ fontFamily: "var(--font-led)", fontSize: 12, border: "1px solid var(--line)", borderRadius: 999, padding: "3px 10px" }}>{x}</span>
                ))}
              </p>
            )}
            {p.skills && (
              <ul style={{ lineHeight: 1.9, paddingLeft: 20 }}>
                {p.skills.map((g, i) => (
                  <li key={i}><b style={{ color: "var(--emu-green)" }}>{t(g.group)}</b>：{g.items.join("、")}</li>
                ))}
              </ul>
            )}
            {p.contacts && (
              <p style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {p.contacts.map((c) => (
                  <a key={c.label} href={c.href} target="_blank" rel="noopener">{c.label}</a>
                ))}
              </p>
            )}
            {p.link && (
              <p><a href={p.link} target="_blank" rel="noopener">{t({ zh: "下載履歷 PDF", en: "Résumé PDF" })} <Icon name="play" /></a></p>
            )}
          </section>
        );
      })}
    </main>
  );
}

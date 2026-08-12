"use client";
import { useLang } from "./LangProvider";
import { STATIONS } from "@/content/stations";
import { Icon } from "./Icon";

// 轉入 intro 與正式 section 共用的 hero,確保 pin 解除瞬間畫面一致(無縫交棒)
export function ConcourseHero() {
  const { t } = useLang();
  return (
    <div className="concourse-hero">
      {/* 用 h2 而不是 span:下面的 h3 區塊才不會跳標題層級 */}
      <h2 className="eyebrow">CONCOURSE</h2>
      <p>{t({ zh: "蔡守傑 NoopyCai · Software Engineer", en: "NoopyCai · Software Engineer" })}</p>
    </div>
  );
}

// 出站大廳:轉身後的正常捲動區(關於 + 聯絡 + footer)
export function Concourse() {
  const { t } = useLang();
  const hero = STATIONS[0].panel;
  const terminal = STATIONS[STATIONS.length - 1].panel;
  return (
    <section className="concourse" aria-label={t({ zh: "出站大廳", en: "Concourse" })}>
      <div className="concourse-inner">
        <ConcourseHero />

        <div className="concourse-block">
          <h3>{t({ zh: "關於我", en: "About" })}</h3>
          {hero.body && <p>{t(hero.body)}</p>}
          {terminal.body && <p>{t(terminal.body)}</p>}
        </div>

        <div className="concourse-block">
          <h3>{t({ zh: "保持聯絡", en: "Get in touch" })}</h3>
          <div className="concourse-links">
            {terminal.contacts?.map((c) => (
              <a key={c.label} className="concourse-link" href={c.href} target="_blank" rel="noopener">
                {c.label} <Icon name="external" />
              </a>
            ))}
            {terminal.link && (
              <a className="concourse-link" href={terminal.link} target="_blank" rel="noopener">
                {t({ zh: "履歷 PDF", en: "Résumé PDF" })} <Icon name="play" />
              </a>
            )}
          </div>
        </div>

        <footer className="concourse-footer">
          <span>© 2026 蔡守傑 NoopyCai</span>
          <span>{t({ zh: "夜車・區間 · 感謝搭乘", en: "Night Local · thanks for riding" })}</span>
        </footer>
      </div>
    </section>
  );
}

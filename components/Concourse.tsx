"use client";
import { useEffect, useState } from "react";
import { useLang } from "./LangProvider";
import { ABOUT, STATIONS, type Station } from "@/content/stations";
import type { Bi } from "@/content/i18n";
import { Icon } from "./Icon";
import { jumpToStation } from "@/lib/scroll";

// 出站大廳的站名牌。曾經有一個 `primary` 開關,因為 ScrollJourney 的轉場疊層會再渲染
// 一份(那份要降成 <p> 才不會同時存在兩個 h1)。疊層已經刪掉 —— 大廳自己就是簾幕 ——
// 所以這裡永遠是全站唯一的 h1。
export function ConcourseHero() {
  const { t } = useLang();
  return (
    <div className="concourse-hero">
      {/* CONCOURSE 降為方位小標(站內指示牌的層級),名字才是站名牌 */}
      <p className="eyebrow-sign">CONCOURSE</p>
      <h1 className="h1-sign">NoopyCai</h1>
      <p className="h1-role">
        {t({ zh: "Software Engineer · 前端 / 全端", en: "Software Engineer · Frontend / Full-stack" })}
      </p>
    </div>
  );
}

// 時刻表「停靠內容」欄。專案站用 subtitle(它本來就是技術路線的一行摘要),
// 沒有就退回 tags 前三項;非專案站給固定描述 —— 它們沒有 subtitle,也不該為了
// 一張表就在 STATIONS 裡多養一份文案。
const STOP_FALLBACK: Record<string, Bi> = {
  hero: { zh: "旅程起點 · 自我介紹", en: "Start of the line · who I am" },
  skills: { zh: "前端 / 後端 / 資料 / 雲端 / AI", en: "Frontend / Backend / Data / Cloud / AI" },
  contact: { zh: "抵達終點 · 聯絡方式", en: "End of the line · get in touch" },
};

function stopText(s: Station): Bi {
  const p = s.panel;
  if (p.kind === "project") {
    if (p.subtitle) return p.subtitle;
    const joined = (p.tags ?? []).slice(0, 3).join(" · ");
    return { zh: joined, en: joined };
  }
  return STOP_FALLBACK[p.kind] ?? { zh: "", en: "" };
}

// 第三段文案裡的 "GitHub" 就地變成連結。文案本身留在 content/stations.ts(純字串),
// 元件只負責把那個字接上 href —— 不要為了一個連結把文案切成三段存起來。
function linkifyGithub(text: string, href: string): React.ReactNode {
  const parts = text.split("GitHub");
  if (parts.length < 2) return text;
  return parts.map((seg, i) =>
    i === 0 ? (
      seg
    ) : (
      <span key={i}>
        <a href={href} target="_blank" rel="noopener">GitHub</a>
        {seg}
      </span>
    ),
  );
}

// 出站大廳:轉身後的正常捲動區(站名牌 + 時刻表 + 關於 + 聯絡 + footer)。
// overlap = 這一頁有 pin 住的旅程,大廳要**上拉一個視口**與 stage 的最後一屏重疊,
// 自己當 exit 尾段的簾幕(見 globals.css 的 .concourse-overlap)。reduced-motion 拿到的
// 是 StaticFallback,沒有 stage 可以重疊 —— 那時上拉會直接吃掉降級版的最後一屏。
export function Concourse({ overlap = false }: { overlap?: boolean }) {
  const { t } = useLang();
  const terminal = STATIONS[STATIONS.length - 1].panel;
  const github = terminal.contacts?.find((c) => c.label === "GitHub")?.href ?? "https://github.com/NoopyCai";

  // 這一頁有沒有「車」可以跳回去?prefers-reduced-motion 的使用者拿到的是 StaticFallback,
  // 根本沒有 pin 的旅程 —— 那時整張表只是靜態內容,不能給游標/按鈕暗示可以點。
  // 判斷用 media query 而不是找 `.stage`:子元件的 effect 比 page.tsx 的先跑,
  // 那一刻畫面上還是首次渲染的 ScrollJourney(`.stage` 還在),會誤判成可點。
  // 掛載後才判定,SSR 出來的 HTML 一律不可點 —— 爬蟲拿到的仍是完整文字。
  const [rideable, setRideable] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setRideable(!mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <section className={overlap ? "concourse concourse-overlap" : "concourse"} aria-label={t({ zh: "出站大廳", en: "Concourse" })}>
      <div className="concourse-inner">
        <ConcourseHero />

        <div className="concourse-block">
          <h2 id="tt-title" className="tt-title">{`◄ ${t({ zh: "本日行駛紀錄", en: "TODAY'S SERVICE" })} DEPARTURES ►`}</h2>
          <table className="timetable" aria-labelledby="tt-title">
            <thead>
              <tr>
                <th scope="col" className="tt-no">{t({ zh: "序", en: "No." })}</th>
                <th scope="col">{t({ zh: "站名", en: "Station" })}</th>
                <th scope="col" className="tt-year">{t({ zh: "年份", en: "Year" })}</th>
                <th scope="col">{t({ zh: "停靠內容", en: "Calling at" })}</th>
                <th scope="col" className="tt-plat">{t({ zh: "月台", en: "Plat." })}</th>
              </tr>
            </thead>
            <tbody>
              {STATIONS.map((s, i) => {
                const name = t(s.name);
                const jump = () => jumpToStation(i, STATIONS.length);
                return (
                  <tr
                    key={s.id}
                    className={`tt-row${rideable ? " is-jumpable" : ""}`}
                    onClick={rideable ? jump : undefined}
                  >
                    <td className="tt-no">{String(i + 1).padStart(2, "0")}</td>
                    <td className="tt-station">
                      {rideable ? (
                        <button
                          type="button"
                          className="tt-jump"
                          aria-label={t({ zh: `回到「${name}」這一站`, en: `Ride back to ${name}` })}
                          onClick={(e) => {
                            e.stopPropagation(); // 列本身也有 onClick,不要跳兩次
                            jump();
                          }}
                        >
                          {name}
                        </button>
                      ) : (
                        name
                      )}
                    </td>
                    <td className="tt-year">{s.panel.year ?? "·"}</td>
                    <td className="tt-stop">{t(stopText(s))}</td>
                    <td className="tt-plat">{s.platform}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="concourse-block">
          <h2>{t({ zh: "關於我", en: "About" })}</h2>
          {ABOUT.map((para, i) => (
            <p key={i}>{i === ABOUT.length - 1 ? linkifyGithub(t(para), github) : t(para)}</p>
          ))}
        </div>

        <div className="concourse-block">
          <h2>{t({ zh: "保持聯絡", en: "Get in touch" })}</h2>
          <div className="concourse-links">
            {terminal.contacts?.map((c) => (
              <a key={c.label} className="concourse-link" href={c.href} target="_blank" rel="noopener">
                {c.label} <Icon name="external" />
              </a>
            ))}
          </div>
          {/* 履歷入口:台鐵名片式車票(擬真 + 一點玩味)。整張是一個 <a>,
              點了在新分頁開 PDF —— 不加 download,讓瀏覽器自己決定內開或下載。 */}
          {terminal.link && (
            <a className="ticket" href={terminal.link} target="_blank" rel="noopener">
              <span className="ticket-head">
                <span>{t({ zh: "區間 LOCAL", en: "LOCAL" })}</span>
                <span className="ticket-no">NO. 2026-0001</span>
              </span>
              <span className="ticket-route">
                {t({ zh: "求職中", en: "Job Hunting" })}
                <span className="ticket-arrow">►</span>
                {t({ zh: "貴公司", en: "Your Company" })}
              </span>
              <span className="ticket-meta">
                <span>2026.--.--</span>
                <span>{t({ zh: "票價 · 面談後議", en: "Fare · negotiable" })}</span>
              </span>
              <span className="ticket-note">{t({ zh: "憑本票下載履歷 PDF", en: "Valid for one résumé PDF" })}</span>
            </a>
          )}
        </div>

        <footer className="concourse-footer">
          <span>© 2026 蔡守傑 NoopyCai</span>
          <span>{t({ zh: "夜車・區間 · 感謝搭乘", en: "Night Local · thanks for riding" })}</span>
        </footer>
      </div>
    </section>
  );
}

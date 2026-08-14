import type { Metadata } from "next";
import "./globals.css";
import { STATIONS } from "@/content/stations";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://noopy-portfolio.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "蔡守傑 NoopyCai · 夜車・區間 Portfolio",
  description:
    "台鐵夜車主題的前端/全端工程師作品集。Frontend / Full-stack engineer portfolio, night-train themed. Scroll to ride through my work.",
  keywords: [
    "蔡守傑", "NoopyCai", "前端工程師", "全端工程師", "作品集",
    "frontend engineer", "full-stack engineer", "portfolio",
    "Next.js", "Vue", "GCP", "BigQuery", "LINE LIFF",
  ],
  authors: [{ name: "蔡守傑 NoopyCai" }],
  openGraph: {
    title: "蔡守傑 NoopyCai · 夜車・區間",
    description: "台鐵夜車主題作品集 · Night-train themed portfolio",
    type: "website",
    locale: "zh_TW",
  },
  twitter: { card: "summary_large_image", title: "蔡守傑 NoopyCai · 夜車・區間" },
};

// 結構化資料。h1 只顯示「NoopyCai」,中文全名的可搜尋性就靠這裡 + metadata + 關於我內文
// 三處保全(audit §10.3)。全部從 STATIONS 程式化產生,不另外養一份會過期的複本。
const contacts = STATIONS[STATIONS.length - 1].panel.contacts ?? [];
const projects = STATIONS.filter((s) => s.panel.kind === "project");
const knowsAbout = Array.from(
  new Set([
    ...STATIONS.flatMap((s) => s.panel.tags ?? []),
    ...STATIONS.flatMap((s) => s.panel.skills?.flatMap((g) => g.items) ?? []),
  ]),
);

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${SITE}#person`,
      name: "蔡守傑",
      alternateName: "NoopyCai",
      jobTitle: "Software Engineer",
      description: "電商領域的前端 / 全端工程師,能獨立負責從前端 UI 到伺服器端整合的完整開發流程。",
      url: SITE,
      email: contacts.find((c) => c.href.startsWith("mailto:"))?.href,
      sameAs: contacts.filter((c) => c.href.startsWith("http")).map((c) => c.href),
      knowsAbout,
      knowsLanguage: ["zh-Hant", "en"],
    },
    ...projects.map((s) => ({
      "@type": "CreativeWork",
      "@id": `${SITE}#${s.id}`,
      name: s.panel.title.zh,
      alternateName: s.panel.title.en,
      description: s.panel.impact?.zh ?? s.panel.body?.zh,
      abstract: s.panel.body?.zh,
      keywords: s.panel.tags?.join(", "),
      dateCreated: s.panel.year,
      inLanguage: "zh-Hant",
      creator: { "@id": `${SITE}#person` },
      author: { "@id": `${SITE}#person` },
    })),
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        {/* LED 字型:整站標示系統的字,第一屏就要用到 */}
        <link rel="preload" as="font" type="font/woff2" href="/fonts/DepartureMono-Regular.woff2" crossOrigin="anonymous" />
        {/* 車廂圖只有進 ride 相位才進 DOM,不 preload 的話第一次搭車必然看到 pop-in */}
        <link rel="preload" as="image" href="/cabin.jpg" fetchPriority="high" />
        <script
          type="application/ld+json"
          /* `<` 轉義:JSON 字串裡若出現 </script 會提前關掉這個標籤 */
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

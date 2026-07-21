import type { Metadata } from "next";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://noopy-portfolio.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "蔡守傑 NoopyCai — 夜車・區間 Portfolio",
  description:
    "台鐵夜車主題的前端/全端工程師作品集。Frontend / Full-stack engineer portfolio, night-train themed — scroll to ride through my work.",
  keywords: [
    "蔡守傑", "NoopyCai", "前端工程師", "全端工程師", "作品集",
    "frontend engineer", "full-stack engineer", "portfolio",
    "Next.js", "Vue", "GCP", "BigQuery", "LINE LIFF",
  ],
  authors: [{ name: "蔡守傑 NoopyCai" }],
  openGraph: {
    title: "蔡守傑 NoopyCai — 夜車・區間",
    description: "台鐵夜車主題作品集 · Night-train themed portfolio",
    type: "website",
    locale: "zh_TW",
  },
  twitter: { card: "summary_large_image", title: "蔡守傑 NoopyCai — 夜車・區間" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

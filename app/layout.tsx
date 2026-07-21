import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "蔡守傑 NoopyCai — 夜車・區間 Portfolio",
  description:
    "台鐵夜車主題的前端/全端工程師作品集。Frontend / Full-stack engineer portfolio, night-train themed.",
  openGraph: { title: "蔡守傑 NoopyCai — 夜車・區間", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

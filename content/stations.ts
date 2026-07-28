import type { Bi } from "./i18n";

export type SceneType = "platform" | "city" | "river" | "taipei" | "field" | "sea";
export type StationId =
  | "platform"
  | "recommendation"
  | "liff"
  | "ai"
  | "skills"
  | "terminal";
export type Grade = { filter: string; grade: string; blend: string };
export type Link = { label: string; href: string };
export type PanelData = {
  kind: "hero" | "project" | "skills" | "contact";
  title: Bi;
  subtitle?: Bi;
  body?: Bi;
  tags?: string[];
  metrics?: { n: string; label: Bi }[];
  link?: string;
  skills?: { group: Bi; items: string[] }[];
  contacts?: { label: string; href: string }[];
  // ── 作品站延伸欄位 ──
  year?: string; // 年份(時刻表感)
  role?: Bi; // 你的角色(獨立/團隊)
  impact?: Bi; // 到站廣播主句:一句話關鍵成果
  links?: Link[]; // 專案連結(repo / demo / case)
  detail?: { problem: Bi; approach: Bi; result: Bi }; // 「看細節」展開層
};
export type Station = {
  id: StationId;
  scene: SceneType;
  name: Bi;
  led: Bi;
  grade: Grade;
  panel: PanelData;
};

export const STATIONS: Station[] = [
  {
    id: "platform",
    scene: "platform",
    name: { zh: "月台・出發", en: "Platform" },
    led: { zh: "本次列車即將出發 · 車門關閉", en: "This service is departing · doors closing" },
    grade: { filter: "brightness(1) saturate(1)", grade: "rgba(120,150,190,0.16)", blend: "soft-light" },
    panel: {
      kind: "hero",
      title: { zh: "蔡守傑 NoopyCai", en: "NoopyCai" },
      subtitle: {
        zh: "Software Engineer · 前端 / 全端工程師",
        en: "Software Engineer · Frontend / Full-stack",
      },
      body: {
        zh: "在電商領域從事前後端開發,擅長把使用者體驗與數據追蹤深度結合,能獨立負責從前端 UI 到伺服器端整合的完整開發流程。",
        en: "Full-stack engineer in e-commerce. I blend UX with data, owning features from UI rendering to server-side integration end to end.",
      },
    },
  },
  {
    id: "recommendation",
    scene: "city",
    name: { zh: "電商推薦系統", en: "Recommendation System" },
    led: { zh: "下一站 電商推薦系統", en: "Next stop · Recommendation System" },
    grade: { filter: "brightness(1.06) saturate(1.12)", grade: "rgba(255,140,50,0.30)", blend: "soft-light" },
    panel: {
      kind: "project",
      title: { zh: "電商推薦系統", en: "Recommendation Engine" },
      subtitle: { zh: "BigQuery ML · GCP Pipeline · Real-time API", en: "BigQuery ML · GCP Pipeline · Real-time API" },
      body: {
        zh: "獨立打造完整推薦系統:Top Sale 熱銷、I2I 隱式矩陣分解相似商品、即時個人化推薦。Cloud Pub/Sub → BigQuery → Redis 自動化資料管線,從訂單分析到上線服務一條龍。",
        en: "Built an end-to-end recommender solo: top-sellers, I2I implicit matrix factorization, real-time personalization — with an automated Pub/Sub → BigQuery → Redis pipeline from order analytics to live serving.",
      },
      tags: ["BigQuery ML", "GCP", "Node.js", "Redis", "Pub/Sub", "SGTM"],
      metrics: [
        { n: "3", label: { zh: "推薦策略", en: "strategies" } },
        { n: "Top20", label: { zh: "分類熱銷", en: "per category" } },
        { n: "RT", label: { zh: "即時個人化", en: "real-time" } },
      ],
      year: "2024", // TODO: 確認實際年份
      role: { zh: "獨立開發", en: "Solo build" },
      impact: { zh: "3 種推薦策略 × 即時個人化,訂單分析到上線一條龍", en: "3 strategies × real-time personalization, analytics-to-serving end to end" },
      // TODO: 有可公開的成效數字(如點擊率/轉換提升)時,補進 impact 更有力
      // links: [{ label: "Demo", href: "…" }],  // TODO: 有可公開連結再補
      detail: {
        problem: { zh: "電商想提升轉換,卻缺乏個人化推薦與自動化資料流。", en: "E-commerce needed higher conversion but lacked personalized recommendations and an automated data pipeline." },
        approach: { zh: "用 BigQuery ML 建 Top Sale 熱銷與 I2I 隱式矩陣分解相似商品,搭 Cloud Pub/Sub → BigQuery → Redis 自動化管線,對外提供即時推薦 API。", en: "Built top-sellers and I2I implicit matrix factorization on BigQuery ML, with a Cloud Pub/Sub → BigQuery → Redis pipeline and a real-time recommendation API." },
        result: { zh: "三種推薦策略上線:分類熱銷 Top20 + 即時個人化,從訂單分析到服務串接一條龍完成。", en: "Shipped three strategies — per-category top-20 plus real-time personalization — end to end from order analytics to live serving." },
      },
    },
  },
  {
    id: "liff",
    scene: "river",
    name: { zh: "LINE LIFF 會員綁定", en: "LINE LIFF Binding" },
    led: { zh: "下一站 LINE LIFF 會員綁定", en: "Next stop · LINE LIFF Binding" },
    grade: { filter: "brightness(0.72) saturate(0.85)", grade: "rgba(30,60,120,0.34)", blend: "multiply" },
    panel: {
      kind: "project",
      title: { zh: "LINE LIFF × Magento2 會員綁定", en: "LINE LIFF × Magento2 Binding" },
      subtitle: { zh: "Vue3 SPA · Serverless · AES / OTP", en: "Vue3 SPA · Serverless · AES / OTP" },
      body: {
        zh: "橋接 LINE(LIFF / Messaging API)與 Magento2,實現社群帳號與電商會員無縫綁定。Vue3+Vite SPA、GCF Serverless API、AES-256 時效登入 Token + Email OTP、業務員 QR 邀請導流。",
        en: "Bridged LINE (LIFF / Messaging API) with Magento2 for seamless member binding. Vue3+Vite SPA, GCF serverless API, AES-256 timed auto-login tokens + Email OTP, and a sales-rep QR invite funnel.",
      },
      tags: ["Vue3", "Vite", "LINE LIFF", "GCF", "Redis", "MySQL", "GTM"],
      metrics: [
        { n: "AES-256", label: { zh: "時效登入", en: "auto-login" } },
        { n: "OTP", label: { zh: "Email 驗證", en: "email verify" } },
      ],
      year: "2024", // TODO: 確認實際年份
      role: { zh: "獨立開發", en: "Solo build" },
      impact: { zh: "社群帳號 × 電商會員無縫綁定,一鍵時效自動登入", en: "Seamless LINE↔member binding with one-tap timed auto-login" },
      // links: [{ label: "Demo", href: "…" }],  // TODO: 有可公開連結再補
      detail: {
        problem: { zh: "LINE 社群流量與 Magento2 電商會員各自獨立,難以整合行銷與登入。", en: "LINE social traffic and Magento2 members were siloed, blocking unified marketing and login." },
        approach: { zh: "以 Vue3+Vite LIFF SPA 串接 LINE 與 Magento2,GCF Serverless API、AES-256 時效登入 Token、Email OTP,並設計業務員 QR 邀請導流。", en: "Bridged LINE and Magento2 with a Vue3+Vite LIFF SPA, GCF serverless API, AES-256 timed tokens, Email OTP, and a sales-rep QR invite funnel." },
        result: { zh: "社群帳號與電商會員無縫綁定,支援一鍵時效自動登入;業務可用 QR 直接導客綁定。", en: "Seamless member binding with one-tap timed auto-login; sales reps onboard customers via QR." },
      },
    },
  },
  {
    id: "ai",
    scene: "taipei",
    name: { zh: "AI 工具整合", en: "AI Automation" },
    led: { zh: "下一站 AI 工具整合 · 台北", en: "Next stop · AI Automation · Taipei" },
    grade: { filter: "brightness(1.5) contrast(1.05) saturate(0.95)", grade: "rgba(205,225,245,0.18)", blend: "screen" },
    panel: {
      kind: "project",
      title: { zh: "AI 工具整合", en: "AI Automation Toolkit" },
      subtitle: { zh: "Claude Code · Gemini · SDD", en: "Claude Code · Gemini · SDD" },
      body: {
        zh: "把 AI 導入工作流:AI 週報系統(Gemini 摘要 RSS→PDF→Google Chat)、AI Blog 內容工具(Doc→HTML、圖片 ALT 生成,省 8 成手刻時間)、AI 商品資料匯出(JSONL 供檢索)。",
        en: "Brought AI into the workflow: an AI weekly-report system (Gemini summarizes RSS → PDF → Google Chat), an AI blog content tool (Doc→HTML + ALT generation, ~80% less hand-coding), and JSONL product export for retrieval.",
      },
      tags: ["Claude Code", "Gemini", "Node.js", "GCP", "SDD"],
      metrics: [{ n: "80%", label: { zh: "省手刻時間", en: "less hand-coding" } }],
      year: "2025", // TODO: 確認實際年份
      role: { zh: "獨立開發", en: "Solo build" },
      impact: { zh: "把 AI 導入工作流,內容產製省約 8 成手刻時間", en: "Brought AI into the workflow — ~80% less hand-coding" },
      detail: {
        problem: { zh: "週報、Blog 內容與商品資料整理耗費大量重複人工。", en: "Weekly reports, blog content, and product data all cost heavy repetitive manual work." },
        approach: { zh: "用 Gemini / Claude Code 建三套工具:AI 週報(RSS→摘要→PDF→Google Chat)、Blog 內容工具(Doc→HTML + 圖片 ALT 生成)、商品資料 JSONL 匯出供檢索。", en: "Built three tools with Gemini / Claude Code: an AI weekly report (RSS→summary→PDF→Google Chat), a blog content tool (Doc→HTML + ALT generation), and JSONL product export for retrieval." },
        result: { zh: "內容產製省約 8 成手刻時間,週報自動摘要並定時推送。", en: "~80% less hand-coding in content production, with automated summarized weekly reports on schedule." },
      },
    },
  },
  {
    id: "skills",
    scene: "field",
    name: { zh: "技能車廂", en: "Tech Stack" },
    led: { zh: "技能車廂 · Frontend / Backend / Data / AI", en: "Skills car · Frontend / Backend / Data / AI" },
    grade: { filter: "brightness(1.08) saturate(1.15)", grade: "rgba(255,170,70,0.24)", blend: "soft-light" },
    panel: {
      kind: "skills",
      title: { zh: "技術棧", en: "Tech Stack" },
      skills: [
        { group: { zh: "前端", en: "Frontend" }, items: ["HTML5", "CSS3", "ES6+", "Vue3", "jQuery", "GSAP"] },
        { group: { zh: "後端", en: "Backend" }, items: ["Node.js", "PHP", "Python", "Express", "REST API"] },
        { group: { zh: "資料 / 數據", en: "Data" }, items: ["MySQL", "Redis", "BigQuery", "GA4", "GTM/SGTM", "A/B Testing"] },
        { group: { zh: "雲 / 平台", en: "Cloud" }, items: ["GCP (Run/Functions/PubSub/Scheduler)", "Magento2", "Vercel"] },
        { group: { zh: "AI / 流程", en: "AI / Process" }, items: ["Claude Code", "Gemini", "SDD", "TDD"] },
      ],
    },
  },
  {
    id: "terminal",
    scene: "sea",
    name: { zh: "終點站・聯絡", en: "Terminal · Contact" },
    led: { zh: "終點站 到了 · 感謝搭乘", en: "Terminal · thanks for riding" },
    grade: { filter: "brightness(1.03) saturate(1.05)", grade: "rgba(255,150,170,0.22)", blend: "soft-light" },
    panel: {
      kind: "contact",
      title: { zh: "抵達終點・保持聯絡", en: "End of the line · let's talk" },
      body: {
        zh: "對遠端工作有意願,希望地點台北/新北。歡迎聊聊前端/全端機會。",
        en: "Open to remote; based around Taipei. Happy to chat about frontend / full-stack roles.",
      },
      contacts: [
        { label: "popparty3310@gmail.com", href: "mailto:popparty3310@gmail.com" },
        { label: "GitHub", href: "https://github.com/NoopyCai" },
        { label: "LinkedIn", href: "https://www.linkedin.com/in/noopy-cai-b1495737a" },
      ],
      link: "/resume/Noopy_resume2026.pdf",
    },
  },
];

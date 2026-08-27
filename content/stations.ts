import type { Bi } from "./i18n";

export type SceneType = "platform" | "city" | "river" | "taipei" | "field" | "sea";
export type StationId =
  | "platform"
  | "recommendation"
  | "liff"
  | "ai"
  | "skills"
  | "terminal";
// 燈光 grade:數值而非字串,因為它要被 lerpGrade 逐幀連續插值(字串只能在中點硬切,
// 那就是換站跳閃的來源)。filter 字串由 lib/progress.ts 的 gradeFilter() 組出來。
// contrast 選用(省略 = 1);目前六站都不需要,型別與插值邏輯留著等真的用得上那天。
export type Grade = { brightness: number; saturate: number; contrast?: number; tint: string };
// 六站統一的混合模式。一個燈光系統不該有三種合成模式 —— 舊版 multiply/screen/soft-light
// 混用,river(multiply 壓暗)→ taipei(screen 提亮)在轉場中點會直接彈一下(audit §3.2)。
// 要壓暗就把 tint 調暗、要提亮就調 brightness。
export const GRADE_BLEND = "soft-light";
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
  // 專案畫面截圖,只出現在「看細節」modal 的最上面(圖先給第一印象)。alt 要描述
  // 畫面內容而不是「專案截圖」——螢幕閱讀器使用者要的是資訊,不是檔名。
  screenshot?: { src: string; alt: Bi };
  // 系統架構圖(路線圖視覺語言,SVG)。只活在「看細節」modal 與 StaticFallback ——
  // 文字永不進 WebGL(既有紅線)。alt 要能讓螢幕閱讀器使用者讀懂資料流。
  diagram?: { src: string; alt: Bi };
};
export type Station = {
  id: StationId;
  scene: SceneType;
  name: Bi;
  led: Bi;
  grade: Grade;
  // 時刻表看板的「月台」欄。純主題性的月台代號(這是一列虛構的夜車),
  // 刻意不等於站序,不然那一欄只是把第一欄再寫一次。
  platform: string;
  // 時刻表看板的「狀態」欄:用行車狀態說專案狀態(上線 = 正點抵達、進行中 = 行駛中)
  status: Bi;
  panel: PanelData;
};

// 出站大廳「關於我」的三段。刻意**不再**抄站 1 與站 6 的 body —— 讀者剛看完六站,
// 逐字重讀一遍是 audit §6.2 的問題。三段各有職責:怎麼工作的 / 想找什麼 / 這個網站本身。
// 第三段的 "GitHub" 由 Concourse 就地變成連結(見該檔的 linkify)。
export const ABOUT: Bi[] = [
  {
    zh: "我是蔡守傑,在電商團隊同時照顧前端與資料兩端:白天調 Vue 元件的互動,晚上排 BigQuery 的推薦管線。能一個人把功能從 UI 一路做到伺服器端上線,是我最常被需要的原因。",
    en: "I'm NoopyCai. On an e-commerce team I work both ends: tuning Vue interactions by day, scheduling BigQuery recommendation pipelines by night. Owning a feature from UI to server-side launch is what teams rely on me for.",
  },
  {
    zh: "正在尋找前端或全端的角色,偏好產品導向、願意對成效負責的團隊。Base 台北/新北,對遠端友善的環境有加分。",
    en: "Looking for a frontend or full-stack role on a product-minded team that owns outcomes. Based around Taipei; remote-friendly is a plus.",
  },
  {
    zh: "這個網站也是作品:六站窗景由 canvas 逐像素即時繪製,車門過場是 three.js 場景,整趟旅程掛在同一個捲動標量上、倒著捲就倒著開。做法都在 GitHub。",
    en: "This site is itself a project: the window scenery is pixel-painted on canvas in real time, the doors are a three.js scene, and the whole ride hangs off a single scroll scalar · scroll back and the train runs backward. It's all on GitHub.",
  },
];

export const STATIONS: Station[] = [
  {
    id: "platform",
    scene: "platform",
    name: { zh: "月台・出發", en: "Platform" },
    led: { zh: "本次列車即將出發 · 車門關閉", en: "This service is departing · doors closing" },
    // 傍晚月台:冷藍,但月台燈池本身是暖的(場景裡畫的)。整條曲線的起點。
    grade: { brightness: 0.95, saturate: 1, tint: "rgba(120,150,190,0.16)" },
    platform: "1A",
    status: { zh: "本日始發", en: "First departure" },
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
    // 黃昏市郊:全程唯一的暖亮峰,天黑之前最後一段有色溫的光。
    grade: { brightness: 1.05, saturate: 1.12, tint: "rgba(255,140,50,0.30)" },
    platform: "2A",
    status: { zh: "正點抵達", en: "Arrived on time" },
    panel: {
      kind: "project",
      title: { zh: "電商推薦系統", en: "Recommendation Engine" },
      subtitle: { zh: "BigQuery ML · GCP Pipeline · Real-time API", en: "BigQuery ML · GCP Pipeline · Real-time API" },
      body: {
        zh: "熱銷排行與 I2I 隱式矩陣分解相似商品皆以 BigQuery ML 建模,再由 Cloud Pub/Sub → BigQuery → Redis 的自動化管線對外供即時推薦 API。",
        en: "Top-sellers and I2I implicit matrix factorization modelled on BigQuery ML, served through an automated Cloud Pub/Sub → BigQuery → Redis pipeline behind a real-time API.",
      },
      tags: ["BigQuery ML", "GCP", "Node.js", "Redis", "Pub/Sub", "SGTM"],
      year: "2025",
      role: { zh: "獨立開發", en: "Solo build" },
      impact: { zh: "3 種推薦策略 × 即時個人化,訂單分析到上線一條龍", en: "3 strategies × real-time personalization, analytics-to-serving end to end" },
      // TODO: 有可公開的成效數字(如點擊率/轉換提升)時,補進 impact 更有力
      // links: [{ label: "Demo", href: "…" }],  // TODO: 有可公開連結再補
      screenshot: {
        src: "/imgs/recommendation.jpg",
        alt: {
          zh: "電商商品頁的「你可能會喜歡」推薦區塊:一整列六張沙發商品卡,每張有商品名稱、折後價與被劃掉的原價。",
          en: "An e-commerce page's 'You may also like' row: six sofa recommendation cards, each with a product name, a discounted price, and the struck-through original price.",
        },
      },
      diagram: {
        src: "/diagrams/recommendation.svg",
        alt: {
          zh: "架構圖:訂單事件經 Cloud Pub/Sub 進 BigQuery,由 BigQuery ML 訓練熱銷與 I2I 相似商品模型,結果快取進 Redis,供 Node.js 推薦 API 即時服務商品頁。",
          en: "Architecture diagram: order events flow through Cloud Pub/Sub into BigQuery, BigQuery ML trains top-seller and I2I similarity models, results cache in Redis, and a Node.js API serves the storefront in real time.",
        },
      },
      detail: {
        problem: { zh: "電商想提升轉換,卻缺乏個人化推薦與自動化資料流。", en: "E-commerce needed higher conversion but lacked personalized recommendations and an automated data pipeline." },
        approach: { zh: "用 BigQuery ML 建 Top Sale 熱銷與 I2I 隱式矩陣分解相似商品,搭 Cloud Pub/Sub → BigQuery → Redis 自動化管線,對外提供即時推薦 API。", en: "Built top-sellers and I2I implicit matrix factorization on BigQuery ML, with a Cloud Pub/Sub → BigQuery → Redis pipeline and a real-time recommendation API." },
        result: { zh: "三種策略同時服務前台,推薦資料由訂單事件自動更新,不需人工重跑。", en: "All three strategies serve the storefront at once, refreshed automatically by order events with no manual reruns." },
      },
    },
  },
  {
    id: "liff",
    scene: "river",
    name: { zh: "LINE LIFF 會員綁定", en: "LINE LIFF Binding" },
    led: { zh: "下一站 LINE LIFF 會員綁定", en: "Next stop · LINE LIFF Binding" },
    // 深夜跨河:曲線的谷底。舊版靠 multiply 壓暗,改 soft-light 後改由 brightness 壓。
    grade: { brightness: 0.72, saturate: 0.85, tint: "rgba(30,60,120,0.34)" },
    platform: "2B",
    status: { zh: "正點抵達", en: "Arrived on time" },
    panel: {
      kind: "project",
      title: { zh: "LINE LIFF × Magento2 會員綁定", en: "LINE LIFF × Magento2 Binding" },
      subtitle: { zh: "Vue3 SPA · GCF Serverless · Magento2", en: "Vue3 SPA · GCF Serverless · Magento2" },
      body: {
        zh: "以 LIFF / Messaging API 串接 Magento2 會員系統,登入走 AES-256 時效 Token + Email OTP 雙軌驗證,另設計業務員專屬 QR 邀請導流。",
        en: "Wired LIFF / Messaging API into the Magento2 member system, with AES-256 timed tokens plus Email OTP for login and a dedicated sales-rep QR invite funnel.",
      },
      tags: ["Vue3", "Vite", "LINE LIFF", "GCF", "Redis", "MySQL", "GTM"],
      year: "2025",
      role: { zh: "獨立開發", en: "Solo build" },
      impact: { zh: "社群帳號 × 電商會員無縫綁定,一鍵時效自動登入", en: "Seamless LINE↔member binding with one-tap timed auto-login" },
      // links: [{ label: "Demo", href: "…" }],  // TODO: 有可公開連結再補
      screenshot: {
        src: "/imgs/line_liff.jpg",
        alt: {
          zh: "LINE LIFF 綁定完成畫面:綠色勾選圖示下方寫著「已綁定 · 您已是綁定會員」,再下面提示可以關閉此頁面,左右兩側是品牌吉祥物插畫。",
          en: "The LINE LIFF binding success screen: a green check mark above '已綁定' (linked) and a note that the page can now be closed, flanked by brand mascot illustrations.",
        },
      },
      diagram: {
        src: "/diagrams/line-liff.svg",
        alt: {
          zh: "架構圖:LINE App 使用者進入 LIFF(Vue3+Vite)SPA,經 GCF Serverless API 存取 Redis 與 MySQL 的 Token / 綁定資料,再串接 Magento2 會員系統;登入以 AES-256 時效 Token 加 Email OTP 驗證,另有業務員 QR 邀請支線完成歸戶。",
          en: "Architecture diagram: a LINE user opens the LIFF (Vue3+Vite) SPA, which calls a GCF serverless API backed by Redis and MySQL for tokens and binding data, wired into the Magento2 member system; login uses AES-256 timed tokens plus Email OTP, with a sales-rep QR invite branch for account binding.",
        },
      },
      detail: {
        problem: { zh: "LINE 社群流量與 Magento2 電商會員各自獨立,難以整合行銷與登入。", en: "LINE social traffic and Magento2 members were siloed, blocking unified marketing and login." },
        approach: { zh: "以 Vue3+Vite LIFF SPA 串接 LINE 與 Magento2,GCF Serverless API、AES-256 時效登入 Token、Email OTP,並設計業務員 QR 邀請導流。", en: "Bridged LINE and Magento2 with a Vue3+Vite LIFF SPA, GCF serverless API, AES-256 timed tokens, Email OTP, and a sales-rep QR invite funnel." },
        result: { zh: "會員可從 LINE 一鍵進入電商並保持登入態,業務員用 QR 就能當場完成導客綁定。", en: "Members enter the store from LINE in one tap and stay signed in; reps complete binding on the spot via QR." },
      },
    },
  },
  {
    id: "ai",
    scene: "taipei",
    name: { zh: "AI 工具整合", en: "AI Automation" },
    led: { zh: "下一站 AI 工具整合 · 台北", en: "Next stop · AI Automation · Taipei" },
    // 深夜台北:城市光害讓它比跨河那段微亮一點,但仍然是夜。舊版 brightness(1.5) + screen
    // 是全站最嚴重的對比崩壞來源,也是夜車敘事被打斷的地方(audit §1.2 / §3.1)。
    grade: { brightness: 0.86, saturate: 1.05, tint: "rgba(60,90,150,0.28)" },
    platform: "3A",
    status: { zh: "行駛中", en: "In service" },
    panel: {
      kind: "project",
      title: { zh: "AI 工具整合", en: "AI Automation Toolkit" },
      subtitle: { zh: "三套內部工具 · 週報 / 內容 / 商品資料", en: "Three internal tools · reports / content / catalog" },
      body: {
        zh: "週報系統由 Gemini 摘要 RSS 後產 PDF 推送 Google Chat;Blog 內容工具做 Doc→HTML 與圖片 ALT 生成;商品資料則匯出 JSONL 供檢索。",
        en: "The weekly report has Gemini summarize RSS into a PDF pushed to Google Chat; the blog tool does Doc→HTML and image ALT generation; the catalog exports JSONL for retrieval.",
      },
      tags: ["Claude Code", "Gemini", "Node.js", "GCP", "SDD"],
      year: "2026",
      role: { zh: "獨立開發", en: "Solo build" },
      impact: { zh: "把 AI 導入工作流,內容產製省約 8 成手刻時間", en: "Brought AI into the workflow, ~80% less hand-coding" },
      screenshot: {
        src: "/imgs/ai_news_hub.jpg",
        alt: {
          zh: "AI News Hub 內部工具的登入頁:左半是讀報吉祥物插畫,右半是「使用 Google 帳號登入」按鈕,下方註明僅限公司網域帳號。",
          en: "The AI News Hub internal tool sign-in page: a newspaper-reading mascot illustration on the left, a 'Sign in with Google' button on the right, restricted to company-domain accounts.",
        },
      },
      diagram: {
        src: "/diagrams/ai-tools.svg",
        alt: {
          zh: "架構圖:以公司 Google 網域帳號登入後分三條支線。週報由 Cloud Scheduler 排程抓 RSS,經 Gemini 摘要產 PDF 推送 Google Chat;Blog 支線把 Google Doc 轉 HTML 並生成圖片 ALT 後上稿;商品支線將商品資料匯出 JSONL 供檢索。",
          en: "Architecture diagram: after signing in with a company Google account, three branches run. A weekly report has Cloud Scheduler pull RSS, Gemini summarize it into a PDF pushed to Google Chat; a blog branch converts Google Docs to HTML with generated image ALT text before publishing; and a catalog branch exports product data as JSONL for retrieval.",
        },
      },
      detail: {
        problem: { zh: "週報、Blog 內容與商品資料整理耗費大量重複人工。", en: "Weekly reports, blog content, and product data all cost heavy repetitive manual work." },
        approach: { zh: "用 Gemini / Claude Code 建三套工具:AI 週報(RSS→摘要→PDF→Google Chat)、Blog 內容工具(Doc→HTML + 圖片 ALT 生成)、商品資料 JSONL 匯出供檢索。", en: "Built three tools with Gemini / Claude Code: an AI weekly report (RSS→summary→PDF→Google Chat), a blog content tool (Doc→HTML + ALT generation), and JSONL product export for retrieval." },
        result: { zh: "週報改為排程自動產出,Blog 上稿與商品資料整理不再需要逐篇手刻。", en: "Weekly reports now generate on a schedule; blog publishing and catalog prep no longer need per-item hand-coding." },
      },
    },
  },
  {
    id: "skills",
    scene: "field",
    name: { zh: "技能車廂", en: "Tech Stack" },
    led: { zh: "技能車廂 · Frontend / Backend / Data / AI", en: "Skills car · Frontend / Backend / Data / AI" },
    // 凌晨田野(blue hour):黎明前最暗的一段,只有零星農舍燈火。技能站放在這裡有隱喻。
    grade: { brightness: 0.8, saturate: 0.9, tint: "rgba(48,76,120,0.30)" },
    platform: "3B",
    status: { zh: "加開列車", en: "Extra service" },
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
    // 破曉海景:唯一的亮結尾。捲到底 = 搭了一夜車、天亮了。
    grade: { brightness: 1.03, saturate: 1.05, tint: "rgba(255,150,170,0.22)" },
    platform: "4A",
    status: { zh: "終點站", en: "Terminus" },
    panel: {
      kind: "contact",
      title: { zh: "抵達終點・保持聯絡", en: "End of the line · let's talk" },
      // 這張卡只留情緒收尾。聯絡方式與履歷改由出站大廳統一負責(唯一行動點),
      // 車廂裡再放一份等於同一件事講兩次,而且是壓在窗景上最難讀的那一份(audit §6.4)。
      // contacts / link 欄位刻意保留:StaticFallback 與 Concourse 都靠它們渲染。
      body: {
        zh: "天亮了,這趟車到這裡。謝謝你陪我坐完六站 · 聯絡方式在出站後的大廳,往下捲就到。",
        en: "Daylight, end of the line. Thanks for riding all six stops · you'll find how to reach me in the concourse just below.",
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

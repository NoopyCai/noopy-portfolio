# 夜車・區間 NIGHT LOCAL — 個人作品集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建一個台鐵 EMU900 夜車主題、捲動驅動的單頁作品集網站,還原 yukiasakura.com 的「從車窗看作品」互動——進站藍圖→Start ride→隨捲動行進、每站一個作品、車窗即時渲染在地風景、車內燈光隨窗外變化、LED 報站。

**Architecture:** Next.js App Router 單頁 client 應用。一個被 GSAP ScrollTrigger `pin` 住的全螢幕 `TrainStage`,由捲動進度 `p`(0→1)驅動三階段:Boot(綠色線稿車廂,車窗填滿)→ Gate(Start ride)→ Ride(全彩靜態車廂插畫 + 五/三扇 live 車窗 + 每站燈光分級 + LED 報站 + 作品內容面板)。窗景為 canvas 即時像素渲染(移植自可運作原型 `design-system/car-ride.html`);車廂本體為 AI 生成靜態插畫 `public/cabin.jpg`。`prefers-reduced-motion` 時降級為語意化直向區塊。

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript(strict)· GSAP 3 + ScrollTrigger · Web Audio · Vercel。無 CSS 框架(全域 CSS + CSS Modules)。字型:Departure Mono(OFL,LED/等寬)、Noto Sans TC(中文)。

## Global Constraints

- Next.js ≥ 15,React 19,TypeScript `strict: true`。
- 動畫只用 GSAP 3 免費版 + ScrollTrigger;不加其他動畫庫。
- 隱私:**只公開 Email / GitHub / LinkedIn;絕不放電話或住址**。
- 雙語:繁體中文(預設)+ English,可切換;所有面向使用者文字都要雙語。
- 品牌名:`蔡守傑 NoopyCai`。三個作品固定為:`電商推薦系統`、`LINE LIFF 會員綁定`、`AI 工具整合`。
- 車廂插畫用 `public/cabin.jpg`(由 `train_background.png` 轉出);車窗座標見 Task 3 常數,不得硬編散落各處。
- 站序固定:`platform → recommendation → liff → ai → skills → terminal`(6 站)。
- 配色 token(來自 `docs/tra-assets-survey.md`):`--green:#06ff31` `--bg:#1f241f` `--emu-green:#6eb43f`,其餘見 Task 1。
- 素材原創;**不得**使用 yukiasakura 的任何圖檔/字型;LED 字型用 Departure Mono(OFL)。
- 全站尊重 `prefers-reduced-motion: reduce`。
- 每個 task 結束都要能獨立測試(單元測試或瀏覽器目視驗證),並 commit。

---

## File Structure

```
noopy-portfolio/                     # git init here (尚未是 repo)
  package.json  tsconfig.json  next.config.mjs  .gitignore  vitest.config.ts
  public/
    cabin.jpg                        # 車廂插畫(train_background.png → jpg)
    fonts/DepartureMono-Regular.woff2
    resume/Noopy_resume2026.pdf      # 履歷下載(從 ~/Downloads 複製)
  content/
    stations.ts                      # 站點定義(id/名稱/LED/場景/燈光/作品資料)
    i18n.ts                          # zh/en 文案字典 + 型別
  lib/
    scene.ts                         # drawScene() 像素窗景渲染(移植自原型)
    progress.ts                      # 純函式:階段/站點/填滿/全景位移/燈光內插
  components/
    LangProvider.tsx  SoundToggle.tsx  LedSign.tsx  WireCar.tsx
    Window.tsx  CabinComposite.tsx  StationPanel.tsx
    ScrollJourney.tsx  StaticFallback.tsx
  app/
    layout.tsx  page.tsx  globals.css
  docs/superpowers/... (本計畫)
```

> 移植來源:`design-system/car-ride.html`(合成引擎:車廂圖+窗景+LED+燈光,已驗證)、`design-system/car.html`(WIRE 綠色線稿 SVG)、`design-system/window-gallery.html`(6 站 `drawScene` 場景)。這些是**可運作的參考實作**,對應 task 直接移植,不要重寫演算法。

---

## Task 1: 專案骨架 + 資產 + 設計 token

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `public/cabin.jpg`, `public/fonts/DepartureMono-Regular.woff2`, `public/resume/Noopy_resume2026.pdf`

**Interfaces:**
- Produces: 可跑的 `next dev`;`app/globals.css` 匯出 CSS 變數 token 供全站使用。

- [ ] **Step 1: git init + scaffold**

```bash
cd /Users/mrl001/noopy-portfolio
git init
npx create-next-app@latest . --ts --app --no-tailwind --no-src-dir --import-alias "@/*" --eslint --use-npm --no-turbopack
npm i gsap
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react
```

- [ ] **Step 2: 加資產**

```bash
# 車廂圖轉 jpg(品質 88,縮小內嵌無關,這是 public 靜態檔)
sips -s format jpeg -s formatOptions 88 train_background.png --out public/cabin.jpg
# 履歷
cp ~/Downloads/Noopy_resume2026.pdf public/resume/Noopy_resume2026.pdf
# Departure Mono 字型:從 https://departuremono.com/ 下載 woff2 放到 public/fonts/DepartureMono-Regular.woff2 (OFL)
```
若字型檔尚未下載,先留空並在 CSS `@font-face` 用 `local()` fallback 到等寬系統字。

- [ ] **Step 3: globals.css token**

```css
:root{
  --green:#06ff31; --bg:#1f241f; --emu-green:#6eb43f;
  --seat:#a6c4d8; --seat-pri:#e7a9bc; --amber:#f2c230;
  --text:#e9eff8; --muted:#8b98ad; --line:rgba(255,255,255,.08);
  --font-led:"Departure Mono",ui-monospace,"SF Mono",Menlo,monospace;
  --font-zh:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;
}
@font-face{font-family:"Departure Mono";src:url(/fonts/DepartureMono-Regular.woff2) format("woff2");font-display:swap}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:var(--font-zh);-webkit-font-smoothing:antialiased}
a{color:var(--green)}
```

- [ ] **Step 4: layout.tsx — metadata + 語言 provider slot**

```tsx
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "蔡守傑 NoopyCai — 夜車・區間 Portfolio",
  description: "台鐵夜車主題的前端/全端工程師作品集。Frontend / Full-stack engineer portfolio, night-train themed.",
  openGraph: { title: "蔡守傑 NoopyCai — 夜車・區間", type: "website" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="zh-Hant"><body>{children}</body></html>);
}
```

- [ ] **Step 5: 佔位 page + 跑起來**

`app/page.tsx`:
```tsx
export default function Home() { return <main style={{padding:40}}>夜車・區間 — booting…</main>; }
```
Run: `npm run dev` → 開 http://localhost:3000 → 應顯示「夜車・區間 — booting…」深色背景。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js night-local portfolio + assets + tokens"
```

---

## Task 2: 內容資料(stations + i18n)

**Files:**
- Create: `content/i18n.ts`, `content/stations.ts`
- Test: `content/stations.test.ts`

**Interfaces:**
- Produces:
  - `type Lang = "zh" | "en"`
  - `type Station = { id: StationId; scene: SceneType; name: Bi; led: Bi; grade: Grade; panel: PanelData }`
  - `STATIONS: Station[]`(長度 6,順序見 Global Constraints)
  - `type Bi = { zh: string; en: string }`
  - `type Grade = { filter: string; grade: string; blend: string }`(CSS filter / overlay 顏色 / mix-blend-mode)
  - `type SceneType = "platform"|"city"|"river"|"taipei"|"field"|"sea"`
  - `type StationId = "platform"|"recommendation"|"liff"|"ai"|"skills"|"terminal"`

- [ ] **Step 1: 失敗測試**

`content/stations.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STATIONS } from "./stations";
describe("STATIONS", () => {
  it("has 6 stations in fixed order", () => {
    expect(STATIONS.map(s => s.id)).toEqual(
      ["platform","recommendation","liff","ai","skills","terminal"]);
  });
  it("every station is bilingual and has a grade + scene", () => {
    for (const s of STATIONS) {
      expect(s.name.zh).toBeTruthy(); expect(s.name.en).toBeTruthy();
      expect(s.led.zh).toBeTruthy(); expect(s.led.en).toBeTruthy();
      expect(s.grade.filter).toMatch(/brightness/);
      expect(["platform","city","river","taipei","field","sea"]).toContain(s.scene);
    }
  });
  it("never exposes phone or address", () => {
    const blob = JSON.stringify(STATIONS);
    expect(blob).not.toMatch(/0900|四維路|五股/);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run content/stations.test.ts`
Expected: FAIL(`stations.ts` 不存在)。先建 `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins:[react()], test:{ environment:"jsdom", globals:true }});
```

- [ ] **Step 3: 寫 i18n.ts**

```ts
export type Lang = "zh" | "en";
export type Bi = { zh: string; en: string };
export const UI = {
  board:   { zh: "上車", en: "Board" },
  scroll:  { zh: "向下捲動,車廂通電亮起", en: "Scroll to begin the ride" },
  startRide:{ zh: "開始乘車", en: "Start ride" },
  sound:   { zh: "報站", en: "Announce" },
  contact: { zh: "聯絡我", en: "Contact" },
  resume:  { zh: "下載履歷 PDF", en: "Download résumé (PDF)" },
} satisfies Record<string, Bi>;
```

- [ ] **Step 4: 寫 stations.ts（真實履歷內容）**

```ts
import type { Bi } from "./i18n";
export type SceneType = "platform"|"city"|"river"|"taipei"|"field"|"sea";
export type StationId = "platform"|"recommendation"|"liff"|"ai"|"skills"|"terminal";
export type Grade = { filter: string; grade: string; blend: string };
export type PanelData = {
  kind: "hero"|"project"|"skills"|"contact";
  title: Bi; subtitle?: Bi; body?: Bi;
  tags?: string[]; metrics?: { n: string; label: Bi }[];
  link?: string; skills?: { group: Bi; items: string[] }[];
  contacts?: { label: string; href: string }[];
};
export type Station = { id: StationId; scene: SceneType; name: Bi; led: Bi; grade: Grade; panel: PanelData };

export const STATIONS: Station[] = [
  { id:"platform", scene:"platform",
    name:{zh:"月台・出發",en:"Platform"},
    led:{zh:"本次列車即將出發 · 車門關閉",en:"This service is departing · doors closing"},
    grade:{filter:"brightness(1) saturate(1)",grade:"rgba(120,150,190,0.16)",blend:"soft-light"},
    panel:{kind:"hero",title:{zh:"蔡守傑 NoopyCai",en:"NoopyCai"},
      subtitle:{zh:"Software Engineer · 前端 / 全端工程師",en:"Software Engineer · Frontend / Full-stack"},
      body:{zh:"在電商領域從事前後端開發,擅長把使用者體驗與數據追蹤深度結合,能獨立負責從前端 UI 到伺服器端整合的完整開發流程。",
            en:"Full-stack engineer in e-commerce. I blend UX with data, owning features from UI rendering to server-side integration end to end."}}},
  { id:"recommendation", scene:"city",
    name:{zh:"電商推薦系統",en:"Recommendation System"},
    led:{zh:"下一站 電商推薦系統",en:"Next stop · Recommendation System"},
    grade:{filter:"brightness(1.06) saturate(1.12)",grade:"rgba(255,140,50,0.30)",blend:"soft-light"},
    panel:{kind:"project",title:{zh:"電商推薦系統",en:"Recommendation Engine"},
      subtitle:{zh:"BigQuery ML · GCP Pipeline · Real-time API",en:"BigQuery ML · GCP Pipeline · Real-time API"},
      body:{zh:"獨立打造完整推薦系統:Top Sale 熱銷、I2I 隱式矩陣分解相似商品、即時個人化推薦。Cloud Pub/Sub → BigQuery → Redis 自動化資料管線,從訂單分析到上線服務一條龍。",
            en:"Built an end-to-end recommender solo: top-sellers, I2I implicit matrix factorization, real-time personalization — with an automated Pub/Sub → BigQuery → Redis pipeline from order analytics to live serving."},
      tags:["BigQuery ML","GCP","Node.js","Redis","Pub/Sub","SGTM"],
      metrics:[{n:"3",label:{zh:"推薦策略",en:"strategies"}},{n:"Top20",label:{zh:"分類熱銷",en:"per category"}},{n:"RT",label:{zh:"即時個人化",en:"real-time"}}]}},
  { id:"liff", scene:"river",
    name:{zh:"LINE LIFF 會員綁定",en:"LINE LIFF Binding"},
    led:{zh:"下一站 LINE LIFF 會員綁定",en:"Next stop · LINE LIFF Binding"},
    grade:{filter:"brightness(0.72) saturate(0.85)",grade:"rgba(30,60,120,0.34)",blend:"multiply"},
    panel:{kind:"project",title:{zh:"LINE LIFF × Magento2 會員綁定",en:"LINE LIFF × Magento2 Binding"},
      subtitle:{zh:"Vue3 SPA · Serverless · AES / OTP",en:"Vue3 SPA · Serverless · AES / OTP"},
      body:{zh:"橋接 LINE(LIFF / Messaging API)與 Magento2,實現社群帳號與電商會員無縫綁定。Vue3+Vite SPA、GCF Serverless API、AES-256 時效登入 Token + Email OTP、業務員 QR 邀請導流。",
            en:"Bridged LINE (LIFF / Messaging API) with Magento2 for seamless member binding. Vue3+Vite SPA, GCF serverless API, AES-256 timed auto-login tokens + Email OTP, and a sales-rep QR invite funnel."},
      tags:["Vue3","Vite","LINE LIFF","GCF","Redis","MySQL","GTM"],
      metrics:[{n:"AES-256",label:{zh:"時效登入",en:"auto-login"}},{n:"OTP",label:{zh:"Email 驗證",en:"email verify"}}]}},
  { id:"ai", scene:"taipei",
    name:{zh:"AI 工具整合",en:"AI Automation"},
    led:{zh:"下一站 AI 工具整合 · 台北",en:"Next stop · AI Automation · Taipei"},
    grade:{filter:"brightness(1.5) contrast(1.05) saturate(0.95)",grade:"rgba(205,225,245,0.18)",blend:"screen"},
    panel:{kind:"project",title:{zh:"AI 工具整合",en:"AI Automation Toolkit"},
      subtitle:{zh:"Claude Code · Gemini · SDD",en:"Claude Code · Gemini · SDD"},
      body:{zh:"把 AI 導入工作流:AI 週報系統(Gemini 摘要 RSS→PDF→Google Chat)、AI Blog 內容工具(Doc→HTML、圖片 ALT 生成,省 8 成手刻時間)、AI 商品資料匯出(JSONL 供檢索)。",
            en:"Brought AI into the workflow: an AI weekly-report system (Gemini summarizes RSS → PDF → Google Chat), an AI blog content tool (Doc→HTML + ALT generation, ~80% less hand-coding), and JSONL product export for retrieval."},
      tags:["Claude Code","Gemini","Node.js","GCP","SDD"],
      metrics:[{n:"80%",label:{zh:"省手刻時間",en:"less hand-coding"}}]}},
  { id:"skills", scene:"field",
    name:{zh:"技能車廂",en:"Tech Stack"},
    led:{zh:"技能車廂 · Frontend / Backend / Data / AI",en:"Skills car · Frontend / Backend / Data / AI"},
    grade:{filter:"brightness(1.08) saturate(1.15)",grade:"rgba(255,170,70,0.24)",blend:"soft-light"},
    panel:{kind:"skills",title:{zh:"技術棧",en:"Tech Stack"},
      skills:[
        {group:{zh:"前端",en:"Frontend"},items:["HTML5","CSS3","ES6+","Vue3","jQuery","GSAP"]},
        {group:{zh:"後端",en:"Backend"},items:["Node.js","PHP","Python","Express","REST API"]},
        {group:{zh:"資料 / 數據",en:"Data"},items:["MySQL","Redis","BigQuery","GA4","GTM/SGTM","A/B Testing"]},
        {group:{zh:"雲 / 平台",en:"Cloud"},items:["GCP (Run/Functions/PubSub/Scheduler)","Magento2","Vercel"]},
        {group:{zh:"AI / 流程",en:"AI / Process"},items:["Claude Code","Gemini","SDD","TDD"]}]}},
  { id:"terminal", scene:"sea",
    name:{zh:"終點站・聯絡",en:"Terminal · Contact"},
    led:{zh:"終點站 到了 · 感謝搭乘",en:"Terminal · thanks for riding"},
    grade:{filter:"brightness(1.03) saturate(1.05)",grade:"rgba(255,150,170,0.22)",blend:"soft-light"},
    panel:{kind:"contact",title:{zh:"抵達終點・保持聯絡",en:"End of the line · let's talk"},
      body:{zh:"對遠端工作有意願,希望地點台北/新北。歡迎聊聊前端/全端機會。",
            en:"Open to remote; based around Taipei. Happy to chat about frontend / full-stack roles."},
      contacts:[
        {label:"Email",href:"mailto:noopycai@mrliving.com.tw"},
        {label:"GitHub",href:"https://github.com/"},      // TODO: 換成真實網址
        {label:"LinkedIn",href:"https://www.linkedin.com/"}], // TODO: 換成真實網址
      link:"/resume/Noopy_resume2026.pdf"}},
];
```
> 注意:GitHub/LinkedIn 網址先留佔位,執行時向使用者確認真實網址再填。**不放電話/住址**(測試會擋)。

- [ ] **Step 5: 跑測試通過**

Run: `npx vitest run content/stations.test.ts` → Expected: PASS(3 個測試)。

- [ ] **Step 6: Commit**

```bash
git add content vitest.config.ts && git commit -m "feat(content): stations + i18n data from résumé (bilingual, no PII)"
```

---

## Task 3: 進度純函式 `lib/progress.ts`

**Files:**
- Create: `lib/progress.ts`
- Test: `lib/progress.test.ts`

**Interfaces:**
- Produces:
  - `WIN`: 車窗座標常數陣列(每項 `{left,top,w,h,r,pos}`,單位 % of 車廂圖),來自 `car-ride.html` 實測值。
  - `PHASE = { bootEnd: 0.10, gateEnd: 0.16 }`
  - `fillAmount(p:number):number` — Boot 期車窗填滿量 0→1。
  - `phaseOf(p:number): "boot"|"gate"|"ride"`
  - `rideProgress(p:number):number` — ride 期 0→1。
  - `stationAt(rp:number, n:number): { index:number; local:number }` — 目前站與站內 0→1。
  - `panoramaOffset(rp:number, span:number):number` — 連續全景位移(px),讓地標隨行進滑窗。
  - `lerpGrade(a:Grade,b:Grade,t:number):Grade` — 站間燈光內插(filter 用 cross-fade 以字串切換為主,grade 顏色做 rgba 內插)。

- [ ] **Step 1: 失敗測試**

`lib/progress.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fillAmount, phaseOf, rideProgress, stationAt } from "./progress";
describe("progress", () => {
  it("fillAmount ramps 0→1 across boot", () => {
    expect(fillAmount(0)).toBe(0);
    expect(fillAmount(0.05)).toBeCloseTo(0.5, 1);
    expect(fillAmount(0.10)).toBe(1);
    expect(fillAmount(0.5)).toBe(1);
  });
  it("phaseOf splits boot/gate/ride", () => {
    expect(phaseOf(0.05)).toBe("boot");
    expect(phaseOf(0.13)).toBe("gate");
    expect(phaseOf(0.9)).toBe("ride");
  });
  it("rideProgress 0 at gateEnd, 1 at end", () => {
    expect(rideProgress(0.16)).toBeCloseTo(0, 5);
    expect(rideProgress(1)).toBeCloseTo(1, 5);
  });
  it("stationAt maps ride progress to station index", () => {
    expect(stationAt(0, 6).index).toBe(0);
    expect(stationAt(0.99, 6).index).toBe(5);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npx vitest run lib/progress.test.ts` → FAIL。

- [ ] **Step 3: 實作 lib/progress.ts**

```ts
import type { Grade } from "@/content/stations";
export const PHASE = { bootEnd: 0.10, gateEnd: 0.16 } as const;
export const clamp = (v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth = (t:number)=>t*t*(3-2*t);

export function fillAmount(p:number){ return smooth(clamp(p / PHASE.bootEnd)); }
export function phaseOf(p:number){ return p < PHASE.bootEnd ? "boot" : p < PHASE.gateEnd ? "gate" : "ride"; }
export function rideProgress(p:number){ return clamp((p - PHASE.gateEnd) / (1 - PHASE.gateEnd)); }
export function stationAt(rp:number, n:number){
  const x = clamp(rp) * (n - 1);
  return { index: Math.round(x), local: x - Math.floor(x) };
}
export function panoramaOffset(rp:number, span:number){ return clamp(rp) * span; }

// 車窗座標(% of 車廂圖 public/cabin.jpg,1672×941,實測值)
export const WIN = [
  { left:31.2, top:32.7, w:37.6, h:32.9, r:"4% / 8%",  pos:"center"     }, // 中央窗
  { left:3.2,  top:34.5, w:6.9,  h:29.6, r:"26% / 8%", pos:"22% center" }, // 左窗
  { left:89.9, top:34.5, w:7.3,  h:29.6, r:"26% / 8%", pos:"78% center" }, // 右窗
] as const;
export const LED_RECT = { left:22.4, top:4.1, w:55.8, h:6.2 } as const;

function mixRgba(a:string,b:string,t:number){
  const p=(s:string)=>s.match(/[\d.]+/g)!.map(Number);
  const [ar,ag,ab,aa=1]=p(a), [br,bg,bb,ba=1]=p(b);
  const l=(x:number,y:number)=>Math.round(x+(y-x)*t);
  return `rgba(${l(ar,br)},${l(ag,bg)},${l(ab,bb)},${(aa+(ba-aa)*t).toFixed(3)})`;
}
export function lerpGrade(a:Grade,b:Grade,t:number):Grade{
  return { filter: t<0.5?a.filter:b.filter, grade: mixRgba(a.grade,b.grade,t), blend: t<0.5?a.blend:b.blend };
}
```

- [ ] **Step 4: 跑測試通過** — Run: `npx vitest run lib/progress.test.ts` → PASS(4)。

- [ ] **Step 5: Commit** — `git add lib && git commit -m "feat(progress): scroll-progress math + window/LED constants (tested)"`

---

## Task 4: 窗景渲染 `lib/scene.ts`(移植原型)

**Files:**
- Create: `lib/scene.ts`
- Test: `lib/scene.test.ts`

**Interfaces:**
- Produces: `drawScene(canvas: HTMLCanvasElement, type: SceneType, opts?: { bg?: boolean }): void` — 在 canvas 上以像素風渲染該站窗景;`bg:true` 時**略過**單一地標(月亮/太陽/101/漁舍/船/岬角),供側窗使用。

- [ ] **Step 1: 移植**

把 `design-system/car-ride.html` `<script>` 內的 `const bay=...` 與 `function drawScene(canvas,type,bg){ ... }`(含 `dith/PX/R/rnd/grad/disc` 內部輔助與 6 個 `if(type===...)` 分支)整段複製到 `lib/scene.ts`,加上 TS 型別與 export:
```ts
import type { SceneType } from "@/content/stations";
const bay=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
export function drawScene(canvas: HTMLCanvasElement, type: SceneType, opts: { bg?: boolean } = {}) {
  const bg = !!opts.bg;
  /* ← 貼上原型 drawScene 內容(K=2,W=208,H=130,DW,DH…到 6 個場景分支),
       把參數 canvas/type/bg 對應好即可,演算法一字不改。 */
}
```
> 這是**移植不是重寫**:原型已驗證正確(地標 bg 跳過、dither、天際線等)。保持像素邏輯不動。

- [ ] **Step 2: 失敗測試(冒煙 + 地標跳過)**

`lib/scene.test.ts`(jsdom + node-canvas 不一定可用 → 用最小 smoke:mock getContext 計數呼叫):
```ts
import { describe, it, expect, vi } from "vitest";
import { drawScene } from "./scene";
function fakeCanvas(){
  const calls:string[]=[];
  const ctx:any = new Proxy({}, { get:(_,k)=> (typeof k==="string" && k!=="canvas")
    ? (...a:any[])=>{calls.push(k);return undefined;} : undefined });
  return { canvas: { width:0,height:0, getContext:()=>ctx } as any, calls };
}
describe("drawScene", () => {
  it("draws without throwing and issues fill calls", () => {
    const {canvas,calls}=fakeCanvas();
    expect(()=>drawScene(canvas,"city")).not.toThrow();
    expect(calls.filter(c=>c==="fillRect").length).toBeGreaterThan(50);
  });
  it("bg mode issues fewer fills than full for 'sea' (skips sun/boat/headland)", () => {
    const a=fakeCanvas(); drawScene(a.canvas,"sea",{bg:false});
    const b=fakeCanvas(); drawScene(b.canvas,"sea",{bg:true});
    const cnt=(c:string[])=>c.filter(x=>x==="fillRect").length;
    expect(cnt(b.calls)).toBeLessThan(cnt(a.calls));
  });
});
```

- [ ] **Step 3: 跑測試** — Run: `npx vitest run lib/scene.test.ts` → PASS(調整 fakeCanvas 直到通過;若 Proxy 對 `imageSmoothingEnabled` 賦值報錯,於 ctx 加可寫屬性)。

- [ ] **Step 4: Commit** — `git add lib/scene.* && git commit -m "feat(scene): port pixel window-scenery renderer from prototype"`

---

## Task 5: 語言 Provider + LED + 音效元件

**Files:**
- Create: `components/LangProvider.tsx`, `components/LedSign.tsx`, `components/SoundToggle.tsx`
- Test: `components/LangProvider.test.tsx`

**Interfaces:**
- Produces:
  - `LangProvider`, `useLang(): { lang: Lang; t:(b:Bi)=>string; toggle:()=>void }`
  - `<LedSign text={string} />` — 紅/綠點陣跑馬燈(綠色,見 token)。
  - `<SoundToggle enabled onToggle />` + `playArrivalChime()`(Web Audio 合成叮咚)。

- [ ] **Step 1: 失敗測試(語言切換)**

`components/LangProvider.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LangProvider, useLang } from "./LangProvider";
function Probe(){ const {t,toggle,lang}=useLang();
  return <button onClick={toggle}>{lang}:{t({zh:"你好",en:"hi"})}</button>; }
describe("LangProvider", () => {
  it("defaults zh and toggles to en", () => {
    render(<LangProvider><Probe/></LangProvider>);
    const b=screen.getByRole("button");
    expect(b.textContent).toBe("zh:你好");
    fireEvent.click(b);
    expect(b.textContent).toBe("en:hi");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — Run: `npx vitest run components/LangProvider.test.tsx` → FAIL。

- [ ] **Step 3: 實作 LangProvider.tsx**

```tsx
"use client";
import { createContext, useContext, useState, useCallback } from "react";
import type { Lang, Bi } from "@/content/i18n";
const Ctx = createContext<{lang:Lang; t:(b:Bi)=>string; toggle:()=>void}>({lang:"zh",t:b=>b.zh,toggle:()=>{}});
export function LangProvider({children}:{children:React.ReactNode}){
  const [lang,setLang]=useState<Lang>("zh");
  const t=useCallback((b:Bi)=>b[lang],[lang]);
  const toggle=useCallback(()=>setLang(l=>l==="zh"?"en":"zh"),[]);
  return <Ctx.Provider value={{lang,t,toggle}}>{children}</Ctx.Provider>;
}
export const useLang=()=>useContext(Ctx);
```

- [ ] **Step 4: 跑測試通過** — Run: 同上 → PASS。

- [ ] **Step 5: 實作 LedSign.tsx**（移植 `led-sign.html` 的點陣遮罩 marquee）

```tsx
"use client";
export function LedSign({ text }: { text: string }) {
  const run = `◄ ${text} ►　`.repeat(3);
  return (
    <div className="led" aria-hidden>
      <div className="led-run">{run}</div>
      <style jsx>{`
        .led{position:relative;width:100%;height:100%;overflow:hidden;background:#050805;display:flex;align-items:center}
        .led-run{white-space:nowrap;font-family:var(--font-led);font-weight:700;font-size:clamp(9px,1.35vw,19px);
          letter-spacing:.12em;color:var(--green);text-shadow:0 0 6px rgba(6,255,49,.85);animation:m 20s linear infinite}
        @keyframes m{from{transform:translateX(28%)}to{transform:translateX(-72%)}}
        @media (prefers-reduced-motion:reduce){.led-run{animation:none}}
      `}</style>
    </div>
  );
}
```

- [ ] **Step 6: 實作 SoundToggle.tsx（Web Audio 合成,無版權）**

```tsx
"use client";
import { useRef, useState } from "react";
let actx: AudioContext | null = null;
export function playArrivalChime(){
  actx ??= new AudioContext();
  const now = actx.currentTime;
  [988,660].forEach((f,i)=>{ // 叮—咚
    const o=actx!.createOscillator(), g=actx!.createGain();
    o.type="sine"; o.frequency.value=f;
    o.connect(g); g.connect(actx!.destination);
    const s=now+i*0.18; g.gain.setValueAtTime(0,s);
    g.gain.linearRampToValueAtTime(0.25,s+0.02); g.gain.exponentialRampToValueAtTime(0.001,s+0.4);
    o.start(s); o.stop(s+0.42);
  });
}
export function SoundToggle(){
  const [on,setOn]=useState(false);
  return <button className="ctrl" aria-pressed={on}
    onClick={()=>{ setOn(v=>!v); if(!on) playArrivalChime(); }}>
    {on?"🔊":"🔇"} <span>報站 / Sound</span></button>;
}
```

- [ ] **Step 7: Commit** — `git add components && git commit -m "feat: LangProvider (tested) + LED marquee + Web Audio chime toggle"`

---

## Task 6: 綠色線稿車廂 `WireCar`(Boot 階段)

**Files:** Create: `components/WireCar.tsx`

**Interfaces:** Produces `<WireCar fill={number} />` — 0→1 控制車窗由左至右填滿綠色(Boot 動畫)。SVG 內容移植自 `design-system/car.html` 的 WIRE `<svg>`。

- [ ] **Step 1: 移植 SVG**（把 `car.html` 的 `.car` `<g>` 線稿 SVG 貼進來,`stroke:var(--green)`;窗內加一層可縮放的綠色填滿 rect,`transform:scaleX(fill)`,`transform-origin:left`)。

```tsx
"use client";
export function WireCar({ fill }: { fill: number }) {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet" style={{width:"100%",height:"100%"}}>
      {/* ← 貼上 car.html WIRE 線稿:LED框、拉桿、吊環、三窗、三叉立柱、座椅、博愛座標示,stroke=var(--green) */}
      {/* 三窗填滿層:每個窗一個 <g clip-path><rect fill=var(--green) style={{transform:`scaleX(${fill})`,transformBox:"fill-box",transformOrigin:"left"}}/></g> */}
    </svg>
  );
}
```

- [ ] **Step 2: 目視驗證** — 暫時在 `page.tsx` 放 `<WireCar fill={0.5}/>`,`npm run dev`,確認線稿車廂顯示、窗填滿一半綠色。截圖比對 `car.html`。

- [ ] **Step 3: Commit** — `git add components/WireCar.tsx && git commit -m "feat: green wireframe cabin (boot) with window fill"`

---

## Task 7: 單一車窗 `Window`（canvas 場景 + 位移）

**Files:** Create: `components/Window.tsx`

**Interfaces:** Produces `<Window scene={SceneType} rect={WIN[i]} bg={boolean} />` — 依 `rect`(%)絕對定位在車廂圖上,canvas 以 `drawScene` 繪製,`object-fit:cover` + `object-position:rect.pos` 顯示對應片段。

- [ ] **Step 1: 實作**

```tsx
"use client";
import { useEffect, useRef } from "react";
import { drawScene } from "@/lib/scene";
import type { SceneType } from "@/content/stations";
type Rect = { left:number;top:number;w:number;h:number;r:string;pos:string };
export function Window({ scene, rect, bg }: { scene: SceneType; rect: Rect; bg: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(()=>{ if(ref.current) drawScene(ref.current, scene, { bg }); }, [scene, bg]);
  return (
    <div style={{position:"absolute",left:`${rect.left}%`,top:`${rect.top}%`,width:`${rect.w}%`,height:`${rect.h}%`,
      overflow:"hidden",borderRadius:rect.r}}>
      <canvas ref={ref} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:rect.pos,imageRendering:"pixelated",display:"block"}}/>
    </div>
  );
}
```

- [ ] **Step 2: 目視驗證** — page 放三個 `<Window>` 對應 `WIN`,確認中央窗有地標、側窗 `bg` 無地標、對位在黑窗內。

- [ ] **Step 3: Commit** — `git add components/Window.tsx && git commit -m "feat: single train window (canvas scenery, positioned)"`

---

## Task 8: 車廂合成 `CabinComposite`（一站定格)

**Files:** Create: `components/CabinComposite.tsx`

**Interfaces:** Produces `<CabinComposite scene grade ledText />` — 靜態車廂圖 + 三扇 `Window`(idx0 中央=完整,其餘 bg)+ LED 覆蓋 + 燈光分級 overlay。移植自 `car-ride.html`。

- [ ] **Step 1: 實作**

```tsx
"use client";
import Image from "next/image";
import { WIN, LED_RECT } from "@/lib/progress";
import { Window } from "./Window";
import { LedSign } from "./LedSign";
import type { SceneType, Grade } from "@/content/stations";
export function CabinComposite({ scene, grade, ledText }:{ scene:SceneType; grade:Grade; ledText:string }) {
  return (
    <div style={{position:"relative",width:"100%",maxWidth:1180,margin:"0 auto",lineHeight:0}}>
      <img src="/cabin.jpg" alt="EMU900 車廂內裝 EMU900 train interior"
           style={{width:"100%",height:"auto",display:"block",filter:grade.filter,transition:"filter .8s ease"}}/>
      <div style={{position:"absolute",inset:0,pointerEvents:"none",background:grade.grade,mixBlendMode:grade.blend as any,transition:"background .8s ease"}}/>
      {WIN.map((r,i)=><Window key={i} scene={scene} rect={r} bg={i!==0}/>)}
      <div style={{position:"absolute",left:`${LED_RECT.left}%`,top:`${LED_RECT.top}%`,width:`${LED_RECT.w}%`,height:`${LED_RECT.h}%`}}>
        <LedSign text={ledText}/>
      </div>
    </div>
  );
}
```
> `next/image` 對 filter 不便,故用 `<img>`;把 `cabin.jpg` 放 `public/`。若要最佳化可改 next/image 但保留 filter wrapper。

- [ ] **Step 2: 目視驗證** — page 放 `<CabinComposite scene="city" grade={STATIONS[1].grade} ledText={STATIONS[1].led.zh}/>`,截圖比對 `car-ride.html` 效果(窗景、LED 蓋掉烤字、暖調)。

- [ ] **Step 3: Commit** — `git add components/CabinComposite.tsx && git commit -m "feat: static cabin composite (image + windows + LED + grade)"`

---

## Task 9: 捲動旅程 `ScrollJourney` + 階段串接

**Files:** Create: `components/ScrollJourney.tsx`; Modify: `app/page.tsx`

**Interfaces:** Produces `<ScrollJourney/>` — 建立高的 scroll section + `pin` 的 stage;用 GSAP ScrollTrigger `scrub` 取得 `p`;依 `phaseOf(p)` 切換 Boot(WireCar+fill)/Gate(Start ride)/Ride(CabinComposite 依 `stationAt` 切站 + `lerpGrade` 過渡 + 全景位移);同步顯示 `StationPanel`。

- [ ] **Step 1: 實作(核心 GSAP)**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STATIONS } from "@/content/stations";
import { phaseOf, fillAmount, rideProgress, stationAt, lerpGrade } from "@/lib/progress";
import { WireCar } from "./WireCar";
import { CabinComposite } from "./CabinComposite";
import { StationPanel } from "./StationPanel";
import { useLang } from "./LangProvider";
gsap.registerPlugin(ScrollTrigger);

export function ScrollJourney(){
  const wrap=useRef<HTMLDivElement>(null);
  const [p,setP]=useState(0);
  useEffect(()=>{
    const st=ScrollTrigger.create({
      trigger:wrap.current!, start:"top top", end:"+=6000", pin:".stage", scrub:0.5,
      onUpdate:(self)=>setP(self.progress),
    });
    return ()=>st.kill();
  },[]);
  const phase=phaseOf(p);
  const rp=rideProgress(p);
  const {index,local}=stationAt(rp, STATIONS.length);
  const cur=STATIONS[index], nxt=STATIONS[Math.min(index+1,STATIONS.length-1)];
  const grade=lerpGrade(cur.grade,nxt.grade,local);
  const {t}=useLang();
  return (
    <div ref={wrap} style={{height:"600vh",position:"relative"}}>
      <div className="stage" style={{position:"sticky",top:0,height:"100vh",overflow:"hidden",display:"grid",placeItems:"center",background:"var(--bg)"}}>
        {phase==="boot" && <div style={{width:"90%",maxWidth:1180}}><WireCar fill={fillAmount(p)}/></div>}
        {phase==="gate" && <button className="start">{t({zh:"開始乘車",en:"Start ride"})} ▸</button>}
        {phase==="ride" && <>
          <CabinComposite scene={cur.scene} grade={grade} ledText={t(cur.led)}/>
          <StationPanel station={cur} visible={local<0.6}/>
        </>}
      </div>
    </div>
  );
}
```
> `end:"+=6000"` 為捲動長度(px),之後可調。`stage` 由 ScrollTrigger pin。行進中「地標滑窗」在 v1 先用站間 `local` 切換場景 + grade 過渡達成;連續全景位移(panoramaOffset 傳入 Window 做 canvas 內 offset)列為 Task 9b 增強(見下)。

- [ ] **Step 2: 接進 page.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import { LangProvider } from "@/components/LangProvider";
import { ScrollJourney } from "@/components/ScrollJourney";
import { StaticFallback } from "@/components/StaticFallback";
export default function Home(){
  const [reduce,setReduce]=useState(false);
  useEffect(()=>{ setReduce(matchMedia("(prefers-reduced-motion:reduce)").matches); },[]);
  return <LangProvider>{reduce ? <StaticFallback/> : <ScrollJourney/>}</LangProvider>;
}
```

- [ ] **Step 3: 目視驗證** — `npm run dev`,捲動:先看到綠線稿填滿→Start ride→進入全彩車廂並隨捲動換站(燈光/LED/窗景變)。用瀏覽器截圖確認三階段。

- [ ] **Step 4: Commit** — `git add components/ScrollJourney.tsx app/page.tsx && git commit -m "feat: scroll-driven journey (boot→gate→ride) via ScrollTrigger"`

- [ ] **Step 5(增強 9b,可選):連續全景位移**

讓 `Window` 接受 `offset={panoramaOffset(rp,span)}`,在 `drawScene` 後用第二個 canvas 或 `object-position` 動態平移,使地標隨行進由中央窗滑向側窗。若時間有限,v1 用切站過渡即可,標記 `// ponytail: 站間硬切,連續滑窗待增強`。

---

## Task 10: 站點內容面板 `StationPanel`

**Files:** Create: `components/StationPanel.tsx`; add panel styles to `globals.css`

**Interfaces:** Produces `<StationPanel station={Station} visible={boolean} />` — 依 `panel.kind`(hero/project/skills/contact)渲染雙語內容,`visible` 控制淡入淡出。作品面板含標題、副標、說明、tech tags、metrics、連結。

- [ ] **Step 1: 實作**（依 `kind` switch;用 `useLang().t` 取雙語;hero 有「上車」CTA;contact 有 Email/GitHub/LinkedIn + 履歷下載;所有連結 `rel="noopener"`)。完整程式見附錄 A(本檔末)。

- [ ] **Step 2: 目視驗證** — 捲到各站確認面板內容正確、雙語切換正常、連結可點、無電話/住址。

- [ ] **Step 3: Commit** — `git add components/StationPanel.tsx app/globals.css && git commit -m "feat: bilingual station content panels"`

---

## Task 11: 到站音效 + 語言/音效控制列

**Files:** Modify: `components/ScrollJourney.tsx`; Create: `components/TopBar.tsx`

**Interfaces:** `<TopBar/>`(右上固定):語言切換 + SoundToggle。到站時(`local` 越過門檻且音效開啟)呼叫 `playArrivalChime()`。

- [ ] **Step 1: TopBar + 掛進 stage**（語言鈕呼叫 `useLang().toggle`;SoundToggle 見 Task 5)。
- [ ] **Step 2: 到站觸發**：在 ScrollJourney 用 `useRef` 記錄上一個 `index`,`index` 改變且音效開 → `playArrivalChime()`。
- [ ] **Step 3: 目視/聽覺驗證** — 開音效、捲動過站聽到叮咚;語言鈕切換全站文字。
- [ ] **Step 4: Commit** — `git commit -am "feat: top bar (lang + sound) and arrival chime on station change"`

---

## Task 12: 靜態降級 `StaticFallback` + 無障礙

**Files:** Create: `components/StaticFallback.tsx`

**Interfaces:** `prefers-reduced-motion` 或無 JS 時顯示語意化直向區塊:每站一個 `<section>`(標題、內容、靜態車廂圖或窗景截圖),含 `<h1>`~`<h2>` 階層、圖片 `alt`、可鍵盤操作、對比達 WCAG AA。

- [ ] **Step 1: 實作**（把 STATIONS 逐站渲染為 section;hero/project/skills/contact 用同 `StationPanel` 內容但直向排版;車窗可用 `<Window>` 靜態或預渲染 PNG）。
- [ ] **Step 2: 驗證** — Chrome DevTools 開 `prefers-reduced-motion: reduce`,確認顯示直向區塊、Tab 可走完所有連結、`axe` 無重大違規。
- [ ] **Step 3: Commit** — `git add components/StaticFallback.tsx && git commit -m "feat: reduced-motion static fallback + a11y"`

---

## Task 13: SEO / OG image / 部署設定

**Files:** Modify: `app/layout.tsx`; Create: `app/opengraph-image.tsx`(或 `public/og.png`)、`README.md`、`app/robots.ts`、`app/sitemap.ts`

- [ ] **Step 1:** `layout.tsx` metadata 補齊(繁中/英 description、`metadataBase`、OG image、`lang`)。
- [ ] **Step 2:** OG 圖:用車廂合成截一張 1200×630 放 `public/og.png`,metadata 指向它。
- [ ] **Step 3:** `README.md` 寫本機啟動、部署、資產來源與授權(字型 OFL、音效自製、車廂 AI 生成)。
- [ ] **Step 4:** `npm run build` 確認 production build 無錯。
- [ ] **Step 5: Commit** — `git commit -am "chore: SEO metadata, OG image, README, production build"`

---

## Task 14: 最終驗證 + 部署 Vercel

- [ ] **Step 1:** 跑全部測試 `npx vitest run` → 全綠。
- [ ] **Step 2:** `npm run build && npm start`,手動走一遍:Boot→Start ride→六站(窗景/燈光/LED/面板/音效/雙語)→終點聯絡;桌機 + 手機尺寸(RWD)。
- [ ] **Step 3:** 向使用者確認 GitHub/LinkedIn 真實網址,填入 `stations.ts` terminal.contacts。
- [ ] **Step 4:** 部署:`git push` 到 GitHub → Vercel import(或 `npx vercel`)。確認線上可跑。
- [ ] **Step 5: Commit / tag** — `git commit -am "chore: launch" && git tag v1.0`

---

## 附錄 A：StationPanel 參考實作

```tsx
"use client";
import { useLang } from "./LangProvider";
import type { Station } from "@/content/stations";
export function StationPanel({ station, visible }:{ station:Station; visible:boolean }) {
  const { t } = useLang();
  const p = station.panel;
  const style:React.CSSProperties = { position:"absolute", left:"6%", bottom:"9%", maxWidth:"42%",
    opacity:visible?1:0, transform:`translateY(${visible?0:16}px)`, transition:"opacity .5s, transform .5s",
    color:"var(--text)", textShadow:"0 2px 12px rgba(0,0,0,.6)" };
  return (
    <div style={style}>
      <div style={{fontFamily:"var(--font-led)",color:"var(--amber)",letterSpacing:".2em",fontSize:12}}>{t(station.name)}</div>
      <h2 style={{margin:"4px 0 8px",fontSize:"clamp(20px,3vw,34px)"}}>{t(p.title)}</h2>
      {p.subtitle && <div style={{fontFamily:"var(--font-led)",color:"var(--muted)",fontSize:13,marginBottom:10}}>{t(p.subtitle)}</div>}
      {p.body && <p style={{lineHeight:1.75,fontSize:15}}>{t(p.body)}</p>}
      {p.tags && <div style={{display:"flex",flexWrap:"wrap",gap:8,margin:"10px 0"}}>
        {p.tags.map(x=><span key={x} style={{fontFamily:"var(--font-led)",fontSize:11,color:"var(--green)",border:"1px solid rgba(6,255,49,.4)",borderRadius:999,padding:"4px 10px"}}>{x}</span>)}</div>}
      {p.metrics && <div style={{display:"flex",gap:22,margin:"8px 0"}}>
        {p.metrics.map((m,i)=><div key={i}><div style={{fontFamily:"var(--font-led)",fontWeight:700,fontSize:24,color:"var(--amber)"}}>{m.n}</div>
          <div style={{fontSize:11,color:"var(--muted)"}}>{t(m.label)}</div></div>)}</div>}
      {p.skills && <div style={{display:"grid",gap:8}}>
        {p.skills.map((g,i)=><div key={i}><b style={{color:"var(--emu-green)"}}>{t(g.group)}</b>：{g.items.join("、")}</div>)}</div>}
      {p.contacts && <div style={{display:"flex",gap:14,margin:"10px 0"}}>
        {p.contacts.map(c=><a key={c.label} href={c.href} rel="noopener" target="_blank">{c.label}</a>)}</div>}
      {p.link && <a href={p.link} target="_blank" rel="noopener" style={{fontFamily:"var(--font-led)",color:"var(--green)"}}>{t({zh:"下載履歷 PDF",en:"Résumé PDF"})} ▸</a>}
    </div>
  );
}
```

## 已知簡化 / 待增強(ponytail 標記)
- 連續「全景滑窗」(地標橫移到下一扇窗)v1 先用站間切換;Task 9b 增強。
- 側窗 `bg` 場景與中央窗共用亂數種子 → 樓群樣式可能相近;可加 per-window seed。
- 手機版:pin + 捲動在 iOS Safari 需測試;必要時降級為 snap 直向。

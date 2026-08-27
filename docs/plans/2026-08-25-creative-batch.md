# 創意批次實作計畫(內容線 + 生命感 + 傳播面)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 7 項採納提案落地——OG image、三張架構圖、車票履歷、時刻表狀態欄、玻璃倒影、LED 時鐘、gate 月台等車——且全程不破壞「不捲動 = GPU 零工作」。

**Architecture:** Batch A(靜態內容,4 任務)→ Batch B(場景動態,3 任務)→ Batch C(效能收官量測)。動態一律走「純捲動驅動」或「compositor-only CSS animation」,不新增任何 rAF。

**Tech Stack:** Next.js 15 / React 19 / three.js(既有 chunk)/ 純 CSS / vitest。OG 圖用系統 Chrome headless 截圖生成(零新依賴)。

**Spec:** `docs/specs/creative-batch-2026-08.md`(效能憲章 P1–P7 在該檔 §0,每個任務的驗收隱含它)

## Global Constraints

- **P2 不新增任何常駐 rAF**;既有 sway 迴圈是唯一例外,不動它。
- **P3 時間驅動動態一律 CSS animation**,限定相位、離開相位即移除節點。
- **P4** draw calls < 30、三角形 < 500;玻璃倒影只在隧道內 +1 draw call。
- **P6** 亮度變化 < 3Hz;gate 燈微顫週期 6.5s、opacity ≤ 0.02。
- **P7** og.png ≤ 200KB、三張 SVG 合計 ≤ 120KB、不新增 preload。
- 註解用繁體中文寫「為什麼」;樣式進 `globals.css` 既有 class 體系,**元件裡不新增排版用 inline style**(StaticFallback 既有 inline 風格除外,跟隨該檔)。
- 使用者可見字串不用 em-dash(—),用 `·`;不用 emoji。
- 雙語欄位 zh/en 同步,英文照邏輯重寫不機翻。
- commit 訊息繁體中文,結尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- **絕不在 `next dev` 開著時跑 `npm run build`**(CLAUDE.md 坑,會蓋掉 .next)。驗證順序:`npm test` + `npx tsc --noEmit` 為主;需要 build 時先殺 3000 埠。

---

### Task 1: OG image(script + metadata)

**Files:**
- Create: `scripts/og/og.html`(構圖,自包含)
- Create: `scripts/og/generate.sh`(Chrome headless 截圖 → `public/og.png`)
- Create: `public/og.png`(產物,進 repo)
- Modify: `app/layout.tsx`(metadata 補 images)
- Modify: `package.json`(scripts 加 `"og": "bash scripts/og/generate.sh"`)

**Interfaces:**
- Produces: `public/og.png`(1200×630);`metadata.openGraph.images` / `twitter.images`

- [ ] **Step 1: 寫構圖 HTML**

`scripts/og/og.html`——LED 看板構圖,字型直接指向 repo 裡的 woff2(相對路徑,Chrome 以 file:// 開啟時可讀):

```html
<!doctype html><meta charset="utf-8">
<style>
  @font-face { font-family: "Departure Mono"; src: url("../../public/fonts/DepartureMono-Regular.woff2") format("woff2"); }
  html, body { margin: 0; }
  body { width: 1200px; height: 630px; background: #070b12; overflow: hidden;
         display: grid; place-items: center; font-family: "Departure Mono", monospace; }
  .frame { text-align: center; }
  .line-top { color: #9fb0c8; font-size: 26px; letter-spacing: .35em; }
  .name { color: #ffb02e; font-size: 128px; margin: 28px 0 20px;
          text-shadow: 0 0 22px rgba(255, 176, 46, .55), 0 0 60px rgba(255, 176, 46, .25); }
  .role { color: #06ff31; font-size: 30px; letter-spacing: .22em;
          text-shadow: 0 0 14px rgba(6, 255, 49, .45); }
  .rail { position: absolute; left: 0; right: 0; height: 2px; background: rgba(159, 176, 200, .18); }
  .rail.t { top: 96px; } .rail.b { bottom: 96px; }
</style>
<div class="rail t"></div><div class="rail b"></div>
<div class="frame">
  <div class="line-top">◄ 夜車・區間 NIGHT LOCAL ►</div>
  <div class="name">NoopyCai</div>
  <div class="role">SOFTWARE ENGINEER · FRONTEND / FULL-STACK</div>
</div>
```

中文只出現在小標(掉回系統黑體可接受,主視覺是拉丁像素字)。實際色值以 `globals.css` 的 `--bg` / `--amber` / `--green` 為準,寫死進這個檔(它不吃站內 CSS)。

- [ ] **Step 2: 寫生成腳本**

`scripts/og/generate.sh`:

```bash
#!/usr/bin/env bash
# OG 圖生成:用系統 Chrome headless 截圖 —— 零新依賴,而且 woff2 像素字型的
# 光柵化就是瀏覽器本人,不會有 SVG rasterizer 吃不到字型的問題。
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --screenshot="../../public/og.png" \
  --window-size=1200,630 --hide-scrollbars --force-device-scale-factor=1 \
  "file://$PWD/og.html"
echo "og.png: $(du -h ../../public/og.png | cut -f1)"
```

- [ ] **Step 3: 跑腳本並檢查產物**

Run: `bash scripts/og/generate.sh && sips -g pixelWidth -g pixelHeight public/og.png`
Expected: 1200×630;檔案 ≤ 200KB(P7)。用 Read 工具看圖確認字型是像素字(不是 fallback 襯線)、發光正常。

- [ ] **Step 4: metadata 補 images**

`app/layout.tsx` 的 `openGraph` 物件加:

```ts
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "夜車・區間 · NoopyCai · Software Engineer" }],
```

`twitter` 物件加 `images: ["/og.png"]`。

- [ ] **Step 5: 驗證 + commit**

Run: `npx tsc --noEmit && npm test`
Expected: 全過。
Commit: `feat: OG image · LED 看板站名牌(傳播面,分享連結不再一片灰)`

---

### Task 2: 車票履歷(Concourse)

**Files:**
- Modify: `components/Concourse.tsx`(履歷入口換車票)
- Modify: `app/globals.css`(新 `.ticket-*` class 群)

**Interfaces:**
- Consumes: `terminal.link`(`/resume/Noopy_resume2026.pdf`)、`useLang` 的 `t()`

- [ ] **Step 1: 換掉履歷連結的 JSX**

`Concourse.tsx` 裡 `{terminal.link && (...)}` 那塊(現在是一顆 `.concourse-link` 膠囊)整塊換成台鐵名片式車票。車票排在 `.concourse-links` 膠囊列**之後**、自成一行:

```tsx
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
```

- [ ] **Step 2: 樣式**

`globals.css` 的 `.concourse-link` 區塊之後加(色值沿用既有 token):

```css
/* ── 車票履歷:台鐵名片式車票。虛線裁切邊與紋理全 CSS,不引資產 ── */
.ticket { display: block; width: min(420px, 100%); margin-top: 18px; padding: 14px 18px 12px;
  color: var(--text); text-decoration: none; border: 1px solid rgba(159, 176, 200, .35);
  border-radius: 6px; background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, .015) 0 2px, transparent 2px 4px),
    rgba(20, 27, 38, .92);
  transition: border-color .2s, box-shadow .2s, transform .2s; }
.ticket:hover { border-color: var(--amber); box-shadow: 0 0 16px rgba(255, 176, 46, .18); transform: rotate(0.4deg); }
.ticket:focus-visible { outline: 2px solid var(--green); outline-offset: 3px; }
.ticket-head { display: flex; justify-content: space-between; font-family: var(--font-led);
  font-size: 11px; letter-spacing: .18em; color: var(--muted);
  border-bottom: 1px dashed rgba(159, 176, 200, .3); padding-bottom: 8px; }
.ticket-route { display: flex; align-items: baseline; gap: 14px; font-size: 22px; padding: 12px 0 10px; }
.ticket-arrow { color: var(--amber); font-family: var(--font-led); font-size: 14px; }
.ticket-meta { display: flex; justify-content: space-between; font-family: var(--font-led);
  font-size: 12px; letter-spacing: .08em; color: var(--muted); }
.ticket-note { display: block; margin-top: 8px; font-size: 12px; color: var(--amber); }
@media (prefers-reduced-motion: reduce) { .ticket { transition: none; } .ticket:hover { transform: none; } }
@media (max-width: 640px) { .ticket-route { font-size: 18px; } }
```

- [ ] **Step 3: 驗證 + commit**

Run: `npx tsc --noEmit && npm test`,然後起 dev(3000 埠沒人用的話)手動看桌機與 390px 寬:車票橫式、點擊開 PDF、focus 有框。
Commit: `feat: 履歷入口改台鐵名片式車票(求職中 → 貴公司)`

---

### Task 3: 時刻表狀態欄

**Files:**
- Modify: `content/stations.ts`(`Station` 加 `status: Bi` + 六站資料)
- Modify: `components/Concourse.tsx`(表格加欄)
- Modify: `app/globals.css`(`.tt-status`)
- Test: `content/stations.test.ts`

**Interfaces:**
- Produces: `Station.status: Bi`(必填,六站都有)

> 措辭以使用者在內容確認輪定案的版本為準;下面是起草值,派工時如有更新以任務附帶的定案版覆蓋。

- [ ] **Step 1: 先寫測試(紅)**

`content/stations.test.ts` 加:

```ts
it("每一站都有雙語狀態(時刻表狀態欄)", () => {
  for (const s of STATIONS) {
    expect(s.status.zh.length, s.id).toBeGreaterThan(0);
    expect(s.status.en.length, s.id).toBeGreaterThan(0);
  }
});
```

Run: `npm test` → Expected: FAIL(`status` 不存在)。

- [ ] **Step 2: 型別 + 資料(綠)**

`stations.ts` 的 `Station` type 加:

```ts
  // 時刻表看板的「狀態」欄:用行車狀態說專案狀態(上線 = 正點抵達、進行中 = 行駛中)
  status: Bi;
```

六站(起草值):

| id | zh | en |
|---|---|---|
| platform | 本日始發 | First departure |
| recommendation | 正點抵達 | Arrived on time |
| liff | 正點抵達 | Arrived on time |
| ai | 行駛中 | In service |
| skills | 加開列車 | Extra service |
| terminal | 終點站 | Terminus |

Run: `npm test` → Expected: PASS。

- [ ] **Step 3: 表格加欄**

`Concourse.tsx` thead 在「月台」`<th>` 之前加:

```tsx
                <th scope="col" className="tt-st">{t({ zh: "狀態", en: "Status" })}</th>
```

tbody 對應位置(`tt-plat` 的 `<td>` 之前)加——「正點」用 LED 綠、其餘琥珀:

```tsx
                    <td className={`tt-st${t(s.status).includes("正點") || s.status.en.includes("on time") ? " is-ontime" : ""}`}>
                      {t(s.status)}
                    </td>
```

(語言無關的判斷:條件寫成 `s.status.en.includes("on time")` 一個就夠,zh 判斷刪掉。)

- [ ] **Step 4: 樣式(含手機 grid)**

`globals.css`:桌機沿用 LED 欄樣式;640px 以下時刻表是 grid(`auto 1fr auto`),狀態取代年份的右欄位置:

```css
.tt-row .tt-st { font-family: var(--font-led); font-size: 12px; letter-spacing: .08em; color: var(--amber); white-space: nowrap; }
.tt-row .tt-st.is-ontime { color: var(--green); }
```

640px 的 media block 裡(`.tt-row .tt-year { text-align: right; }` 那段)改成:

```css
  .tt-row .tt-year { display: none; } /* 窄幅讓位給狀態欄:年份在資訊卡裡有 */
  .tt-row .tt-st { text-align: right; }
```

- [ ] **Step 5: 驗證 + commit**

Run: `npx tsc --noEmit && npm test`;dev 下看 1440px 與 390px:無橫向溢出、狀態顏色語意正確。
Commit: `feat: 時刻表狀態欄 · 用行車狀態說專案狀態(正點抵達/行駛中/加開列車)`

---

### Task 4: 專案架構圖 ×3(等內容確認後派工)

**Files:**
- Create: `public/diagrams/recommendation.svg`、`public/diagrams/line-liff.svg`、`public/diagrams/ai-tools.svg`
- Modify: `content/stations.ts`(`PanelData` 加 `diagram`,三個專案站補資料)
- Modify: `components/StationPanel.tsx`(modal 裡渲染)
- Modify: `components/StaticFallback.tsx`(內容對等)
- Modify: `app/globals.css`(`.detail-diagram`)
- Test: `content/stations.test.ts`

**Interfaces:**
- Produces: `PanelData.diagram?: { src: string; alt: Bi }`

> **前置(硬條件)**:三張圖的節點/資料流清單已由使用者確認。派工訊息會附定案清單;圖上不得出現清單以外的元件名。

- [ ] **Step 1: 先寫測試(紅)**

`content/stations.test.ts` 加:

```ts
it("三個專案站都有架構圖,alt 是描述而不是檔名", () => {
  const projects = STATIONS.filter((s) => s.panel.kind === "project");
  for (const s of projects) {
    expect(s.panel.diagram?.src, s.id).toMatch(/^\/diagrams\/.+\.svg$/);
    expect(s.panel.diagram!.alt.zh.length, s.id).toBeGreaterThan(10);
    expect(s.panel.diagram!.alt.en.length, s.id).toBeGreaterThan(10);
  }
});
```

Run: `npm test` → Expected: FAIL。

- [ ] **Step 2: 型別 + 資料(綠)**

`PanelData` 的 `screenshot` 欄位旁加:

```ts
  // 系統架構圖(路線圖視覺語言,SVG)。只活在「看細節」modal 與 StaticFallback ——
  // 文字永不進 WebGL(既有紅線)。alt 要能讓螢幕閱讀器使用者讀懂資料流。
  diagram?: { src: string; alt: Bi };
```

三個專案站補 `diagram`(alt 依定案清單描述主資料流,例:「訂單事件經 Pub/Sub 進 BigQuery,由 BigQuery ML 訓練熱銷與 I2I 模型,結果快取進 Redis 供即時推薦 API」)。

Run: `npm test` → Expected: PASS。

- [ ] **Step 3: 畫三張 SVG**

視覺語言(三張一致):
- `viewBox="0 0 720 405"`(16:9);背景透明(modal 自帶深色底)。
- 節點 = 圓角矩形站牌(`rx=8`,描邊 `#9fb0c8` 40%、文字 `#e8edf4`);外部系統(LINE、Google Chat)用虛線描邊。
- 資料流 = 路線(主線 `#ffb02e` 寬 4、次線 `#9fb0c8` 寬 2),流向箭頭用 `►` 字元不用 marker(與站內箭頭語言一致)。
- API 邊界 = 轉乘站樣式(雙圈圓點)。
- 字:技術名詞 `font-family="Departure Mono, ui-monospace, monospace"`;中文標籤 `font-family="-apple-system, 'PingFang TC', sans-serif"`;最小字級 13(以 390px modal 寬實測可讀為準,塞不下就簡化圖)。
- 每張 ≤ 40KB,手寫 SVG 不用工具匯出(匯出品的 path 膨脹)。

內容 = 派工附帶的定案清單,一張一條主線 + 支線。

- [ ] **Step 4: modal 渲染**

`StationPanel.tsx` 的 detail rows(`problem/approach/result` 那段 `map`)之後加:

```tsx
            {p.diagram && (
              <div className="detail-diagram">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.diagram.src} alt={t(p.diagram.alt)} loading="lazy" />
              </div>
            )}
```

`StaticFallback.tsx` 在 `{p.body && ...}` 之後加(跟隨該檔 inline 風格):

```tsx
            {p.diagram && (
              <p><img src={p.diagram.src} alt={t(p.diagram.alt)} loading="lazy" style={{ maxWidth: "100%", height: "auto" }} /></p>
            )}
```

- [ ] **Step 5: 樣式**

`globals.css` 的 `.detail-shot` 附近加:

```css
/* 架構圖:圖本身可能寬於窄幅 modal,捲動限制在自己的容器裡,頁面本體不橫捲 */
.detail-diagram { margin-top: 18px; overflow-x: auto; }
.detail-diagram img { display: block; width: 100%; min-width: 480px; height: auto; }
```

- [ ] **Step 6: 驗證 + commit**

Run: `npx tsc --noEmit && npm test`;dev 下開三個站的「看細節」,390px 與 1440px 各看一次;`du -sh public/diagrams` ≤ 120KB(P7)。
Commit: `feat: 三張專案架構圖 · 路線圖視覺語言(站點=服務、線=資料流)`

---

### Task 5: 玻璃倒影(隧道段,唯一動場景的任務)

**Files:**
- Modify: `components/door3d/cabin.ts`

**Interfaces:**
- Consumes: `frame.tunnel.dim`(既有)、`place()` cover 幾何(既有)

倒影 = 一片 cover 尺寸的平面,貼**鏡像的牆貼圖**,擺在牆後、畫序在壓暗之後牆之前——透過窗洞露出,opacity 跟著 `tunnel.dim` 走。**純捲動驅動、零新增迴圈、只在隧道內 +1 draw call。**

- [ ] **Step 1: 常數與平面**

`Z` / `ORDER` 常數各加一項(`Z.reflect` 在 dim 與 wall 之間;`ORDER.reflect` 在 dim 之後、wall 之前 → 疊在壓暗上、被牆蓋住):

```ts
const Z = { far: -14, near: -11, platform: -9.5, dim: -9, reflect: -8.5, wall: -8, flash: -7.5, front: -6.5 } as const;
const ORDER = { far: -60, near: -59, platform: -58, dim: -57, reflect: -56, wall: -50, flash: -45, front: -40 } as const;
```

`createCabin` 裡(flash 平面之後)加:

```ts
  // 玻璃倒影(隧道段):窗外一暗,玻璃浮出車廂內部的鏡像。刻意不吃 grade shader ——
  // 倒影本來就該比實景灰,用 material.color 固定壓暗(basic material 的 color 是乘法)。
  const K_REFLECT = 0.22; // 「看得見但要注意才發現」;驗收時現場調
  const reflectMat = new MeshBasicMaterial({
    transparent: true, depthWrite: false, fog: false, opacity: 0, toneMapped: false,
    color: 0x9fb0c8, // 冷灰藍:夜間玻璃反射偏冷
  });
  const reflect = new Mesh(QUAD, reflectMat);
  reflect.position.z = Z.reflect;
  reflect.renderOrder = ORDER.reflect;
  reflect.visible = false;
  scene.add(reflect);
```

- [ ] **Step 2: 鏡像貼圖(零新記憶體)**

`loadImg("/cabin.jpg", ...)` callback 的 `onReady()` 之前加——clone 共用同一個 GPU source,負 repeat 就是水平鏡像:

```ts
    // 倒影共用牆貼圖(挖好洞、塗掉 LED 的那張):鏡像後窗洞區是透明 → 底下的壓暗
    // 透出來,讀起來就是「對面窗外是黑的」,物理上剛好正確。
    const rt = t.clone();
    rt.repeat.x = -1;
    rt.offset.x = 1;
    reflectMat.map = rt;
    reflectMat.needsUpdate = true;
```

- [ ] **Step 3: 每幀更新**

`update()` 裡、`flashMat.opacity` 那段之後加(`visible === false` 的早退分支也要把 `reflect.visible = false` 加進去):

```ts
      // 玻璃倒影:只在隧道內存在。opacity 為 0 時 three 仍會發 draw call,
      // 所以用 visible 切 —— 這一行是 P4(draw call 預算)的必要條件。
      const dimNow = tun ? tun.dim : 0;
      reflect.visible = reflectMat.map !== null && dimNow > 0.01;
      if (reflect.visible) {
        reflectMat.opacity = dimNow * K_REFLECT;
        place(reflect, pw, ph, 0, cy, Z.reflect);
      }
```

(後面三扇窗迴圈裡的 `const dimV = tun ? tun.dim : 0;` 可以改讀同一個 `dimNow`,少算一次。)

- [ ] **Step 4: 驗證 + commit**

Run: `npx tsc --noEmit && npm test`。dev 下捲到站間隧道段:倒影浮現且鏡像(海報字反向)、出隧道消失、倒捲對稱;`__door3d.stats()` 隧道外 draw calls 與改動前相同、隧道內 +1。
Commit: `feat: 隧道玻璃倒影 · 窗外一暗,玻璃浮出車廂的鏡像(純捲動驅動,+1 draw call)`

---

### Task 6: LED 時鐘

**Files:**
- Modify: `components/LedSign.tsx`(輪播插時間槽)
- Modify: `components/CabinFrame.tsx`(30s interval 直寫 textContent)

**Interfaces:**
- Produces: `LedSign` 新 prop `clock?: boolean`(預設 false,降級路徑 CabinComposite 不受影響)

- [ ] **Step 1: LedSign 加時間槽**

```tsx
"use client";

// 包夾用的 ◄ ► 維持字元而不是 SVG:它們跟著 LED 字型與綠色光暈(text-shadow)一起渲染,
// 換成 icon 會失去發光、字重也對不上跑馬燈的其他字。
export function LedSign({ text, clock = false }: { text: string; clock?: boolean }) {
  // 時間槽渲染占位 --:--,由 CabinFrame 直寫 textContent(不能在 render 讀時鐘:
  // SSR 與 client 的時間不同,會 hydration mismatch)。全數字 + 拉丁,避開
  // --font-led 無 CJK 的既有缺陷。
  const seg = (i: number) => (
    <span key={i}>
      {`◄ ${text} ►　`}
      {clock && <>{"◄ "}<span className="led-clock">--:--</span>{" ►　"}</>}
    </span>
  );
  return (
    <div className="led" aria-hidden>
      <div className="led-run">{[0, 1, 2].map(seg)}</div>
    </div>
  );
}
```

- [ ] **Step 2: CabinFrame 的更新器**

`CabinFrame.tsx` 改成:

```tsx
"use client";
import { useEffect } from "react";
import { WIN, LED_RECT } from "@/lib/progress";
import { LedSign } from "./LedSign";
```

元件內加 effect(在 return 之前),`LedSign` 呼叫改 `<LedSign text={ledText} clock />`:

```tsx
  // LED 時鐘:30 秒直寫三份 .led-clock 的 textContent —— 不走 setState,跑馬燈的
  // CSS 動畫不重啟、React 零 re-render。分頁掛起時 interval 停,回來立即重寫一次
  // (interval 恢復後只會從下一個 30s 開始,不重寫的話會顯示掛起前的舊時間)。
  useEffect(() => {
    const write = () => {
      const s = new Date().toTimeString().slice(0, 5);
      for (const el of document.querySelectorAll<HTMLElement>(".cabin-frame .led-clock")) el.textContent = s;
    };
    write();
    let id = window.setInterval(write, 30_000);
    const onVis = () => {
      clearInterval(id);
      if (!document.hidden) { write(); id = window.setInterval(write, 30_000); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);
```

- [ ] **Step 3: 驗證 + commit**

Run: `npx tsc --noEmit && npm test`。dev 下進車廂看跑馬燈輪播出現 `◄ 22:47 ►`;切分頁 2 分鐘回來,時間立即是對的。
Commit: `feat: LED 跑馬燈報時 · 深夜看履歷的人會在夜車上看到自己的深夜`

---

### Task 7: gate 月台等車

**Files:**
- Modify: `components/ScrollJourney.tsx`(gate 相位加氛圍層)
- Modify: `app/globals.css`(keyframes)

**Interfaces:**
- Consumes: `d.phase === "gate"` 條件渲染(既有;離開 gate 節點整組消失 = 動畫停,P3)

- [ ] **Step 1: gate 氛圍層 JSX**

`ScrollJourney.tsx` 的 `{d.phase === "gate" && (<button .../>)}` 改成 fragment,按鈕之前加氛圍層(按鈕自帶 z-index 8,氛圍層壓低):

```tsx
        {d.phase === "gate" && (
          <>
            {/* 月台等車的氛圍:頂棚燈微顫 + 對向列車每 ~10s 掠過一道亮帶。
                全部 CSS animation(compositor),離開 gate 相位節點整組消失 = 動畫停。
                月台本身不動 —— 你站著等車,動的是對面軌道的車。 */}
            <div className="gate-ambience" aria-hidden>
              <div className="gate-lamp" />
              <div className="gate-pass" />
            </div>
            <button
              ref={gateBtn}
              ...(原樣不動)
            </button>
          </>
        )}
```

- [ ] **Step 2: 樣式**

`globals.css` 的 `.start` 附近加:

```css
/* ── gate 月台氛圍。亮度紅線(WCAG 2.3.1):微顫 6.5s 一週期(~0.15Hz)、峰值 0.02,
   遠低於 3Hz / 10% 的危險門檻;亮帶是移動不是閃爍。 ── */
.gate-ambience { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; }
.gate-lamp { position: absolute; inset: 0; opacity: 0;
  background: radial-gradient(ellipse 70% 45% at 50% 6%, rgba(255, 190, 120, .5), transparent 70%);
  animation: gate-lamp 6.5s ease-in-out infinite; }
@keyframes gate-lamp { 0%, 100% { opacity: 0; } 50% { opacity: .02; } }
/* 對向列車:10s 一班,亮帶 1.2s 掃過(12% of 10s),其餘時間停在畫面外 */
.gate-pass { position: absolute; top: 14%; bottom: 34%; left: 0; width: 18vw;
  background: linear-gradient(90deg, transparent, rgba(160, 190, 230, .10) 35%, rgba(220, 235, 255, .16) 50%, rgba(160, 190, 230, .10) 65%, transparent);
  transform: translateX(-20vw);
  animation: gate-pass 10s linear infinite; }
@keyframes gate-pass { 0% { transform: translateX(-20vw); } 12% { transform: translateX(120vw); } 100% { transform: translateX(120vw); } }
@media (max-aspect-ratio: 4/5) { .gate-pass { width: 30vw; } } /* 直式手機 18vw 太細讀不到 */
@media (prefers-reduced-motion: reduce) { .gate-lamp, .gate-pass { animation: none; } }
```

- [ ] **Step 3: 驗證 + commit**

Run: `npx tsc --noEmit && npm test`。dev 下停在第一屏 15 秒:燈微顫幾乎無感、亮帶掃過一次;DevTools Performance 錄 10 秒 gate → 主執行緒無週期性工作(P3);點「開始乘車」進 ride 後 `.gate-ambience` 不在 DOM。
Commit: `feat: gate 月台等車 · 頂棚燈微顫 + 對向列車掠過(compositor-only)`

---

### Task 8: 效能收官(Batch C)

**Files:**
- Create: 量測腳本放 scratchpad(不進 repo);結論寫進本檔末尾的「量測結果」節

**Interfaces:**
- Consumes: `window.__door3d.stats()`(dev 掛載)、既有 CDP harness 手法(headless Chrome + `Emulation.setEmulatedMedia` 關 reduced-motion、port 4310+)

- [ ] **Step 1: 建 baseline 工作樹**

```bash
git worktree add /private/tmp/claude-501/-Users-mrl001-noopy-portfolio/*/scratchpad/baseline 26c4717
```

baseline(本批之前)與 HEAD 各起一個 dev(4310 / 4311,不佔 3000)。

- [ ] **Step 2: P1 閒置 GPU 零工作**

兩邊各自:捲到 ride 中段,停 5 秒,讀兩次 `__door3d.stats().frames`。
Expected: 兩邊差值都是 0。

- [ ] **Step 3: P4 draw call 預算**

HEAD:六站各停一點 + 隧道中點,逐段讀 `stats()` 的 draw calls / triangles。
Expected: 全程 < 30 / < 500;隧道內比 baseline 同點位 +1(倒影)、隧道外 ±0。

- [ ] **Step 4: P5 捲動 ScriptDuration**

同一支 CDP 腳本在兩邊跑相同的全程捲動掃描(gate → 終點,固定步長),取 `Performance.getMetrics` 的 ScriptDuration 差。
Expected: HEAD ≤ baseline × 1.05。

- [ ] **Step 5: P3 gate compositor 驗證**

HEAD 停在 gate 錄 10 秒 tracing(`Tracing.start` categories `devtools.timeline`),確認無週期性主執行緒 task(> 1ms)來自動畫。
Expected: 只有 interval 類雜訊,無每幀工作。

- [ ] **Step 6: P7 資產預算**

```bash
ls -la public/og.png; du -ch public/diagrams/*.svg | tail -1
```

Expected: ≤ 200KB / 合計 ≤ 120KB。

- [ ] **Step 7: 報告 + 清理 + commit**

量測結果(數字表)寫進本計畫檔末尾;`git worktree remove` baseline;若有超標項,開修正任務不硬過。
Commit(文件): `docs: 創意批次效能收官量測(P1–P7 全綠)`

---

## 量測結果(Task 8 填寫)

**環境**:HEAD = `902bccb`(本批全部完成)、baseline = `26c4717`(本批之前,worktree)。兩邊各起
`next dev`(4310 / 4311),headless Chrome(`--headless=new`,CDP port 9333,`Emulation.setEmulatedMedia`
關掉 `prefers-reduced-motion`)。量測腳本是自寫的最小 CDP harness(純 Node 內建 `fetch` + `WebSocket`,
不依賴 puppeteer),不進 repo。捲動一律用多步小幅 `scrollTo`(≤300px/步,步間等待)模擬滾輪,不用一次
跳到位(pinned-scroll 對單次 scrollTo 不可靠)。

| # | 規則 | 結果 | PASS/FAIL |
|---|---|---|---|
| P1 | 閒置 GPU 零工作 | HEAD:ride 中段(p=0.51,同時是隧道中點)停 5 秒,`frames` 32→32(diff 0)。baseline:32→32(diff 0) | **PASS** |
| P2 | 不新增常駐 rAF | code review(`grep -rn "setInterval\|requestAnimationFrame"`):唯一常駐迴圈是 `ScrollJourney.tsx` 既有的 sway 迴圈(line 429,例外);`SoundToggle.tsx` / `lib/scroll.ts` / `Window.tsx` 的 rAF 都是有限次數的過渡動畫,非常駐。全庫無 `setInterval`(LED 時鐘已於 2ba21b2 revert,未殘留) | **PASS** |
| P3 | gate compositor | HEAD 停 gate(scrollY=0)錄 10 秒 `Tracing.start`(`devtools.timeline`):主執行緒 >1ms 事件只有啟動期的 `Layout`(2ms ×1)與 `HitTest`(1.33ms ×1),無週期性;`FireAnimationFrame` 1255 次(≈125/s)與 baseline 的 1257 次幾乎相同 —— 是既有 sway 迴圈(P2 例外),不是 gate-lamp/gate-pass(兩者都是純 CSS keyframes,已經在 compositor) | **PASS** |
| P4 | draw calls <30 / triangles <500 | HEAD 六站 + 隧道中點:platform 9/18、recommendation 12/24、liff 12/24、**tunnel-mid 17/34**、ai 12/24、skills 12/24、terminal 12/24 —— 全數在預算內。與 baseline 逐點對照:隧道外六站 calls/triangles 全部 **±0**(9/18、12/24 ×5,兩邊一致);隧道內 baseline 16/32 → HEAD 17/34,**+1 draw call / +2 triangles**,正是玻璃倒影那片 quad | **PASS** |
| P5 | ScriptDuration ≤ baseline × 1.05 | 交錯量測(HEAD/baseline 輪流各跑一次,共 7 輪,抵銷機器忽快忽慢的系統雜訊):HEAD 中位數 0.2443s,baseline 中位數 0.2495s,ratio = **0.979**(HEAD 反而略快)。原始 7 筆:HEAD `[0.2286, 0.1997, 0.2588, 0.2495, 0.2443, 0.2274, 0.2669]`,baseline `[0.2495, 0.2408, 0.2560, 0.2501, 0.2609, 0.2420, 0.2448]`(單位秒)。⚠️ 先跑的「HEAD 3 輪、baseline 3 輪」序列式量測曾一度量到 ratio 1.15(HEAD run3 wallMs 4445,明顯是系統雜訊造成的離群值,md5 median 也被拖動);換成交錯量測後 7 輪都穩定在 0.9–1.0 附近,離群值不再出現在同一邊,判斷序列式那次是機器忽然忙碌(非本批引入的迴歸) | **PASS** |
| P6 | 亮度變化 <3Hz、gate 燈 opacity ≤0.02 | `app/globals.css`:`gate-lamp` 6.5s ease-in-out infinite,opacity 0→**0.02**→0(週期 6.5s ≈ **0.154Hz**,遠低於 3Hz 紅線);`gate-pass` 10s linear infinite,0%→12% 完成掃動(**1.2s / 12% of 10s**)、其餘 88% 停在畫面外。四個常數(6.5s / 0.02 / 10s / 12%)與 spec 一致 | **PASS** |
| P7 | 靜態資產預算 | `public/og.png` = 90279 bytes(**88.2 KB**)≤ 200KB;`public/diagrams/*.svg` 合計 4334+4070+3607 = 12011 bytes(**11.7 KB**)≤ 120KB;`app/layout.tsx` 未新增這兩者的 `<link rel="preload">`(既有 preload 只有字型 / `cabin.jpg` / `cabin-front.png`,都是本批之前就有的) | **PASS** |

**結論:P1–P7 全綠,無超標項,不需要修正任務。**

原始數字、腳本與逐點輸出見 `.superpowers/sdd/2026-08-25-creative-batch/task-8-report.md`。

# CLAUDE.md

給在這個 repo 工作的 Claude。設計規範另見 [DESIGN.md](./DESIGN.md)，設計稽核報告見 [docs/design-audit-2026-07.md](./docs/design-audit-2026-07.md)。

## 這是什麼

蔡守傑 NoopyCai 的個人作品集。台鐵 EMU900「夜車・區間」主題，捲動驅動的單頁互動：整頁被 GSAP pin 住，scroll progress `0 → 1` 分三個相位，六站一路開到終點，最後起身轉身走進出站大廳。

觀眾是台灣的技術主管與 recruiter。**內容 > 視覺**：一張推薦系統的架構圖比任何視覺調整都更能拿到面試。

## 指令

```bash
npm run dev     # localhost:3000（也綁 0.0.0.0，手機可連區網 IP）
npm run build   # 產品建置
npm test        # vitest run（11 tests）
npx tsc --noEmit
```

**⚠️ 不要在 `next dev` 開著的時候跑 `npm run build`。** build 會蓋掉 dev 的 `.next`，導致 `main-app.js` / `polyfills.js` 全部 404 → 頁面完全不 hydrate（畫面看起來正常但按鈕點了沒反應，而且很難聯想到是這個原因）。正確順序：

```bash
kill $(lsof -ti:3000 -sTCP:LISTEN) && npm run build && rm -rf .next && npm run dev
```

## 技術棧

Next.js 15 App Router · React 19 · GSAP ScrollTrigger · lucide-react · **純 CSS，沒有 UI framework 也不要加**。全部樣式集中在 `app/globals.css`（單檔，~250 行）。測試是 vitest + jsdom。

## 架構

```
app/page.tsx            相位分派:reduced-motion → StaticFallback,否則 ScrollJourney
                        Concourse 一律渲染(不要放進 reduced-motion 的 else 分支)
components/
  ScrollJourney.tsx     ★ 核心。ScrollTrigger pin、相位、相機動畫、滑鼠視差、跳站
  CabinComposite.tsx    車廂照 + 三扇車窗 + LED + 燈光 grade overlay
  Window.tsx            單扇車窗:scene crossfade + 隨捲動水平流動(canvas blit)
  StationPanel.tsx      作品資訊卡(liquid glass)+「看細節」modal
  RouteMap.tsx          右側六站進度點,點擊跳站
  Concourse.tsx         出站大廳(ConcourseHero 由轉場與正式區塊共用,確保交棒無縫)
  StaticFallback.tsx    reduced-motion 的語意化降級版
  Icon.tsx              lucide 薄包裝,語意固定
  SoundToggle.tsx       音軌狀態機(module scope)+ 左上角靜音鍵
lib/
  progress.ts           相位數學 + 車窗/LED 座標(cabin.jpg 實測百分比)
  scene.ts              ★ 六種窗景的逐像素 canvas 繪製(純函式,無動畫)
content/stations.ts     六站全部內容(雙語)。改文案只動這裡
```

### 相位

`lib/progress.ts`：`PHASE = { gateEnd: 0.13, rideEnd: 0.8 }`，`TOTAL_LEN = 7600`（`ScrollJourney.tsx`）。

| 相位 | progress | 畫面 |
|---|---|---|
| `gate` | 0 → 0.13 | 「開始乘車 ►」按鈕 |
| `ride` | 0.13 → 0.8 | 車廂 + 六站（`rideProgress` 映射到站序） |
| `exit` | 0.8 → 1 | 第一人稱起身 + 轉身，尾段淡出交棒給 Concourse |

## 踩過的坑（改動前務必讀）

1. **不要用 GSAP ScrollToPlugin。** 它與 pinned + scrub 的 ScrollTrigger 會回饋成死迴圈而凍結整頁。用 `ScrollJourney.tsx` 裡自己寫的 `smoothScrollTo`（逐幀 `window.scrollTo`，會觸發真實 scroll 事件）。

2. **`scrollRestoration` 必須是 `manual`。** pin 建立前文件只有 ~1916px，之後才被撐到 ~9516px。瀏覽器會在那之前就還原捲動位置 → 被 clamp 到出站大廳頂端 → 重整時先閃一下最下方的區塊。已在 pin 的 effect 裡處理，cleanup 會還原原值。

3. **文字不要放進 sway 層。** 那層常駐 `scale(1.035)`（滑鼠視差 ±15px 的過掃描），加上 `will-change` + `preserve-3d`，瀏覽器會整層先光柵化再 GPU 縮放 → 文字與像素字型被重新取樣而**發糊**。照片和 canvas 放大 3.5% 看不出來，文字看得出來。資訊卡與路線圖必須是 `.camera` 的直接子元素。

4. **`CabinComposite` 的寬度是 `max(100vw, 177.68vh)`，不要加上限。** 177.68 = 1672/941（cabin.jpg 比例）。加了 `min(..., Nvw)` 之類的上限，直式手機就會出現上下留邊。直式滿屏的代價是中央窗的圓角框會被裁到畫面外——這是比例算出來的，不是可以兩全的選擇。

5. **`StationPanel` 的 `transform` 已被淡入的 inline style 佔用。** 要垂直居中請用 `top/bottom: 0` + `height: fit-content` + `margin: auto 0`，不要用 `translateY(-50%)`（inline style 會蓋掉 CSS）。

6. **`--font-led` 沒有 CJK 字符集。** Departure Mono 只有拉丁/數字/符號，中文會掉回系統黑體 → 同一串字雙字型混排。目前是已知缺陷（audit §2.1）。

7. **Departure Mono 是單一字重，永遠不要 `font-weight: 700`。** synthetic bold 會把 bitmap 邊緣往外糊一格、破壞像素網格。要更重就加大字級或用 `text-shadow` 光暈。

8. **`drawScene` 有 module-scope 的 Map 快取**（`Window.tsx`）。它是逐像素迴圈（單張約 108k 次 `fillRect`），六站 × `{bg, full}` 最多 12 張。不要繞過快取直接呼叫。

9. **字型與 `cabin.jpg` 都在 `layout.tsx` 裡 preload。** cabin.jpg 只有進 ride 相位才進 DOM，沒有 preload 的話第一次搭車必然看到 pop-in。

## 慣例

- **註解用繁體中文**，寫「為什麼」而不是「做什麼」。既有註解密度不低，跟著寫。
- 樣式一律進 `globals.css` 的 `.sp-*` / `.routemap-*` 等既有 class。**不要在元件裡新增 inline style 排版**（已經從 `StationPanel` 收乾淨過一次）。
- 非破壞性的可讀性/無障礙修正可以直接做；動到構成、燈光曲線、資訊架構的請先問。
- 內容改動只動 `content/stations.ts`，六站的 `zh` / `en` 要同步（英文不要機翻，照同樣邏輯重寫）。
- **`metrics` 欄位只放真的量測值。** 技術名稱（`AES-256`、`OTP`、`RT`）請放 `tags`。目前六站的 metrics 資料都清空了，型別與渲染邏輯留著等真數字。
- 使用者可見的字串**不要用 em-dash（—）**，用 `·`。
- **不要用 emoji。** 介面控制項用 `Icon.tsx`（lucide）；LED 顯示器上的內容用會發光的字元箭頭 `◄ ►`（見 DESIGN.md）。

## 測試

`lib/progress.test.ts`（相位數學）、`lib/scene.test.ts`、`content/stations.test.ts`（含「不得外洩電話/地址」的檢查）、`components/LangProvider.test.tsx`。動到相位常數或 `STATIONS` 結構時要一起更新。

## 已知待辦

完整清單見 `docs/design-audit-2026-07.md`（約 60 項，排序過）。最高優先的四項：

1. **亮站對比崩壞** — `taipei` 站 `brightness(1.5)` 把玻璃卡帶成近白，`--muted` 對比只有 1.8:1、`--amber` 1.05:1（§1.2）
2. **六站燈光曲線** — 主題叫「夜車」但中間插了一個正午；且 grade overlay 在 DOM 上位於車窗下方 → 車內比車外亮，光線關係是反的（§3.1）
3. **SSR HTML 沒有 `<h1>`**，四個作品站的內容爬蟲完全看不到（§1.3）
4. **三個專案零個可驗證連結** — `links` 的型別/CSS/渲染邏輯全寫好了但沒資料（§7.3）

死程式碼：`components/WireCar.tsx`（零 import，已移除的 boot 相位遺留）、根目錄的 `train_background.{png,jpg}`（2MB，未被引用）、`content/i18n.ts` 的 `UI` 物件、`lib/progress.ts` 的 `stationAt()` / `panoramaOffset()`。README 仍在描述已移除的 boot 相位。

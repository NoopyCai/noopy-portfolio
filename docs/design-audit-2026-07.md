# 夜車・區間 — 整站設計優化方向稽核報告

> 專案:`/Users/mrl001/noopy-portfolio`(Next.js 15 App Router + React 19 + GSAP ScrollTrigger,無 UI framework,純 CSS)
> 線上:https://noopy-portfolio.vercel.app
> 稽核日期:2026-07-29
> 本次稽核未改動任何檔案,純研究與建議。

---

## 0. 稽核前提

**Design Read**:這是一份**開發者作品集 (developer portfolio)**,觀眾是台灣的技術主管與 recruiter,設計語言是**原創的台鐵夜車 / 在地 pixel-art + Apple Liquid Glass 疊層**,實作路線是 native CSS + GSAP ScrollTrigger + Canvas,沒有也不需要 UI framework。

**稽核模式:Redesign - Preserve(保留品牌、漸進演化)。** 現有美學是原創且有辨識度的資產,本報告不提任何「換成通用 SaaS landing」的建議。

**現況轉盤讀數 → 建議目標值**

| 轉盤 | 現況 | 建議 | 說明 |
|---|---|---|---|
| `DESIGN_VARIANCE` | 7 | **8** | 構成已經非對稱,但資訊卡與路線圖是「浮在畫面上」而非「長在車廂上」,可以更大膽地貼合車廂幾何 |
| `MOTION_INTENSITY` | 8 | **8(不變)** | 動態量已經足夠,問題在**節奏與轉場的動機**,不在量 |
| `VISUAL_DENSITY` | 5 | **4** | 桌機資訊卡塞太滿(單卡 8 級字階、29 個技能項),需要減密 |

**稽核方法**:讀完 `app/globals.css`(221 行)、`page.tsx`、`layout.tsx`、`opengraph-image.tsx`、`robots.ts`、`sitemap.ts`、全部 10 個 components、`lib/scene.ts`、`lib/progress.ts`、`content/stations.ts`、`content/i18n.ts`、`README.md`、`package.json`、`next.config.mjs`;並開 Chrome 實測線上版(桌機 1200px + 手機尺寸、量測 DOM 座標、抓 SSR HTML、驗證字型載入狀態、掃 dead code)。

---

## 1. 三個必須先修的硬缺陷(不是品味問題,是壞掉了)

### 1.1 Departure Mono 在線上是 404,整站的 LED 字型從未生效

**問題**:`app/globals.css:14-18` 宣告 `@font-face { font-family: "Departure Mono"; src: url(/fonts/DepartureMono-Regular.woff2) }`,但 `public/fonts/` 是**空目錄**,`git ls-files public` 也證實檔案從未被 commit。實測線上:

```
GET /fonts/DepartureMono-Regular.woff2 → 404
document.fonts → ["Departure Mono:error"]
```

也就是說:LED 跑馬燈、站名、年份、metrics 數字、impact 廣播句、路線圖標籤、CONCOURSE 標題、所有 `--font-led` 元素,**全部 fallback 到 SF Mono**。`README.md` 甚至已經寫下這件事(「若未放置,會 fallback 到系統等寬字」)卻沒有修。

**建議**:把 `DepartureMono-Regular.woff2`(SIL OFL,可自由散布)放進 `public/fonts/` 並 commit;同時 `app/layout.tsx` 加 `<link rel="preload" as="font" crossorigin>`,或改用 `next/font/local` 讓 Next 自動處理 preload 與 `font-display`。

**為什麼**:你宣稱的設計語言是「只有兩套字型」,但實際跑的是「系統等寬 + 系統黑體」。SF Mono 是 Apple 的通用開發者字型,沒有 pixel/LED 的機械感,整站最重要的一條視覺線索(車站標示系統的字)目前完全不存在。這也是為什麼桌機畫面會覺得「有點通用」的根本原因。

**影響力:極高 / 工作量:S**

---

### 1.2 Liquid Glass 資訊卡在三個「亮站」對比崩壞,文字實質消失

**問題**:`.glasscard` (globals.css:60-71) 用 `background: rgba(16,22,26,0.32)` + `backdrop-filter: blur(16px) saturate(180%) brightness(1.04)`。這組數值是為**暗底**調的。但六站裡有三站的窗景是亮的,且 `grade.filter` 還會再加亮車廂:

- `city` — 黃昏橘 `brightness(1.06)`
- `taipei` — **白晝 `brightness(1.5) contrast(1.05)`**
- `field` — 金色 `brightness(1.08)`

在 `taipei` 站實測,卡片被 backdrop 帶成接近白色,於是:

| 元素 | 顏色 | 在亮底上的對比比 | WCAG AA |
|---|---|---|---|
| `.sp-sub`(副標、技術棧) | `--muted #8b98ad` | ≈ **1.8:1** | ✗ 需 4.5 |
| `.sp-metric-l`(數據標籤) | `--muted #8b98ad` | ≈ **1.8:1** | ✗ |
| `.impact` / `.sp-metric-n` | `--amber #f2c230` | ≈ **1.05:1** | ✗ 幾乎全白吃掉 |
| `.sp-tag` 綠字 | `#06ff31` | ≈ 2.3:1 | ✗ |

實測截到的畫面裡,「Claude Code · Gemini · SDD」和「省手刻時間」是**看不見的**,`80%` 這個唯一的真實數字也糊在白底上。手機版已經把底改成 `rgba(10,16,20,.66)`(640 breakpoint)—— 桌機沒有跟上。

**建議**(都在 Liquid Glass 的語言內,Apple HIG 本身就有這個機制):

1. 卡片內加一層由下往上的 **dimming scrim**(`::after` 的 `linear-gradient(to top, rgba(6,10,14,.55), rgba(6,10,14,.18))`),這是 Apple 在亮內容上放玻璃的標準做法,不是背棄玻璃感。
2. `saturate(180%)` 降到 `120–130%`。180% 在橘色夕陽窗景後面會把彩度推成霓虹糊斑(截圖裡卡片後面那幾團紅橘就是),直接吃掉字的邊緣。
3. 讓卡片底色跟著站點走:`Station` 型別加一個 `panelTone: "dark" | "bright"`,亮站用 `rgba(8,12,16,.62)`。你已經有 `grade` 這個 per-station 的燈光資料結構,加一個欄位是自然的延伸。
4. `--muted` 在卡片內不要用 `#8b98ad`;亮站切到 `#dfe7f2`。

**為什麼**:Liquid Glass 的前提是「玻璃底下的內容不能吃掉玻璃上的字」,Apple 的 Materials 文件本身就要求在高亮內容上加暗化層。現在的做法把材質當成裝飾而不是可讀性系統,結果是六站中有三站的資訊層無法閱讀 —— 那正好是三個作品站。

**影響力:極高 / 工作量:M**

---

### 1.3 SSR HTML 沒有 `<h1>`,四個作品站的內容爬蟲完全看不到

**問題**:實測線上 HTML(10.6 KB):

```
標題結構:<h2 class="eyebrow">CONCOURSE</h2> / <h3>關於我</h3> / <h3>保持聯絡</h3>
「推薦系統」出現次數:0
「技能」出現次數:0
「終點站」出現次數:0
「月台」出現次數:0
JSON-LD:0 筆
```

原因:`app/page.tsx` 是 `"use client"`,SSR 時 `reduce=false` → 渲染 `ScrollJourney`;而 `ScrollJourney` 初始 `p=0` → `phase="gate"` → **只渲染一顆「開始乘車」按鈕**。StationPanel 只渲染 `cur` 這一站,其餘五站不在 DOM。整站唯一進到 SSR 的文字是 Concourse 那兩段(而那兩段又是從 station 1 和 6 抄來的)。

**建議**:不要靠 `StaticFallback` 補(它只在 reduced-motion 分支渲染,SSR 永遠拿不到)。做**第 6 節提的「時刻表看板」**:在 Concourse 放一個真實 DOM 的六站索引表(站序 / 站名 / 年份 / 作品標題 / impact / 技術標籤),點列可 `jumpTo(i)` 捲回該站。一塊東西同時解決三件事:SEO 內容、recruiter 的快速掃描路徑、Concourse 的空洞。另外補 `<h1>`(見 6.3)與 JSON-LD(見 10.3)。

**為什麼**:這是一份靠四個專案敘述取勝的作品集,但 Google 與任何 LLM 摘要工具目前只讀到約 1 KB 的自介。同時,**會有 recruiter 不願意捲完整趟車** —— 他們需要一個可掃描的總覽,而這個總覽在台鐵語言裡有天然的形式(時刻表 / 出發看板)。

**影響力:極高 / 工作量:M**

---

## 2. 排版與字階

### 2.1 `--font-led` 沒有中文字,每個含中文的標籤都是雙字型混排

**問題**:`--font-led: "Departure Mono", ui-monospace, "SF Mono", Menlo, monospace` 完全沒有 CJK 字符集。所以 `.sp-station`、`.impact`、`.led-run`、`.concourse-hero p`、`.detail-label` 這些含中文的元素,**拉丁字母走 mono,中文掉到系統黑體**。截圖裡「AI 工具整合」的 `AI` 是等寬、`工具整合` 是 PingFang,字重、字寬、視覺重心全部不對齊;「LINE LIFF 會員綁定」更明顯。

**建議**:把 `--font-led` 的角色**限縮成拉丁字母、數字、符號**,中文站名另立一條規則:

```css
--font-sign: "Departure Mono", ui-monospace, monospace;      /* 只給數字/拉丁/符號 */
--font-sign-zh: "Noto Sans TC", "PingFang TC", sans-serif;   /* 中文標示:靠字重+字距做標示感 */
```

中文站名改用 `--font-sign-zh` + `font-weight: 500` + `letter-spacing: .18em`,靠字距與字重營造「站牌」感(這正是真實台鐵站牌的做法:中文用黑體、英文/數字用窄體)。這比硬套等寬更接近真實的台鐵標示系統。

**為什麼**:這不是抽象的品味,是台鐵標示系統的實際規則。目前的混排讓每一個站名看起來像 fallback 失敗,而不是設計決策。

**影響力:高 / 工作量:S**

---

### 2.2 Departure Mono 是單一字重,但 CSS 兩處要求 `font-weight: 700` → 假粗體

**問題**:`.led-run { font-weight: 700 }` (globals.css:33)、`.sp-metric-n { font-weight: 700 }` (:156)。Departure Mono 是單字重的 pixel font;瀏覽器只能做 synthetic bold,也就是把 bitmap 邊緣往外糊一格。字型修好之後,這兩處會變成整站最醜的兩個地方(跑馬燈與最大的數字)。

**建議**:兩處都改 `font-weight: 400`;要更亮就加 `text-shadow` 光暈(LED 本來就是靠發光而非加粗變重),要更大就加 `font-size`。

**為什麼**:pixel/bitmap 字型的粗細是設計進去的,不能運算。假粗體會破壞像素網格對齊,那是這個字型唯一的價值。

**影響力:中 / 工作量:S**

---

### 2.3 單張卡片內 8 級字階,而「最重要的一句」是第 6 小的

**問題**:`.station-panel` 內的字級序列是 **11 / 11 / 12 / 13 / 15 / 16 / 24 / 34 px**(`.sp-meta` / `.sp-tag` / `.sp-station` / `.sp-sub` / `.sp-body` / `.impact` / `.sp-metric-n` / `h2`)。八級太多,而且分配錯了:

- `h2`(專案名,34px)是最大的,但專案名本身資訊量低(「AI 工具整合」)
- `.impact`(到站廣播主句,你自己定義為「一句話關鍵成果」)只有 **clamp(13px, 1.5vw, 16px)**,比 `.sp-body`(15px)幾乎一樣大
- 階層完全靠**顏色**(琥珀)撐,一旦遇到 1.2 的亮底問題就整條線索斷掉

**建議**:壓到 5 級,並把 impact 升為第二主角:

```
station(標籤)   12px
h2(站名/專案)   clamp(22px, 2.6vw, 30px)   ← 略縮
impact(廣播句)  clamp(17px, 2vw, 21px)     ← 大幅升級,line-height 1.5
body(敘述)      15.5px / 1.8
meta+tag+label   11.5px
```

`.sp-meta`、`.sp-metric-l`、`.sp-tag` 統一到 11.5px(現在 11/11/11 三個各自寫死,實質同級卻分三處維護)。

**為什麼**:字階的作用是「不用讀就知道先看哪裡」。目前掃描順序是「最大的專案名 → 最亮的數字 → 其他一團」,而你真正想讓人記住的是那句 impact。放大它,並讓 `h2` 退一步當「站名」而不是「標題」,同時也更貼合車站廣播的節奏(先報站,再說重點)。

**影響力:高 / 工作量:S**

---

### 2.4 幾何符號用了五套,沒有統一的符號系統

**問題**:`▸`(start 按鈕、impact 前綴、履歷連結)、`▾`(看細節)、`↗`(外部連結)、`✕`(關閉)、`◄ ►`(LED 包夾)、`·`(meta 分隔)。六種字符家族在同一畫面上,看起來像是不同時期加的。

**建議**:選一套「運輸標示」符號家族並寫成 CSS 規則:`▸` 專屬「前進 / 出發」(start、impact),`↗` 專屬外部離站,`▾` 專屬展開,`✕` 換成 `×`(U+00D7,與 mono 字型的視覺重量一致)。`.impact` 前面的 `▸` 建議拿掉,改用手機版已經做的**琥珀左軸線**(globals.css:194-196),並把那條軸線提升到桌機 —— 那是比字符更好的「廣播中」訊號。

**為什麼**:符號在標示系統裡是有語意的(機場/車站的箭頭系統是規範化的)。混用會讓它們退化成裝飾。

**影響力:中 / 工作量:S**

---

## 3. 色彩與燈光 grade

### 3.1 六站的光線曲線不是一條敘事,中間插了一個正午

**問題**:`content/stations.ts` 六站的 `grade.filter` brightness 依序是:

```
platform 1.00  ─┐ 傍晚月台
city     1.06   │ 黃昏
river    0.72   │ 深夜  ← 對
taipei   1.50   │ ★ 白晝正午  ← 曲線在這裡爆掉
field    1.08   │ 金色黃昏  ← 時間倒退
sea      1.03  ─┘ 破曉
```

主題叫「**夜車**・區間」。但實際的光線敘事是:傍晚 → 黃昏 → 深夜 → **正午** → 又回黃昏 → 破曉。第 4 站的 `brightness(1.5)` 加 `blend: screen` 加白色 grade `rgba(205,225,245,0.18)`,把整節車廂洗成白天,這件事同時做了三件壞事:

- (a) 打斷夜車敘事
- (b) 造成 1.2 的對比崩壞
- (c) 讓「車內比車外亮」(grade overlay 在 DOM 上位於車窗**下方**,所以車廂被加亮但窗景不變 → 光線關係反轉)

另外,`city` / `field` / `sea` 三站都是「暖色夕陽 / 金色」,`grade` 分別是 `rgba(255,140,50)` / `rgba(255,170,70)` / `rgba(255,150,170)`,彼此太近,六站實際只有四種光。

**建議**:把 `taipei` 改成**夜間台北 · 101 點燈**。這完全在主題內,而且更對:AI 站的 LED 已經寫「下一站 AI 工具整合 · 台北」,一輛夜間區間車在深夜經過台北,看到 101 亮著燈,比正午的台北合理一百倍。`lib/scene.ts:153-172` 的 `taipei` 分支改法很直接:

- `grad()` 換成深藍夜空 stops
- 加 `stars()`
- `skyline` 的 `lit` 參數已經支援亮窗(只要把 `#8a94a0`/`#7d8791` 的日間灰換成 `#0e1420` 系)
- 101 的 `for (let s = 0; s < 8; s++)` 分層迴圈加上逐層的暖白亮點就是點燈
- grade 改為 `brightness(0.86) saturate(1.05)` + `rgba(60,90,150,0.28)` + `soft-light`

重排後的曲線:

```
platform 0.95  傍晚月台(冷藍,月台燈池已經是暖的)
city     1.05  黃昏市郊(唯一一個暖亮峰)
river    0.72  深夜跨河(最暗谷底)
taipei   0.86  深夜台北(城市光害微亮)
field    0.80  凌晨田野(最暗,只有零星燈火)
sea      1.03  破曉海景(唯一的亮結尾)
```

這是一條有起伏、有低谷、以日出收尾的曲線 —— **一趟夜車該有的樣子**。`field` 站的場景 (`scene.ts:173-192`) 現在是 golden hour,建議改成**凌晨藍調時刻 (blue hour)**:稻田映著微光、電線桿剪影、零星農舍燈火。技能站放在最暗處也有隱喻上的好處(黎明前的準備)。

**為什麼**:主題性的燈光曲線是這個作品集**唯一無法被複製的資產**。目前六站的光線是各自為政的「好看」,湊不成一條敘事。修好之後,使用者捲到底會有「我搭了一夜車、天亮了」的實感,而不是「看了六張漂亮的窗景」。

**影響力:極高(這是全站最有價值的單一改動)/ 工作量:M**

---

### 3.2 `lerpGrade` 在轉場中點硬切 `filter` 與 `blend`,每次換站都有一次跳閃

**問題**:`lib/progress.ts:41-47`:

```ts
filter: t < 0.5 ? a.filter : b.filter,
grade:  mixRgba(a.grade, b.grade, t),   // 只有這行是真的插值
blend:  t < 0.5 ? a.blend : b.blend,
```

`filter` 和 `blend` 在 t=0.5 瞬間切換。`CabinComposite` 上的 `transition: filter .8s ease` 能救 filter(但會延遲 0.8s 才追上,跟捲動脫鉤),`mixBlendMode` 則**完全無法過渡**。最糟的一組是 `river`(multiply, 深藍) → `taipei`(screen, 近白):t=0.49 在做 multiply 壓暗,t=0.51 突然改成 screen 提亮,同一個混合色被兩種相反的合成模式處理,畫面直接彈一下。

**建議**:

1. **統一 blend mode**。六站全用 `soft-light`,需要壓暗就用 grade 顏色的暗度與 alpha 表達,需要提亮就靠 `brightness`。一個燈光系統不該有三種合成模式。
2. `filter` 改成可插值的**數值** lerp,而不是字串切換。把 `Grade` 改成 `{ brightness: number; saturate: number; contrast?: number; tint: string }`,`lerpGrade` 對三個數字做線性插值再組字串。這樣車內燈光會真正**隨捲動連續變化**,而不是每 0.8 秒追一次。
3. 拿掉 `transition: filter .8s ease`(改成連續插值後就不需要,而且它現在正在跟 scrub 打架)。

**為什麼**:「車內燈光隨窗外光線改變」是這個專案的招牌機制。如果它是階梯狀跳變的,機制就露餡了。連續插值後,過隧道、進城、出海的光線變化才會有物理感。

**影響力:高 / 工作量:M**

---

### 3.3 三種 metric 顏色語意重疊

**問題**:`--amber #f2c230` 同時用在:`.sp-station`(站名標籤)、`.impact`(廣播句)、`.sp-metric-n`(數據)、`.routemap-dot.on`(當前站)、`.concourse-block h3`(區塊標題)。琥珀是「當前 / 重點」也是「標籤」也是「數字」也是「標題」—— 五種角色一個顏色,等於沒有語意。`--emu-green #6eb43f` 只用在 `.sp-skills b` 和 `.routemap-dot` 邊框,`--seat #a6c4d8` / `--seat-pri #e7a9bc` 兩個座椅色**在 CSS 裡完全沒被使用**(只存在於 cabin.jpg 的照片裡)。

**建議**:鎖定語意:

- `--green #06ff31`(LED 綠)= 只給「系統訊息 / LED 顯示 / 可互動的出發動作」
- `--amber #f2c230` = 只給「**當前位置 / 到站**」(`.routemap-dot.on`、`.impact` 的軸線、`.sp-station`)
- `--emu-green #6eb43f` = 「路線 / 結構」(路線圖線、區塊標題、技能分組)→ 把 `.concourse-block h3` 從琥珀改成這個
- `--seat #a6c4d8` = 給數據數字(`.sp-metric-n`)。座椅藍在照片裡已經是整個畫面的第二大色塊,把它拉進 UI 會讓 UI 看起來像長在車廂上,而不是貼上去的。這也順帶解決 1.2 的琥珀在亮底消失問題(`#a6c4d8` 在亮底上仍有可用對比,配合 scrim 可過 AA)

**為什麼**:目前色票有 6 個值但只有 3 個語意層級,同時有 2 個值閒置。從照片裡「借」座椅色是最省力的一致性提升:材質已經在畫面上了,只是還沒進入 UI 語彙。

**影響力:中高 / 工作量:S**

---

## 4. 動態

### 4.1 gate → ride 之間沒有轉場,最關鍵的一刻是硬切

**問題**:`ScrollJourney.tsx:136` 是 `{phase === "gate" && <button>}`,`:148` 是 `{showRide && <div className="camera">}`。在 `p = 0.13` 那一瞬間,按鈕**條件卸載**、車廂**條件掛載**,兩者沒有任何 crossfade。使用者按下「開始乘車」,`smoothScrollTo` 捲 1400ms,然後車廂憑空出現。

更糟的是 `cabin.jpg`(424 KB)只有在 `showRide` 為真時才進入 DOM,所以**圖片是在切到 ride 的那一刻才開始下載**。第一次搭車必然看到一次車廂 pop-in。

**建議**:

1. `cabin.jpg` 在 gate 階段就 preload(`<link rel="preload" as="image">` 放進 `layout.tsx`,或 gate 期間就掛 `<img>` 但 `opacity: 0`)。
2. 做一段**車門開啟 / 車廂通電**的轉場,時間軸放在 `p` 的 0.10–0.16:
   - 0.10–0.13:`.start` 按鈕的綠光收縮成一條水平亮線(`scaleX` + `opacity`,都是合成層屬性)
   - 0.13–0.16:那條亮線展開成 LED 條,同時 `.camera` 的 `opacity 0→1` 搭配 `filter: brightness(0.2→1)` ——「車廂日光燈依序點亮」

   Repo 裡還躺著 `components/WireCar.tsx`(73 行,綠色線稿車廂,**目前沒有任何檔案 import 它**),那是為 boot 階段畫的。要嘛把它接回來當這段轉場的視覺(線稿 → 實照的 crossfade 是很好的「藍圖變成現實」隱喻),要嘛刪掉並更新 README(README 現在還在描述已被移除的 boot 階段)。

**為什麼**:這是整個體驗的**唯一一次主動點擊**,是使用者投入注意力的時刻。目前的回饋是「等 1.4 秒,然後畫面換了」。轉場的動機很明確(state transition + storytelling:門關了、車通電了、車開了),不是為了炫。

**影響力:極高 / 工作量:M**

---

### 4.2 一次換站有三個不同時長在跑,聽起來像三件事

**問題**:換站時同時發生:

- `StationPanel` inline `transition: "opacity .5s, transform .5s"` (StationPanel.tsx:20)
- `SceneLayer` 窗景 crossfade `transition: "opacity .6s ease"` (Window.tsx:112)
- `CabinComposite` 燈光 `transition: "filter .8s ease"` (CabinComposite.tsx:16)
- LED 文字:**瞬間切換**(`cur.led` 直接換字,跑馬燈動畫不重啟)
- 資訊卡可見性門檻 `dist < 0.34`(ScrollJourney.tsx:158),也就是每段區間有 32% 的距離沒有卡片

500 / 600 / 800 / 0 ms 四種時長。線上實測時抓到一格:LED 已經在報「下一站 LINE LIFF 會員綁定」、資訊卡已經是 LIFF,但窗外還是上一站的橘色黃昏城市。報站與窗景不同步。

**建議**:把換站定義成**一個有序的到站事件**,用單一時間基準(設 `T = 700ms`):

```
0        LED 開始報「下一站 ○○」(跑馬燈重新啟動,從右側推入)
0.15T    窗景開始 crossfade
0.3T     車內燈光開始過渡
0.5T     舊資訊卡淡出下沉
0.7T     新資訊卡淡入,內部元素 stagger 60ms:
         站名 → 標題 → impact → body → tags → metrics
```

資訊卡的內部 stagger 是這裡最值得做的一項:現在整張卡是一個 block 一起淡入,改成逐層點亮就是「站牌逐行顯示」的節奏(用 CSS `animation-delay: calc(var(--i) * 60ms)`,不需要 JS)。

同時修 LED:`components/LedSign.tsx` 目前 `` {`◄ ${text} ►　`.repeat(3)} `` 配合 `@keyframes marq { 28% → -72% }`(globals.css:33-34)。實測畫面上**同時出現 2 到 3 份相同文字**,讀起來像跳針而不是車站跑馬燈。改成單一份文字,動畫時長由字數推導(`animation-duration: calc(var(--len) * 0.28s)`),並在換站時用 `key={station.id}` 強制重掛以重啟動畫。真實的台鐵 LED 是「訊息從右邊推進來、走完、下一則」,不是無縫循環三份。

**為什麼**:「到站」在真實世界是一個**編排好的事件序列**(廣播 → 減速 → 月台出現 → 停穩 → 開門)。目前四個時長各自跑,大腦讀成四件無關的事同時發生,所以感覺「有動但不像到站」。

**影響力:極高 / 工作量:M**

---

### 4.3 每一幀 `setP()` 觸發整棵樹重繪

**問題**:`ScrollJourney.tsx:59` `onUpdate: (self) => setP(self.progress)`。捲動時每幀一次 React state 更新,重繪 `CabinComposite` → 3 個 `Window` → `SceneLayer`(`useEffect [pan]` → `blit`)→ `StationPanel` → `RouteMap`。每幀約 10 個元件重算,`grade` 每幀產生新物件,所有 inline style 物件每幀重建。

這正是 skill 明文禁止的模式(§3.B:不要用 `useState` 追蹤連續輸入值)。目前能跑是因為每幀的實際工作量小,但它吃掉了所有 headroom —— `exit` 階段的 `filter: blur()` 一疊上去就會掉幀。

**建議**:連續值改走 ref + CSS 變數,只有**離散值**才進 state:

- 連續(每幀,直接寫 DOM):`pan`、`grade` 三個數字、camera transform → 寫成 `--pan` / `--brightness` / `--cam-ty` 等 CSS 變數掛在 `stage` 上,或直接 `el.style.setProperty`
- 離散(換站 / 換相位才更新):`index`、`phase`、`panelVisible` → 這三個才用 `setState`

`Window` 的 `blit` 從 `useEffect [pan]` 改成訂閱同一個 rAF 迴圈(你已經有一個在跑 sway 了,共用它)。

**為什麼**:`MOTION_INTENSITY: 8` 的網站需要每一毫秒的預算,而 React reconciliation 是純浪費。改完之後 4.2 的編排、4.1 的轉場、3.2 的連續光線插值才有空間跑得順。這是所有動態改動的前置條件。

**影響力:高(是其他動態項的前提)/ 工作量:M**

---

### 4.4 `exit` 的 `filter: blur()` 是全站最貴的一行

**問題**:`ScrollJourney.tsx:116` `camFilter = blur(turn * 4)`,套在 `.camera`(全視窗、`preserve-3d`、內含一張 1672px 大圖 + 3 個 canvas + 玻璃卡)上,每幀改變模糊半徑。全視窗即時高斯模糊每幀重算是 GPU 最痛的操作,手機幾乎必掉幀。而且 `.camera` 有常駐 `will-change: "transform, opacity"`,`filter` 不在裡面 → 每幀重建圖層。

**建議**:

1. 手機(`narrow`)完全不要 blur,改用 `opacity` 加速淡出即可(轉身的 `rotateY(-22deg)` 已經給了足夠的動感)。
2. 桌機把 blur 改成**兩層 crossfade**:一層清晰、一層預先套固定 `blur(4px)` 的副本,用 `opacity` 在兩層間過場。opacity 是純合成,成本接近零。
3. `will-change` 加上 `filter`,並在 `exit` 結束後清掉(`will-change: auto`)。

**為什麼**:轉身失焦的動機是對的(第一人稱視覺:轉頭時周邊失焦),但實作方式讓最後一段體驗變成最卡的一段 —— 而那正好是要交棒給 Concourse 的關鍵一刻。

**影響力:中高 / 工作量:S**

---

### 4.5 完全沒有 `:active` 觸壓回饋,`smoothScrollTo` 不可中斷

**問題**:

1. globals.css 全檔搜不到任何 `:active`。`.start`、`.detail-btn`、`.routemap-dot`、`.concourse-link`、`.ctrl` 全部只有 `:hover`。點下去沒有任何物理回饋。
2. `smoothScrollTo` (ScrollJourney.tsx:20-32) 每幀 `window.scrollTo`,持續 1200–1400ms,**沒有監聽使用者輸入來中止**。使用者在跳站動畫中滾滑鼠 → 兩個 scroll 源打架,畫面抽動。連點兩次路線圖 → 兩個 rAF 迴圈同時寫 scrollY。
3. `.start` 的 `@keyframes pulse` 動的是 `text-shadow`(paint-bound,不是 transform/opacity)。

**建議**:

1. 全站互動元素加 `:active { transform: translateY(1px) }`(按鈕)或 `scale(0.96)`(路線圖圓點)。150ms 的工作量,是「感覺很貴」與「感覺是網頁」的差別。
2. `smoothScrollTo` 加中止:模組層存一個 `activeRaf`,開始前 `cancelAnimationFrame`;並掛 `{ passive: true }` 的 `wheel` / `touchstart` 一次性監聽,使用者一動就 `cancel`。這是 scroll-hijack 的基本禮貌。
3. `.start` 的 pulse 改成疊一層 `::after` 的固定光暈,動它的 `opacity`。

**為什麼**:觸壓回饋是「這個介面有實體」的最低成本訊號。而 scroll hijack 不可中斷是使用者最討厭的體驗之一 —— 你已經冒了 pin 整頁的風險,至少要讓使用者隨時能奪回控制權。

**影響力:中高 / 工作量:S**

---

### 4.6 sway 的 rAF 永遠不休息

**問題**:`ScrollJourney.tsx:74-89` 的 `tick` 迴圈**永不停止**,就算 `phase !== "ride"`、就算滑鼠沒動、就算 `cur` 已經收斂到 target,每幀還是寫一次 6 個值的 `transform` 字串。

**建議**:

```ts
if (Math.abs(tgx - cur.x) < 0.0005 && Math.abs(tgy - cur.y) < 0.0005
    && phaseRef.current !== "ride") { raf = 0; return; }
```

並在 `pointermove` 與 phase 變化時重新啟動。另外 `prefers-reduced-motion` 只在 mount 時檢查一次(`:66`),使用者中途改設定不會生效 —— 改用 `mq.addEventListener("change")`(你在 `:43-47` 對 `max-width` 已經這樣做了,照抄即可)。

**影響力:中 / 工作量:S**

---

## 5. 空間構成(桌機)

### 5.1 資訊卡遮掉中央車窗的 45%,而車窗是整站的主視覺

**問題**(實測 1200px 寬視窗):

```
中央車窗   left 31.2%  →  68.8%   (lib/progress.ts:28, 寬 37.6%)
資訊卡     left 6%     →  48%     (globals.css:167, max-width 42%)
重疊區間                31.2% → 48%  =  車窗寬度的 45%
```

垂直方向更嚴重:實測卡片高 405px / 視窗 615px = **佔視窗高度 66%**。`bottom: 8%` 讓它從 y=161 一路長到 y=575。這不是「左下角浮出的一張小卡」,是一塊蓋掉一半主視覺的板子。截圖裡 AI 站的卡片同時遮掉了**左側車窗(全遮)與中央車窗左半**。

而且卡片**浮在虛空中** —— 它的位置與 cabin.jpg 的幾何毫無關係,底邊懸在座椅上方,左邊懸在車門邊,沒有貼齊任何一條車廂的線。

**建議**:把資訊卡**貼到車廂的實體表面上**。cabin.jpg 提供了幾個天然的資訊承載面:

- **中央窗左側的牆板**(約 x 10%–29%,y 30%–66%):一塊完整的深色壁面,寬度約 19%
- **行李架下方的橫帶**(LED 條與車窗之間)
- **車門旁的廣告框 / 中吊廣告位**

推薦方案:把 `.station-panel` 改成 `left: 9%; width: 21%; top: 28%`(貼齊中央窗的左緣與上緣),變成一塊**車廂內廣告板**。這樣:

- 中央車窗**完全不被遮**,主視覺回來了
- 產生真正的「左欄資訊 / 右側大窗」非對稱分割(`DESIGN_VARIANCE` 從 7 提到 8)
- 卡片變窄(21% ≈ 250px)會**強迫內容紀律** —— 而目前的 body 文案本來就太長(見 7.5)
- 語意上成立:真實的通勤車廂資訊就是貼在窗邊壁面與車門上的

窄卡的排版隨之調整:`h2` 降到 clamp(19px, 1.8vw, 24px)、body 縮到 3 行(`-webkit-line-clamp: 3` + 完整版留給「看細節」modal)、metrics 從橫排改直排。這剛好也把 2.3 的字階問題一起解掉。

**為什麼**:brief 說「大量畫面留給車窗」,但實際上車窗被遮了近一半。當資訊層貼合背景的幾何時,兩者會讀成**一個空間**;懸浮時會讀成**兩個貼在一起的圖層**。這是整個桌機構成能不能成立的關鍵。

**影響力:極高 / 工作量:M**

---

### 5.2 右側路線圖的圓點壓在右車窗玻璃上,還跟靜音鍵撞

**問題**:`.routemap { right: 2.2% }`(globals.css:100),圓點 12px 寬 → 約落在 96.8%–97.8%。右車窗是 `left 89.9%, w 7.3%` → 89.9%–97.2%。**圓點直接壓在右窗玻璃上**。截圖裡看得很清楚:綠點與琥珀點浮在窗景的像素天空上,`.routemap-label` 的站名 tooltip 還橫跨過「博愛座 Priority Seats」的貼紙,並與線上版的音效鍵重疊。

**建議**:兩個選項,都比現在對:

**(A) 移到中央窗與右窗之間的壁面**(x 約 70%–88%),維持垂直排列。壁面是深色實體,圓點與線條有正確的底。

**(B)(更推薦)改成 LED 條下方的水平路線圖。** 真實的台鐵/捷運車廂在車門上方就是一條**水平的路線圖 + 亮燈的當前站**。把 6 站排成一條水平線放在 LED 條正下方(y 約 11%–15%),當前站亮琥珀、已過站填 `--emu-green` 實心、未到站空心。這樣:

- 與 LED 報站形成一個完整的「車門上方資訊區」(真實世界的正確位置)
- 完全離開所有車窗
- 空出整個右側,讓右車窗真的能被看見
- 水平排列讓「路線 / 進度」的隱喻更強(垂直的線像目錄,水平的線像路線)
- 順帶解決 5.3 的語言鍵衝突(把語言鍵移到那條資訊帶的最右端,變成資訊帶的一部分)

**為什麼**:路線圖現在是「疊在畫面上的導覽 UI」,而它有機會是「車廂裡的路線圖」。同一份功能,一個讀起來像網頁元件,一個讀起來像車廂設備。

**影響力:高 / 工作量:M**

---

### 5.3 語言鍵壓在 LED 報站條上

**問題**:`TopBar.tsx` `position: fixed; top: 14; right: 14`,高度約 31px → 佔 y 14–45px。`LED_RECT = { top: 4.1%, h: 6.2% }`(progress.ts:32),在 615px 的舞台上 → y 25–63px。**重疊 20px**。手機版更明顯:390px 寬時「中 / EN」直接坐在跑馬燈上(已截圖確認)。

兩者都是「標示」,在視覺上互相競爭,而且語言鍵的玻璃圓角膠囊風格跟 LED 的硬邊像素風格完全不同語言。

**建議**:把語言鍵併入 5.2(B) 的「車門上方資訊帶」最右端,並改用 LED 的視覺語言:`--font-led`、`#06ff31`、方角、無圓角、`中 ▸ EN`。它就變成車廂顯示器的一個欄位,而不是浮在上面的網頁按鈕。靜音鍵同理(目前在左上角,`opacity: .55`,用 emoji,見 8.6)。

**影響力:中高 / 工作量:S**

---

### 5.4 `gate` 相位是一片 988px 的空白虛空

**問題**:`TOTAL_LEN = 7600`,`PHASE.gateEnd = 0.13` → gate 佔 **988px 的捲動距離**,而這段期間畫面上只有一顆置中的綠色按鈕,背景是純 `#1f241f`。實測第一張截圖就是這個:**一整片深綠黑的空白,中間一顆小字**。沒有任何東西暗示這是一個車站、一列車、一個夜晚。

`exit` 佔 0.2 → 1520px,`ride` 六站佔 5092px → 每站間隔約 1018px。

**建議**:

1. gate 不該是空的。它是**月台**(第一站的 scene 就叫 `platform`,`scene.ts:80-116` 已經畫好了一個完整的夜間月台:頂棚日光燈、光池、警戒線、台北站名燈牌、壁掛時鐘)。讓 gate 直接顯示這個 platform 場景**全屏**(不透過車窗),按鈕疊在上面。使用者一進站就站在月台上,按鈕的語意「開始乘車」瞬間成立。這幾乎不需要新資產,`drawScene(canvas, "platform")` 就好。
2. gate 縮短到 0.06(約 456px)。它的功能只是「按下按鈕」,不需要 988px。省下的距離給 `exit`(轉身動畫目前 1520px 略嫌趕)或平均分給六站。
3. 目前 `TOTAL_LEN` 是寫死的 7600px,與視窗高度無關。橫式手機(844×390)會變成 19 個螢幕高。改成 `TOTAL_LEN = Math.max(5200, window.innerHeight * 8.5)`。

**為什麼**:第一印象是一片空白。skill §4.8 說得直接:純文字 + 純色背景不是極簡,是沒做完。你已經有月台場景了,只是沒用在最需要它的地方。

**影響力:極高 / 工作量:S**

---

## 6. 出站大廳 Concourse(這裡空間最大)

**現況盤點**(`components/Concourse.tsx` 56 行 + globals.css:132-144):

- 760px 置中單欄,`min-height: 100vh`,三個區塊 `gap: 40px`
- Hero:`<h2 class="eyebrow">CONCOURSE</h2>` + 一行姓名職稱
- 關於我:兩段文字,**逐字抄自 `STATIONS[0].panel.body` 與 `STATIONS[5].panel.body`**(`Concourse.tsx:20-21, 29-30`)
- 保持聯絡:三顆膠囊連結 + 履歷(**與終點站完全相同的 `terminal.contacts` 與 `terminal.link`**)
- Footer:`space-between` 的兩個 span

三個區塊全部是同一個版型家族(`h3` 小標 + 內容),內容加起來約 600px,塞在 `min-height: 100vh` 裡 → 桌機下半部是大片死空間。上面剛結束一段電影感的第一人稱轉身,落地就是一張純文字頁。落差確實巨大。

---

### 6.1 用「時刻表看板」當作品索引(最高價值的單一新增)

**問題**:整份作品集沒有任何**可掃描的總覽**。要看完四個專案,必須捲完 5000px 的 pin 動畫。而 recruiter 平均在一份作品集上停留不到 60 秒。同時 1.3 的 SEO 問題也源自這裡。

**建議**:Concourse 的第一塊做一個真實的**台鐵出發看板 / 時刻表**:

```
◄ 本日行駛紀錄  DEPARTURES ►
─────────────────────────────────────────────────────────
 序   站名                    年份    停靠內容                     月台
─────────────────────────────────────────────────────────
 01   月台・出發              ··      關於我 · Software Engineer      1
 02   電商推薦系統            2024    BigQuery ML · GCP · Redis       2
 03   LINE LIFF 會員綁定      2024    Vue3 · Serverless · AES/OTP     3
 04   AI 工具整合             2025    Claude Code · Gemini · SDD      4
 05   技能車廂                ··      Frontend / Backend / Data / AI  5
 06   終點站・聯絡            ··      Contact · Résumé                6
─────────────────────────────────────────────────────────
```

實作要點:

- 每一列可點,`onClick` 呼叫 `ScrollJourney` 的 `jumpTo(i)`(把 `jumpTo` 提到 context 或 module scope 即可共用),捲回該站重看
- hover 時該列**翻牌 / 亮起**(`--font-led` + `#06ff31`,`transition` 只動 background 與 color)
- 版型家族:**表格**,與其他區塊完全不同(解掉「三塊同一版型」)
- 這是 skill §4.9 的「長清單要換 UI 元件」的正解:6 站 × 5 欄的資料,表格才是對的,而在這個主題裡表格就是時刻表
- 注意 skill 的 hairline 規則:**不要每列都畫 `border-b`**。只在表頭下、表尾上各一條線,列與列之間用 hover 背景區分

這一塊同時解決:SEO(六站文字全部進 SSR DOM)、recruiter 掃描路徑、Concourse 空洞、缺乏 layout family 多樣性。

**為什麼**:時刻表是台鐵語言裡**最本質的資訊設計物件**,而它剛好就是「作品索引」需要的形式。這不是把作品集塞進主題,是主題本來就有這個位置。

**影響力:極高 / 工作量:M**

---

### 6.2 「關於我」逐字重複已讀過的內容

**問題**:`Concourse.tsx:29-30` 直接渲染 `hero.body` 與 `terminal.body`。使用者在月台站(第一站)已經讀過第一段,在終點站(第六站)已經讀過第二段,捲下來又看到一次一模一樣的字。「關於我」這個標題下面沒有任何新資訊。

**建議**:Concourse 需要**自己的聲音**。車廂裡的六張卡是「作品」,出站大廳是「人」。寫三段新的、簡短的(各 40–60 字):

1. **怎麼工作的**:例如你在電商領域同時碰前端、資料管線與追蹤,這個組合稀有在哪
2. **接下來想做什麼**:正在找什麼樣的角色 / 團隊(這是 recruiter 最想看到、目前完全沒有的資訊)
3. **這個網站本身**:一句話說明窗景是程式即時渲染的 pixel art、車廂是 AI 生成的原創插畫。**這是你最強的技術展示,而目前只寫在 README 裡沒人看得到。**

第 3 段可以配一小塊「製作說明」:`lib/scene.ts` 逐像素繪製、GSAP pin + 相位數學、六站燈光曲線。對技術主管來說,這一段比任何一個專案敘述都有說服力。

**影響力:高 / 工作量:S(主要是寫文案)**

---

### 6.3 沒有 `<h1>`,而 hero 只是一個標籤

**問題**:`<h2 className="eyebrow">CONCOURSE</h2>`,樣式是 `font-size: clamp(18px, 3vw, 26px); letter-spacing: .3em; color: var(--green)`(globals.css:137)。這是一個**小標籤的樣式**,不是 hero。整個互動版路徑(非 reduced-motion)**沒有任何 `<h1>`**。而且 `CONCOURSE` 這個字對訪客沒有資訊量 —— 它是一個地點標籤,不是一個訊息。

同時 skill 明文禁止 eyebrow 濫用(§4.7),而這裡的 eyebrow 是**唯一的標題**。

**建議**:Concourse hero 重做成一個真正的 hero,但用車站語言:

```html
<h1>
  <span class="h1-zh">蔡守傑</span>
  <span class="h1-en">NoopyCai</span>
</h1>
<p class="h1-role">Software Engineer · 前端 / 全端</p>
```

`h1` 用 `clamp(40px, 7vw, 76px)`,中文與英文名做兩級對比(中文大、英文小且 `--font-led` + 字距),像車站的**站名牌**(中文大字 + 底下小的羅馬拼音)—— 這是台鐵站牌的實際排版規則,套在人名上就是原創的個人標示。`CONCOURSE` 保留為 hero 上方的一行小字,但降到 11px 當**方位標示**(真實車站的「出口 / Concourse」指示牌就是這個尺寸關係)。

注意 skill 的 hero 紀律:最多 4 個文字元素。這裡是 3 個(方位標示 / 姓名 / 職稱),合格。

**影響力:極高(SEO + 視覺)/ 工作量:S**

---

### 6.4 聯絡區與終點站是同一份 CTA,重複兩次

**問題**:`STATIONS[5]`(終點站・聯絡)渲染 email / GitHub / LinkedIn / 履歷;`Concourse` 的「保持聯絡」渲染**完全相同的四項**(同一個 `terminal.contacts`、同一個 `terminal.link`)。兩者相隔不到一個螢幕。這違反 skill §4.5 的 duplicate CTA intent。

**建議**:分工,各自只做一件事:

- **終點站(車廂內)**= 情緒收尾。只留「終點站 到了 · 感謝搭乘」的到站廣播 + 一句「出站後可以找我」,**不放連結**。這一站的作用是讓旅程有結束感。
- **Concourse**= 唯一的行動點,而且做成**出口指示牌**(見 6.5)。

**影響力:中高 / 工作量:S**

---

### 6.5 膠囊連結太通用,可以換成台鐵出口指示

**問題**:`.concourse-link` 是 `border-radius: 999px` 的綠框膠囊(globals.css:142),三顆並排。這是任何網站的 footer 都長這樣的元件,是整站唯一一處讀起來「通用」的地方。而且它與整站的形狀系統不一致(skill §4.4 的 shape consistency lock):`.glasscard` 26px、`.detail-card` 16px、`.routemap-label` 6px、`.sp-tag` 999px、`.concourse-link` 999px、`.led` 0px。**六種圓角。**

**建議**:改成**車站出口指示牌**。真實台鐵/捷運的出口牌是綠底白字(或白底綠字)+ 方向箭頭 + 編號:

```
┌──────────────┬──────────────┬──────────────┐
│  出口 1  ↗   │  出口 2  ↗   │  出口 3  ↗   │
│  GitHub      │  LinkedIn    │  Email       │
│  看程式碼    │  看經歷      │  直接聊      │
└──────────────┴──────────────┴──────────────┘
```

方角(`border-radius: 2px`)、`--emu-green` 底、白字、`--font-led` 的編號。每個出口加一行「去那裡會看到什麼」的小字(這是真實出口牌的資訊結構:編號 + 方向 + 目的地)。履歷 PDF 變成第四個出口或一個獨立的「售票處 / 領取文件」。

同時把整站圓角收斂成三級並寫成規則:**LED / 標示牌 = 0–2px、卡片 = 20px、標籤膠囊 = 999px**。

**為什麼**:這是把「通用元件」換成「主題元件」而不增加任何複雜度的一次替換,而且方向箭頭 + 編號 + 目的地說明的資訊結構**比膠囊更好用**(訪客知道點下去會看到什麼)。

**影響力:高 / 工作量:S**

---

### 6.6 Footer 太薄,而且用了 em-dash

**問題**:

```
justify-content: space-between  →  760px 欄寬下兩段文字飛到兩端
「© 2026 蔡守傑 NoopyCai」  ...  「夜車・區間 — 感謝搭乘」
```

em-dash 是 AI 生成內容最強的視覺特徵,skill 列為零容忍。EN 版 `"Night Local — thanks for riding"` 同樣有。`StaticFallback.tsx:12`、`layout.tsx` 的 metadata description、以及 `stations.ts` 多處英文 body 都有。

**建議**:

1. 全部 em-dash 換掉:`夜車・區間 · 感謝搭乘` / `Night Local · thanks for riding`。用 `grep -n "—" content/ components/ app/` 掃一遍使用者可見字串。
2. Footer 做成**車票票根 (ticket stub)**:這是整趟旅程最自然的結尾物件。

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│ 區間車 · LOCAL          NO. 2026-0729      ╎
│ 起站 月台・出發  →  終站 終點站・聯絡      ╎
│ 全程 6 站 · 感謝搭乘                       ╎
│ © 2026 蔡守傑 NoopyCai                     ╎
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

虛線邊 + 右側撕票齒孔(`repeating-linear-gradient` 或 `radial-gradient` 打洞)。純 CSS,20 行以內。

**為什麼**:footer 是最後的印象。目前是「© 加一句標語」,可以是「你剛剛搭完一趟車的憑證」。這種收尾會被記住並被轉發。

**影響力:中高 / 工作量:S**

---

### 6.7 `min-height: 100vh` 造成大片死空間,且 iOS 會跳動

**問題**:`.concourse { min-height: 100vh; padding: 8vh 24px 44px }`。內容約 600px,桌機 900px 高 → 下方約 250px 空白,且 `100vh` 在 iOS Safari 會因位址欄伸縮而跳版(skill §3.E 明文要求 `100dvh`)。`ScrollJourney.tsx:134` 的 `height: "100vh"` 也是同一個問題(這個更嚴重,因為它是被 pin 的舞台)。

**建議**:兩處 `100vh` → `100dvh`(保留 `100vh` 當 fallback)。`.concourse` 加了 6.1 的時刻表與 6.6 的票根之後內容自然超過一屏,`min-height` 可以直接拿掉。單欄寬度從 760px 放寬到 **920px**(時刻表需要橫向空間)。

**影響力:中(`100dvh` 在手機上是高影響)/ 工作量:S**

---

### 6.8 Concourse 沒有進場動畫,與上面的落差因此更大

**問題**:`.camera` 在 `exit` 尾段淡出,`concourse-intro` 淡入(銜接處理得不錯,`ConcourseHero` 共用元件確保 pin 解除瞬間畫面一致,這個設計是對的)。但 pin 解除之後,Concourse 的三個區塊是**純靜態**的。上面剛跑完一段第一人稱轉身,下面完全不動。

**建議**:Concourse 各區塊加 scroll-reveal(`opacity` + `translateY(20px)`,`IntersectionObserver` 或 CSS `animation-timeline: view()`,不要用 GSAP —— 這裡不需要 pin/scrub,skill §5.C 明確建議輕量方案)。時刻表的六列做 **stagger 50ms 逐列翻牌** —— 那是真實出發看板的行為,動機明確(storytelling),不是為了動。

**影響力:中 / 工作量:S**

---

## 7. 六站內容的資訊設計

### 7.1 三種 `metrics` 裡只有一個是真的數據

**問題**:`content/stations.ts` 的 metrics 欄位:

```
station 2:  "3" 推薦策略  /  "Top20" 分類熱銷  /  "RT" 即時個人化
station 3:  "AES-256" 時效登入  /  "OTP" Email 驗證
station 4:  "80%" 省手刻時間
station 1 / 5 / 6:  無
```

`.sp-metric-n` 是琥珀色 24px 粗體 —— 視覺上最強的元素。但 `AES-256`、`OTP`、`RT`、`Top20` **是技術名稱,不是量測值**,把它們放在最大的數字位置,會讓唯一真實的量測值(`80%`)貶值。skill §4.9 對此有明確規則:metric slot 只放測到的量。而且 metrics 在 6 站中只有 3 站有,那條數據列時有時無,破壞每張卡的節奏。

**建議**:

1. `AES-256` / `OTP` / `RT` 移到 `tags`(那裡已經有 `Redis`、`GCF` 等技術名,語意一致)。
2. metrics 只留真實量測值。如果 station 3 找不到可公開的數字(綁定人數、登入成功率、導流轉換),就**不放 metric 列**,並讓那一站靠 `impact` + `tags` 撐 —— 這比放假數據好。
3. 想補真數字的方向(都是你手上應該有的):推薦系統的 API p95 延遲 / 每日推薦請求數 / 商品覆蓋率;LIFF 的綁定完成率 / QR 導流人數;AI 工具的週報產出篇數 / 節省工時。
4. 統一:要嘛六站都有一個「站點指標」(技能站可以是「5 個領域 / 29 項技術」,月台站可以是年資),要嘛只有專案站有。**時有時無是最差的選項。**

**影響力:高 / 工作量:S(改資料)到 M(如果要去挖真數字)**

---

### 7.2 四個 `kind` 但只有一種版型,兩個非專案站因此顯得沒做完

**問題**:`PanelData.kind` 有 `"hero" | "project" | "skills" | "contact"` 四種,但 `StationPanel.tsx` 只是把所有欄位**依固定順序條件渲染**(head → h2 → sub → impact → body → tags → metrics → skills → contacts → actions)。`kind` 這個欄位實際上**從未被用到**(全檔搜不到 `p.kind`)。結果:

- **`hero`(月台站)**:只有 title + subtitle + body。**沒有 impact、沒有 tags、沒有任何 CTA、沒有 detail。** 這是訪客看到的第一張卡,卻是六張裡最空的一張,而且無事可做。
- **`skills`(技能車廂)**:5 組 × 平均 5.8 項 = **29 個項目**,渲染成 `<b>前端</b>:HTML5、CSS3、ES6+、Vue3、jQuery、GSAP` 五行純文字。這是 skill §4.9 明文點名的「長清單用 `<ul>` 硬列」反模式,而且沒有 impact / metrics,節奏與前三站完全斷開。
- **`contact`(終點站)**:見 6.4,與 Concourse 完全重複。

**建議**:讓 `kind` 真正驅動版型:

- **`hero`**:加一句 impact(例如「電商前後端 · 從 UI 到資料管線一個人打通」,這是你的定位句),加一組 `tags`(3–4 個核心技術),加一個 CTA「▸ 前往下一站」(點了 `jumpTo(1)`)。第一張卡必須給出方向。
- **`skills`**:29 項砍到 **每組 4 項、共 5 組 = 20 項**,並改用已存在的 `.sp-tag` 膠囊 + 兩欄 grid(`grid-template-columns: repeat(2, 1fr)`)。同時加**熟練度層級**:真實技能表的價值在「哪些是我真的深」。建議每組第一項用 `--green` 實心膠囊表示主力、其餘空心。這樣一張卡就從「條列」變成「有觀點的技能圖」。
- **`contact`**:見 6.4,瘦身成純情緒收尾。

**影響力:高 / 工作量:M**

---

### 7.3 沒有任何一個專案有可驗證的連結

**問題**:`PanelData.links?: Link[]` 型別定義了、`.sp-link` CSS 寫了、`StationPanel.tsx:74-76` 渲染邏輯寫了 —— 但 `stations.ts` 裡兩處都是註解掉的 `// links: [{ label: "Demo", href: "…" }],  // TODO: 有可公開連結再補`。三個專案,**零個 repo、零個 demo、零個 case study 連結**。整條 `.sp-link` 是死程式碼。

同時 `year: "2024" // TODO: 確認實際年份` 在兩站出現,時刻表感的「年份」欄位是猜的。

**建議**:這是作品集的核心缺口,優先於任何視覺調整。

1. 三個專案至少各給**一個可驗證的東西**。公司專案不能開源,可行的替代品:
   - (a) 抽出一個可公開的技術 write-up(推薦系統的 I2I 隱式矩陣分解實作筆記就是很好的一篇)
   - (b) 打碼過的架構圖 / 資料流圖放進「看細節」modal
   - (c) 一個簡化版的 side-project demo
2. 「看細節」modal 目前只有三段純文字(問題 / 做法 / 成果)。加**一張架構圖**。推薦系統的 `Cloud Pub/Sub → BigQuery → Redis → API` 是一張圖就講完的事,而且畫成台鐵風格的**路線圖**(節點 = 站、資料流 = 路線)會極度貼合主題。這是全站最好的一個「主題 × 內容」交會點。
3. 確認並補上真實年份,或改成更誠實的欄位(`2023-2024`、`在職期間`)。

**影響力:極高(內容 > 視覺)/ 工作量:M 到 L**

---

### 7.4 `year · role` 的 meta 列時有時無

**問題**:`StationPanel.tsx:29-31` `{(p.year || p.role) && ...}`。三個專案站有「2024 · 獨立開發」,月台 / 技能 / 終點三站什麼都沒有。所以每張卡的抬頭高度在六站之間跳動,站名列的下緣位置不一致(手機版還在那條線上畫了 `border-bottom`,globals.css:188,所以跳動更明顯)。

**建議**:讓 meta 列**六站都有內容**,用時刻表的三欄語意:`站序 · 年份 · 角色`。非專案站填 `01 · 出發 · ··` 之類的固定值。三欄固定寬(`font-variant-numeric: tabular-nums`)保證位置一致。

**為什麼**:這是最便宜的「一致性」修正。抬頭是六張卡唯一必然共有的結構,讓它變成穩定的基準線,其他內容的差異才不會讀成不完整。

**影響力:中 / 工作量:S**

---

### 7.5 桌機 body 太長,窄卡化之後必須砍

**問題**:`.sp-body` 15px / line-height 1.75,最長的是 station 2(約 120 字),在 42% 寬的卡上約 5 行。搭配 5.1 建議的 21% 窄卡會變成 10 行以上。skill §4.9 的預設是每區塊 sub-paragraph ≤ 25 字。

**建議**:把資訊拆成三層,各有明確的職責(`stations.ts` 的型別已經支援):

- `impact`(1 句,≤ 30 字)= 一眼看到的成果 → 放大(見 2.3)
- `body`(**砍到 45–55 字**)= 做了什麼 → 卡片上顯示
- `detail.problem / approach / result`(各 60–90 字)= 完整故事 → 「看細節」modal,已經寫好了

現在的 `body` 其實是 `detail.approach` 的濃縮版,兩者重複度很高(比對 station 2 的 body 與 detail.approach,內容幾乎相同)。把 body 砍成「一句做什麼 + 一句技術路線」,深度全部交給 modal。

**影響力:中高 / 工作量:S**

---

## 8. 手機體驗(還沒處理到的)

### 8.1 路線圖圓點在手機是 10px 的觸控目標,而它是唯一的導覽

**問題**:`@media (max-width: 640px)` 裡 `.routemap-dot { width: 10px; height: 10px }`(globals.css:209),且 `.routemap-label { display: none }`(:210)。所以手機上的主要導覽是**六個 10px 的無標籤圓點**,垂直間距 13px。WCAG 2.5.5 要求 44×44,Apple HIG 要求 44pt。最近一輪把 `.detail-btn` 拉到 44px(`padding: 11px 18px`,:207)是對的,但漏了這個更重要的元件。

**建議**:視覺仍是 10px,但撐開命中區:

```css
.routemap-dot {
  width: 44px; height: 44px;
  padding: 17px;                 /* (44-10)/2 */
  border: none; background: none;
  display: grid; place-items: center;
}
.routemap-dot::before {          /* 視覺圓點移到 pseudo-element */
  content: ""; width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--emu-green); background: var(--bg);
}
```

`gap` 從 13px 改成 0(44px 的盒子本身就有間距)。若採用 5.2(B) 的水平路線圖,改成水平的 44px 命中區,同樣做法。

**影響力:高 / 工作量:S**

---

### 8.2 卡片內捲動會穿透到頁面捲動,把整趟車拉走

**問題**:`@media (max-width: 640px)` 的 `.station-panel { max-height: 84vh; overflow-y: auto }`(globals.css:182)。這張卡在一個被 GSAP pin 住的頁面裡。在 iOS Safari 上,卡片內捲到底之後手勢會 **scroll chaining** 到 `document`,於是使用者以為在讀卡片,實際上整列車被拉往下一站。

**建議**:`.station-panel { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }`。並且更根本地:如果 7.5 把 body 砍短,這張卡在 390×844 上根本不需要捲動(`max-height: 84vh` 的保險就永遠不會觸發)—— 那是更好的解。

**影響力:高(是實質的體驗 bug)/ 工作量:S**

---

### 8.3 橫式手機直接 `display: none` 掉整層內容

**問題**:`@media (max-height: 480px) and (orientation: landscape)` 裡 `.station-panel .sp-body { display: none }`(globals.css:219)。橫拿手機的使用者**看不到任何專案敘述**,只剩標題、impact、tags。而橫拿手機看 pin 動畫的網站是很常見的行為(畫面更大、更有電影感)。

**建議**:不要隱藏,改成 2 欄橫排:左欄 站名/標題/impact,右欄 body/tags/metrics。橫式螢幕的寬度是多出來的資源,應該用來**重排**而不是**刪除**。`max-width` 從 46% 放到 58%,兩欄各 ~28%。

**影響力:中 / 工作量:S**

---

### 8.4 `TOTAL_LEN` 寫死,橫式手機要捲 19 個螢幕

見 5.4 第 3 點。`TOTAL_LEN = 7600` 在 844×390 的橫式手機上等於 19.5 個視窗高度。改成 `Math.max(5200, innerHeight * 8.5)`,並在 `resize` / `orientationchange` 時 `ScrollTrigger.refresh()`(目前 `useEffect` 的 deps 是 `[]`,方向改變後 pin 距離不會重算)。

**影響力:中 / 工作量:S**

---

### 8.5 沒有觸控手勢,捲動是唯一的操作方式

**問題**:手機上要跳站只能點 10px 的圓點(8.1)。沒有左右滑動換站。

**建議**:加水平 swipe → `jumpTo(index ± 1)`。這在主題上完全成立(滑動 = 車廂往前走),而且是手機使用者的本能。用 `pointerdown/move/up` 判斷水平位移 > 60px 且垂直位移 < 30px,約 25 行。注意要與 8.2 的卡片內捲動區分(卡片內的手勢不觸發)。

**影響力:中 / 工作量:S**

---

### 8.6 靜音鍵是 emoji

**問題**:`SoundToggle.tsx:81` `{on ? "🔊" : "🔇"}`。emoji 在 Android(Noto Color Emoji)、Windows(Segoe UI Emoji)、iOS(Apple Color Emoji)長得完全不一樣,都是**彩色的、圓潤的、卡通的**,和整站的 LED 綠 / 像素 / 深色語言正面衝突。skill §3.D 預設不建議 emoji。而且 `opacity: .55` 的彩色 emoji 在深色底上會顯得髒。

**建議**:換成 `--font-led` 綠色的字符(`♪` / `♪̸`,或 `◉` / `◎`),或用 `@phosphor-icons/react` 的 `SpeakerSimpleHigh` / `SpeakerSimpleSlash`(skill 允許的 icon library,`strokeWidth: 1.5`),著色為 `--green`。位置與樣式併入 5.2(B) 的車門上方資訊帶。

**影響力:中 / 工作量:S**

---

## 9. 無障礙

### 9.1 全站只有一處 `:focus-visible`

**問題**:`grep focus-visible` 在 `app/globals.css` 只命中 `.sound-dot:hover, .sound-dot:focus-visible { opacity: 1 }`(:41)。`.start`(`border: none; background: none`)、`.detail-btn`、`.routemap-dot`、`.concourse-link`、`.sp-link`、`.ctrl`、`.detail-close` **都沒有設計過的 focus 樣式**,只有瀏覽器預設外框。在 `.start` 這種無邊框無背景的按鈕上,預設外框會出現在文字的緊貼邊界,配合它的 `text-shadow` 光暈幾乎看不見。

**建議**:一條全域規則,用 LED 綠當 focus 色(主題內完全成立:「這個控制項通電了」):

```css
:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 3px;
  border-radius: 4px;
}
.routemap-dot:focus-visible { outline-offset: 5px; }
```

5 行,解決整站鍵盤可視性。

**影響力:高 / 工作量:S**

---

### 9.2 「看細節」modal 沒有 Escape、沒有 focus trap、沒有焦點歸還

**問題**:`StationPanel.tsx:86` 有 `role="dialog" aria-modal="true"`(宣告了 modal 語意),但:

- **沒有 `Escape` 關閉**(全 repo 搜不到 `Escape` / `keydown`)
- **沒有 focus trap**:Tab 會跑到 modal 後面的路線圖與語言鍵
- **沒有初始焦點**:開啟後焦點還在觸發按鈕上
- **沒有焦點歸還**:關閉後焦點丟失
- **沒有 `aria-labelledby`** 指向 `h3`
- 遮罩 `onClick` 關閉,但遮罩是 `div`,**鍵盤無法觸發**

宣告了 `aria-modal="true"` 卻沒有實作 modal 行為,比不宣告更糟(螢幕閱讀器會相信這個宣告)。

**建議**:這是 dialog 的標準補完(約 25 行),或直接用原生 `<dialog>` + `showModal()` —— 原生元素免費提供 Escape、focus trap、`::backdrop`、inert 背景。既然沒有 UI framework,原生 `<dialog>` 是最省的路(Baseline 2022,Safari 15.4+)。

**影響力:高 / 工作量:S**

---

### 9.3 換站對螢幕閱讀器是完全無聲的

**問題**:`LedSign.tsx:6` 有 `aria-hidden`(合理,因為 `.repeat(3)` 會念三遍),但沒有替代品。`StationPanel` 的內容變化沒有 `aria-live`。所以螢幕閱讀器使用者捲動時,畫面上的內容全部換了,**沒有任何通知**。全 repo 搜不到 `aria-live`。

**建議**:加一個視覺隱藏的 live region,內容就是「到站廣播」:

```jsx
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {`到站:${t(station.name)}。${t(p.title)}。${p.impact ? t(p.impact) : ""}`}
</div>
```

掛在 `ScrollJourney`,只在 `index` 改變時更新(不要綁 `p`,否則每幀都在播報)。這在主題上是**完美對應**的:真實的車廂到站廣播就是給看不到 LED 的人聽的。

**影響力:高 / 工作量:S**

---

### 9.4 語言切換不更新 `<html lang>`

**問題**:`layout.tsx:28` 寫死 `<html lang="zh-Hant">`。`LangProvider` 切到英文後,全站文字變英文但 `lang` 屬性不變。螢幕閱讀器會用中文語音引擎念英文,結果不可理解。

**建議**:`LangProvider` 的 `toggle` 裡加 `document.documentElement.lang = next === "zh" ? "zh-Hant" : "en"`。一行。

**影響力:中高(對受影響使用者是致命的)/ 工作量:S**

---

### 9.5 StaticFallback 完成度約 40%,而且吃掉了整個 Concourse

**問題**:`components/StaticFallback.tsx` 51 行,只渲染 `name / title / subtitle / body / tags / skills / contacts / link`。**缺少**:`impact`(你定義的關鍵成果句)、`metrics`、`year`、`role`、`detail`(問題/做法/成果三段,也就是每個專案最完整的敘述)。

更嚴重的是 `app/page.tsx:18-26`:

```jsx
{reduce ? <StaticFallback /> : <><SoundToggle/><ScrollJourney/><Concourse/></>}
```

reduced-motion 使用者拿到 `StaticFallback` **而不是** Concourse,所以他們**完全看不到**「關於我」、「保持聯絡」、footer、以及 6.1 要加的時刻表。這一組使用者拿到的是一份殘缺的網站。

而且視覺上,StaticFallback 全部是 inline style 的無襯線文字區塊,**沒有任何設計語言**:沒有玻璃卡、沒有 LED、沒有燈光、沒有窗景。它讀起來像另一個網站的純文字版。

**建議**:

1. **結構修正**:`{reduce ? <StaticFallback/> : <ScrollJourney/>}` 然後 `<Concourse/>` **永遠**渲染。Concourse 本來就是普通捲動區塊,沒有理由對 reduced-motion 使用者隱藏。
2. **內容補齊**:補 `impact`、`metrics`、`year/role`、`detail` 三段。資料都在,只是沒渲染。
3. **視覺補齊(最有價值的一項)**:`lib/scene.ts` 的 `drawScene` 是一個**純函式**,不含任何動畫。reduced-motion 禁止的是動態,不是圖像。所以每個 section 都可以放一張**靜態窗景** —— 用 `drawScene` 在 mount 時畫一次(或 build 時預先產生 6 張 PNG)。加上 `.glasscard` 的樣式、`--font-led` 的站名、以及該站的 `grade` 色調當 section 底色,這份 fallback 就從「文字大綱」變成「同一個作品集的靜態版」。
4. 順帶:`reduce` 用 `useState(false)` + `useEffect`(page.tsx:11-14)會讓 reduced-motion 使用者**先看到一閃的動畫版**(GSAP 註冊、canvas 繪製全都跑了)才切換。改用 `useSyncExternalStore` 讀 matchMedia,或用 CSS 先隱藏(`@media (prefers-reduced-motion: reduce) { .journey { display: none } }`)避免閃爍與浪費。

**為什麼**:reduced-motion 不是「不在意設計的使用者」,它包含前庭障礙者與偏好低動態的一般使用者。目前的降級版把他們當成爬蟲對待。而修好之後,這份靜態版**同時是 SEO 的解**(見 1.3)與**低頻寬使用者的解**。一石三鳥。

**影響力:高 / 工作量:M**

---

### 9.6 `prefers-reduced-transparency` 只顧了一個元件

**問題**:globals.css:95-97 為 `.glasscard` 處理了 `prefers-reduced-transparency: reduce`(做得好)。但 `.detail-modal { backdrop-filter: blur(4px) }`(:115)、`.ctrl { backdrop-filter: blur(8px) }`(:37)、`.routemap-label { backdrop-filter: blur(6px) }`(:106)都沒有。

**建議**:把三者併入同一個 media query 區塊,改實色底。

**影響力:低中 / 工作量:S**

---

### 9.7 車廂圖的 alt 文字沒有描述窗景

**問題**:`CabinComposite.tsx:15` `alt="EMU900 車廂內裝 · EMU900 train interior"`。這張圖是整個畫面,而窗景(真正在變化的內容)是 canvas,`<canvas>` 沒有任何 `aria-label` 或 `role="img"`。所以螢幕閱讀器完全不知道窗外有什麼。

**建議**:`<canvas role="img" aria-label={sceneDescription[scene]}>`,六站各一句描述(「夜間月台,頂棚日光燈與月台燈光池」/「破曉的南迴海景,日出與海面倒影」)。這些描述本身也是好文案,可以順便用在 9.3 的 live region 與 6.2 的「這個網站」段落。

**影響力:中 / 工作量:S**

---

## 10. SEO / OG image / metadata

### 10.1 見 1.3(無 `h1`、四站內容不在 SSR)

這是本節最重要的一項,已在第 1 節詳述。

---

### 10.2 OG image 是全站最弱的資產

**問題**:`app/opengraph-image.tsx` 是四行文字疊在純色 `#1f241f` 上,`fontFamily: "monospace"`(edge runtime 沒有載入任何字型,所以會用預設字型;目前內容全是拉丁字母才沒出事)。一個賣點是「照片級車廂 + 即時渲染窗景 + 電影感捲動」的網站,分享卡是**沒有任何圖像的純文字**。而且卡上**沒有中文名字**,但主要觀眾是台灣的 recruiter。

**建議**:

1. 卡面換成**一格車廂畫面**:cabin.jpg 的中央窗區域裁切 + 一張 `drawScene("sea")` 的破曉窗景(最好看的一站)+ 上方 LED 條寫站名。`next/og` 的 `ImageResponse` 支援 `<img src="data:image/jpeg;base64,...">`,把一張縮到 1200 寬的 JPEG 內嵌即可。
2. 嵌入 CJK 字型子集(`fonts: [{ name: "Noto Sans TC", data: await fetch(...).then(r=>r.arrayBuffer()) }]`),把 `蔡守傑` 放上去。只需要 4 個字的 subset,幾 KB。
3. 另外做 `app/twitter-image.tsx`(或共用),並在 metadata 補 `twitter.description`(目前只有 title)。

**為什麼**:OG image 是**唯一一個不需要對方點進來就會看到的設計品**。LinkedIn / Slack / LINE 上分享時,它就是你的第一印象。目前它放棄了這個機會。

**影響力:高 / 工作量:M**

---

### 10.3 沒有 JSON-LD

**問題**:`grep 'application/ld+json'` → 0。

**建議**:`layout.tsx` 加一個 `Person` + `hasPart: CreativeWork[]` 的圖譜:

```json
{"@context":"https://schema.org","@type":"Person",
 "name":"蔡守傑","alternateName":"NoopyCai",
 "jobTitle":"Software Engineer",
 "sameAs":["https://github.com/NoopyCai",
           "https://www.linkedin.com/in/noopy-cai-b1495737a"],
 "knowsAbout":["BigQuery ML","Vue3","Node.js","GCP","LINE LIFF","Magento2"]}
```

外加每個專案一筆 `CreativeWork`(`name` / `description` = impact / `keywords` = tags)。資料全部可以從 `STATIONS` 程式化產生,不需要手寫。

**為什麼**:對「蔡守傑 前端工程師」這類搜尋,結構化資料是 Google 建立實體關聯的主要輸入。對一份靠姓名被找到的個人作品集,這是投報率最高的 SEO 動作。而且資料已經在 `stations.ts` 裡結構化好了。

**影響力:高 / 工作量:S**

---

### 10.4 metadata 缺 canonical / url / siteName;sitemap 的 lastModified 每次 build 都變

**問題**:

- `openGraph` 缺 `url` 與 `siteName`
- 沒有 `alternates.canonical`
- `app/sitemap.ts:7` `lastModified: new Date()` → 每次部署都變成「今天更新」,這是 Google 已知會折扣的訊號
- `metadata.description` 含 em-dash(`"night-train themed — scroll to ride"`)

**建議**:補 `openGraph.url` / `siteName` / `alternates.canonical`;`lastModified` 改成寫死的內容更新日期(或從 git 取最後 commit 日期);description 的 em-dash 換掉。

**影響力:中 / 工作量:S**

---

### 10.5 英文版對搜尋引擎完全不存在

**問題**:`LangProvider` 是純 client state(`useState<Lang>("zh")`),英文內容沒有 URL、沒有 `hreflang`、不會被索引。你在 `stations.ts` 裡為每一欄位寫了完整的英文翻譯(工作量不小),但那些字**永遠不會被 Google 看到**。

**建議**:如果英文觀眾重要(remote 職缺、外商),做 `/en` 路由(Next App Router 的 `[lang]` segment)+ `alternates.languages` + `hreflang`,語言鍵改成連結而非 state。如果不重要,就接受現況,但要知道那份英文翻譯的 SEO 價值目前是 0。這是一個**要不要投資**的決定,不是純技術問題。

**影響力:中(取決於目標市場)/ 工作量:M**

---

## 11. 效能

### 11.1 `drawScene` 沒有快取,每次換站重畫 4 次,來回捲動無限重畫

**問題**:`Window.tsx:75-96` 的 `useEffect [scene, bg]`,每次 scene 改變就:

- 中央窗(`bg=false`):`drawScene(full, {bg:false})` + `drawScene(bgc, {bg:true})` = **2 次**
- 左窗(`bg=true`):1 次
- 右窗(`bg=true`):1 次
- 共 **4 次 drawScene + 3 次 1248×260 的 strip 合成**,每次換站

而 `drawScene` 是逐像素迴圈:`grad()` 對 416×260 = 108k 個 pixel 各做一次 `fillRect(dx,dy,1,1)`;`disc()`、`waves()`、`reflectCol()` 同樣。單次成本估計數十毫秒。**而且左窗與右窗的 `bg=true` 版本內容完全相同**(同一個 scene、同一個 bg flag、同一個亂數種子),卻各畫一次。來回捲動時每次經過同一站都從頭重畫。

**建議**:module scope 的 `Map<string, HTMLCanvasElement>`,key = `${scene}|${bg}`:

```ts
const cache = new Map<string, HTMLCanvasElement>();
function getScene(scene: SceneType, bg: boolean) {
  const k = `${scene}|${bg}`;
  let c = cache.get(k);
  if (!c) {
    c = document.createElement("canvas");
    drawScene(c, scene, { bg });
    cache.set(k, c);
  }
  return c;
}
```

12 種組合最多,總記憶體 12 × 416 × 260 × 4B ≈ 5 MB。換站成本從 4 次逐像素繪製降到 0(只剩 3 次 `drawImage` 合成 strip,可以再快取)。**再進一步**:整趟旅程的 12 個 scene 在 gate 階段就用 `requestIdleCallback` 預先畫好,之後所有換站都是零成本。這剛好利用了 5.4 建議縮短但仍存在的 gate 時間。

**影響力:高 / 工作量:S(10 行左右)**

---

### 11.2 `music.mp3` 4.04 MB

**問題**:`public/music.mp3` = 4,234,971 bytes。`ensure()` 設 `preload = "auto"`,在使用者按下「開始乘車」時開始下載完整 4 MB。台灣 4G 上約 3–8 秒,且是 metered data。這個檔案也被 commit 進 git。

**建議**:

1. 重新編碼:立體聲 → 單聲道、bitrate → 96 kbps、加 fade。同樣長度可以壓到約 **500–700 KB**(8 成縮減,聽感在背景音樂用途上幾乎無差)。
2. 更好:剪成一段 30–45 秒的**無縫 loop**(列車行進的環境音本來就適合 loop),檔案降到約 250 KB。你已經在 `SoundToggle.tsx:31-38` 手寫了淡出淡入的循環邏輯,改用短 loop 反而讓那段邏輯更好聽(現在每輪結束都要淡出再淡入,短 loop 可以真正無縫)。
3. `preload` 從 `"auto"` 改 `"metadata"`,播放時再串流。
4. 考慮把 audio 放 CDN,別進 git(4 MB 的二進位檔案讓每次 clone 都變慢)。

**影響力:中高(手機使用者)/ 工作量:S**

---

### 11.3 `cabin.jpg` 424 KB,沒有 next/image,而且在需要它的前一刻才開始下載

**問題**:`CabinComposite.tsx:13-17` 用原生 `<img src="/cabin.jpg">`,沒有 `next/image`、沒有 `priority`、沒有 `fetchpriority`、沒有寬高屬性(CLS 風險,靠 `width: 100%; height: auto` 撐)。1672×941 的 JPEG 以原始格式送出。而且 `showRide` 為 false 時整個 `.camera` 不在 DOM,所以**圖片在 `p = 0.13` 那一刻才開始下載**(見 4.1)。

**建議**:

1. `layout.tsx` 加 `<link rel="preload" as="image" href="/cabin.jpg" fetchpriority="high">`。gate 階段就把它抓下來。
2. 改用 `next/image`(`fill` + `sizes="100vw"` + `priority` + `quality={82}`),Next 會產出 AVIF/WebP,**424 KB → 約 130–170 KB**。注意 `WIN` 的百分比座標是相對容器的,改成 `fill` 後容器仍是 `max(100vw, 177.68vh)` 的那個 div,百分比不受影響。需要在 `next.config.mjs` 確認沒有停用 image optimization(目前 config 是空的,預設開啟)。
3. `next.config.mjs` 目前完全空白,也可以順便開 `compress`、設 `images.formats`。

**影響力:中高(LCP + 首次搭車的 pop-in)/ 工作量:S**

---

### 11.4 repo 根目錄有 2 MB 的死圖,以及一批死程式碼

**問題**:

```
train_background.png   1,868,910 B   ← repo 根目錄,未被任何程式引用
train_background.jpg     170,928 B   ← 同上
public/resume/...pdf   2,684,528 B   ← 2.56 MB 的履歷
```

死程式碼:

- `components/WireCar.tsx`(73 行)— **零 import**
- `lib/progress.ts` 的 `stationAt()`、`panoramaOffset()` — 零呼叫(只在 test 裡)
- `content/i18n.ts` 的 `UI` 物件(7 個雙語字串)— 零使用
- `.sp-link` 相關 CSS + `StationPanel.tsx:74-76` 的 links 渲染 — 無資料(見 7.3)
- `README.md` 仍在描述已移除的 boot 相位(「進站綠色線稿藍圖 → 車窗填滿」)與「Web Audio 合成到站音」(實際上是 `train_sounds.mp3`)

**建議**:刪除兩張 train_background;履歷 PDF 壓到 500 KB 以下(2.56 MB 的 PDF 通常是圖片未壓縮);`WireCar` 要嘛接回 4.1 的轉場、要嘛刪;`stationAt` / `panoramaOffset` / `UI` 刪除並清理對應 test;README 更新到與現況一致(`docs/superpowers/plans/` 的舊計畫也該標記為歷史)。

**為什麼**:3 個未使用的 export 加一個未使用的元件,會讓下一次改動時難以判斷什麼是活的。README 描述與實作不符則會誤導任何讀 repo 的人(包括看你 GitHub 的 recruiter,這是實質的作品集傷害)。

**影響力:中(維護性 + repo 專業度)/ 工作量:S**

---

### 11.5 `will-change` 常駐兩層,以及 4.3 / 4.4 的每幀成本

見 4.3(每幀 React 重繪)與 4.4(每幀全視窗 blur)。補充:`ScrollJourney.tsx:151` 與 `:155` 兩個全視窗元素常駐 `will-change: "transform, opacity"` / `"transform"`,兩個永久的 compositing layer,各自包含 1 張大圖 + 3 個 canvas。在記憶體受限的手機上這是明顯的壓力。建議只在 `phase === "ride" || "exit"` 時掛上,其餘設 `auto`。

**影響力:中 / 工作量:S**

---

## 12. Top 5「先做這些」

依「解鎖其他改動的程度 × 影響力 ÷ 工作量」排序:

| # | 項目 | 為什麼是第一優先 | 工作量 |
|---|---|---|---|
| **1** | **補上 `DepartureMono-Regular.woff2`,並修掉假粗體(`font-weight:700` → `400`)** | 整站的字型系統目前根本沒生效。在這之前做任何排版判斷都是在評估 fallback 字型。修完之後你會看到一個不一樣的網站。§1.1 + §2.2 | **S** |
| **2** | **修 Liquid Glass 卡片在亮站的對比崩壞** | 六站中有三站的資訊層目前實質不可讀(對比 1.05:1 到 1.8:1),包含三個作品站。這是可讀性層級的問題,不是美感偏好。加 scrim + `saturate` 降到 130% + 亮站專用底色。§1.2 | **M** |
| **3** | **重排六站的燈光曲線,`taipei` 改成夜間台北 101 點燈** | 這是全站最有價值的單一改動:同時修好 (a)「夜車」敘事被正午打斷、(b) 第 2 項的最嚴重案例、(c)「車內比車外亮」的光線反轉。修完之後捲到底會真的有「搭了一夜車、天亮了」的實感。順帶把 `lerpGrade` 改成連續數值插值,消掉每次換站的跳閃。§3.1 + §3.2 | **M** |
| **4** | **Concourse 加「時刻表看板」+ 真正的 `h1`** | 一塊東西解決四件事:出站大廳的空洞、recruiter 的快速掃描路徑、六站內容進入 SSR(SEO)、版型家族的單一性。加上 `h1` 補掉「全站沒有一級標題」。這是「Concourse 空間最大」的具體兌現方式。§6.1 + §6.3 + §1.3 | **M** |
| **5** | **桌機資訊卡貼到車窗左側牆板(21% 寬),路線圖改成 LED 條下方的水平路線圖** | 現在卡片遮掉中央車窗 45%、佔視窗高度 66%,路線圖圓點壓在右車窗玻璃上,語言鍵壓在 LED 條上。三個元素都在「浮在畫面上」而不是「長在車廂上」。改完之後桌機構成才成立,而且窄卡會強迫執行 §7.5 的內容瘦身。§5.1 + §5.2 + §5.3 | **M** |

---

## 13. 緊接在後的 10 項 S 級快手(合計約半天,投報率極高)

| # | 項目 | 出處 | 說明 |
|---|---|---|---|
| 1 | 全域 `:focus-visible` LED 綠外框 | §9.1 | 5 行 CSS,解決整站鍵盤可視性 |
| 2 | `drawScene` 加 `Map` 快取 | §11.1 | 約 10 行,換站成本從 4 次逐像素繪製降到 0 |
| 3 | 路線圖圓點撐到 44px 命中區 | §8.1 | 視覺仍 10px,命中區用 padding + `::before` 撐開 |
| 4 | `.station-panel` 加 `overscroll-behavior: contain` | §8.2 | 1 行,修掉「讀卡片卻把整列車拉走」的實質手機 bug |
| 5 | 兩處 `100vh` → `100dvh` | §6.7 / §8.4 | `.concourse` 與 `ScrollJourney.tsx:134` 的 `.stage`,修 iOS 位址欄跳版 |
| 6 | `document.documentElement.lang` 隨語言切換 | §9.4 | 1 行,修掉螢幕閱讀器用中文語音念英文 |
| 7 | 清掉所有使用者可見的 em-dash | §6.6 | `grep -n "—" content/ components/ app/`,footer / StaticFallback / metadata / stations EN body |
| 8 | gate 相位放上 `platform` 場景全屏 | §5.4 | 資產已存在(`scene.ts:80-116`),把 988px 的空白虛空變成夜間月台 |
| 9 | `cabin.jpg` preload | §11.3 | 1 行 `<link rel="preload" as="image" fetchpriority="high">`,修掉首次搭車的 pop-in |
| 10 | `page.tsx` 讓 `<Concourse/>` 永遠渲染 | §9.5 | 1 行,reduced-motion 使用者目前拿不到「關於我」/ 聯絡資訊 / footer |

---

## 14. 最後一句提醒(不是設計問題但比設計更重要)

見 §7.3 —— 三個專案目前**零個可驗證連結**,`links` 欄位的型別、CSS、渲染邏輯全都寫好了卻沒有資料。

對一份工程師作品集,一張推薦系統的資料流架構圖(`Cloud Pub/Sub → BigQuery → Redis → API`,畫成台鐵路線圖的樣式:節點 = 站、資料流 = 路線)會比本報告裡任何一項視覺調整更能拿到面試。而且它剛好是全站最好的一個「主題 × 內容」交會點。

---

*稽核依 `design-taste-frontend` skill 的 audit-first 流程執行(Redesign - Preserve 模式)。全程未改動任何專案檔案。*

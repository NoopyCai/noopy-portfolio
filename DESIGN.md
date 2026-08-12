# DESIGN.md

夜車・區間的設計規範。**這不是願望清單，是目前 `app/globals.css` 實際跑的規格**；已知偏離之處在最後一節列出。

---

## 0. 設計主張

一份作品集，做成一趟台鐵夜車。訪客不是在瀏覽網頁，是在**搭車**：進站 → 上車 → 一站一站看窗外 → 到站起身 → 走出出站大廳。

三條不可妥協的線：

1. **UI 要長在車廂上，不是浮在畫面上。** 資訊卡、路線圖、LED、按鈕都應該讀起來像車廂裡的設備（廣播、路線圖、廣告板、指示牌），不是疊在圖片上的網頁元件。
2. **原創的在地素材。** 車廂是 AI 生成的原創插畫、窗景是 `lib/scene.ts` 逐像素即時繪製的台灣風景。沒有 stock photo、沒有通用 SaaS 版型。
3. **夜車就是夜車。** 六站的光線是一條有起伏、以日出收尾的曲線。任何把畫面弄亮的決定都要先問：這台車現在是幾點？

刻意不做：通用 landing page 版型、紫色漸層、圓角膠囊到處貼、emoji、stock icon 塞滿頁面。

---

## 1. 色彩

`app/globals.css` `:root`：

| 變數 | 值 | 語意（**鎖定，不要混用**） |
|---|---|---|
| `--bg` | `#1f241f` | 底色（深綠黑，車廂陰影） |
| `--green` | `#06ff31` | **LED 綠**：顯示器內容、系統訊息、可互動的「出發」動作 |
| `--emu-green` | `#6eb43f` | **EMU900 車身綠**：路線 / 結構（路線圖線、技能分組、區塊標題） |
| `--amber` | `#f2c230` | **當前位置 / 到站**：當前站點、到站廣播句、站名標籤 |
| `--text` | `#e9eff8` | 主要文字 |
| `--muted` | `#8b98ad` | 次要文字（副標、數據標籤） |
| `--line` | `rgba(255,255,255,.08)` | 髮絲線 |
| `--seat` | `#a6c4d8` | 座椅藍（照片裡的第二大色塊） |
| `--seat-pri` | `#e7a9bc` | 博愛座粉 |

**規則**

- 一個顏色一個語意。`--amber` 目前同時擔任標籤 / 廣播句 / 數據 / 當前站 / 區塊標題五種角色，是已知的語意重疊（audit §3.3）；新增用途前先想清楚。
- `--seat` / `--seat-pri` 目前只存在照片裡、還沒進 UI。把座椅藍拉進來當數據數字色，是讓 UI「長在車廂上」最省力的一步。
- 深色是唯一主題，**沒有 light mode**。這是一列夜車。

### 燈光 grade（每站一組）

`content/stations.ts` 的 `grade: { filter, grade, blend }`，套在 `CabinComposite` 上：`filter` 給車廂照片，`grade` 是疊在上面的色片，`blend` 是混合模式。

目前六站：

| 站 | scene | brightness | 意圖 |
|---|---|---|---|
| platform | 月台 | 1.00 | 傍晚月台 |
| recommendation | city | 1.06 | 黃昏市郊 |
| liff | river | 0.72 | 深夜跨河 |
| ai | taipei | **1.50** | ⚠️ 白晝正午（打斷夜車敘事，見 §9） |
| skills | field | 1.08 | 金色田野 |
| terminal | sea | 1.03 | 破曉海景 |

**規則**：光線曲線要能講成一句話（「從傍晚出發，天亮到站」）。轉場時 `lerpGrade` 只有顏色是真插值，`filter` 與 `blend` 在中點硬切——所以**六站的 `blend` 應該統一**（目前有 `soft-light` / `multiply` / `screen` 三種，換站會跳閃）。

---

## 2. 字型

```css
--font-led: "Departure Mono", ui-monospace, "SF Mono", Menlo, monospace;
--font-zh:  "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif;
```

只有兩套。`Departure Mono`（SIL OFL，Helena Zhang）是**像素字型**，扮演整站的車站標示系統：LED 跑馬燈、站名、年份、數據、標籤、按鈕、CONCOURSE。內文一律 `--font-zh`。

**硬規則**

- **永遠不要 `font-weight: 700`。** 單一字重，synthetic bold 會糊掉像素網格。要更重 → 加大字級或加 `text-shadow` 光暈（LED 本來就是靠發光而不是加粗變重）。
- 字型檔在 `public/fonts/DepartureMono-Regular.woff2`（22 KB），`layout.tsx` 有 preload。授權條款同目錄。
- **已知缺陷**：`--font-led` 沒有 CJK，中文會掉回系統黑體造成混排。正解是拆成「拉丁/數字/符號」與「中文標示（靠字重 + 字距做站牌感）」兩條——這也才符合真實台鐵站牌的規則。

### 字階（資訊卡，桌機）

```
sp-station / sp-meta / sp-tag / sp-metric-l   11–12px   標籤層
sp-sub                                        13px      副標
sp-body                                       15px / 1.75
impact                                        clamp(13px, 1.5vw, 16px)
sp-metric-n                                   26px
h2                                            clamp(20px, 3vw, 34px)
```

**規則**：單卡最多 5 級。掃描順序應該是 `impact`（一句話成果）→ 站名 → 敘述，所以 `impact` 該是第二主角；目前它只比 body 大一點，階層是靠顏色撐的（audit §2.3）。

---

## 3. 形狀與圖示

### 圓角三級

| 級 | 值 | 用在 |
|---|---|---|
| 顯示器 / 標示牌 | `0–2px` | `.led`、未來的出口指示牌 |
| 卡片 | `16–26px` | `.glasscard`（26，squircle 感）、`.detail-card`（16）、手機資訊卡（22） |
| 標籤膠囊 | `999px` | `.sp-tag`、`.concourse-link` |

### 圖示

**不用 emoji。** emoji 在 iOS / Android / Windows 長得完全不同，都是彩色圓潤卡通的，和 LED 綠 / 像素 / 深底正面衝突。

`components/Icon.tsx` 包裝 lucide-react，語意鎖定：

| name | lucide | 語意 |
|---|---|---|
| `play` | `Play`（實心） | 前進 / 出發 |
| `chevron` | `ChevronDown` | 展開 |
| `external` | `ArrowUpRight` | 離站外連 |
| `close` | `X` | 關閉 |
| `sound` / `mute` | `Volume2` / `VolumeX` | 音效 |

包裝層覆寫 `strokeLinecap="square"` + `strokeLinejoin="miter"`（lucide 預設圓端點，和硬邊語言不搭），尺寸預設 `1em` 跟著字級走。

**但顯示器上的內容用字元箭頭，不是 icon**：LED 跑馬燈的 `◄ ►` 與「開始乘車 ►」維持字元，因為它們要跟著 `--font-led` 一起吃綠色光暈（`text-shadow`），換成 SVG 就不會發光、字重也對不上。

> 分界：**LED 語彙用會發光的字元；可以按的東西用 lucide icon。**

---

## 4. 材質：Liquid Glass

`.glasscard` 參考 Apple HIG Materials + Liquid Glass（WWDC25）：

```css
background: rgba(16, 22, 26, 0.32);
backdrop-filter: blur(16px) saturate(180%) brightness(1.04);
box-shadow: 0 10px 34px rgba(0,0,0,.36),        /* 懸浮 */
            inset 0 1px 1px rgba(255,255,255,.26),  /* 頂緣高光 */
            inset 0 -1px 1px rgba(0,0,0,.18);       /* 底緣厚度 */
```

加上 `::before` 的 1px 漸層描邊做**鏡面高光邊**（specular rim：光從左上包覆、右下回光）。

正統的 `feDisplacementMap` 折射只有 Chrome 支援 `backdrop-filter: url()`，Safari/iOS 無效，所以用跨瀏覽器 CSS 還原視覺特徵。

**後備**（兩者都已實作）：不支援 `backdrop-filter` → 實色底 `.9`；`prefers-reduced-transparency: reduce` → 實色底 `.92` + 關掉模糊。

⚠️ **這組數值是為暗底調的。** 卡片壓在亮窗景上時對比會崩（見 §9）。手機版已改成 `rgba(10,16,20,.66)`，桌機還沒跟上。

---

## 5. 版面

### 桌機

- 資訊卡：`left: 6%; bottom: 8%; max-width: 42%`（浮出左下）
- 路線圖：`right: 2.2%`，垂直排列，44×44 命中區
- 語言鍵：`fixed; top: 14px; right: 14px`；靜音鍵：`fixed; top: 14px; left: 14px`
- 車窗座標（`lib/progress.ts` 的 `WIN`，cabin.jpg 1672×941 實測百分比）：中央窗 `left 31.2% / w 37.6%`、左窗 `3.2% / 6.9%`、右窗 `89.9% / 7.3%`；LED `left 22.4% / top 4.1% / w 55.8% / h 6.2%`

⚠️ 已知問題：資訊卡遮掉中央車窗 45%、佔視窗高 66%；路線圖圓點壓在右車窗玻璃上；語言鍵與 LED 條重疊 20px（audit §5）。

### 斷點

| 斷點 | 變化 |
|---|---|
| `≤ 900px` | 資訊卡 `left 4% / bottom 5% / max-width 62%` |
| `≤ 640px` | 資訊卡改**畫面正中央**、內文靠左、底色加實、路線圖收起文字標籤 |
| `≤ 480px 高 + landscape` | 資訊卡縮小、隱藏 `.sp-body` |

**手機直式（≤640px）的規格**

```css
left: 28px; right: 28px; top: 0; bottom: 0;   /* 水平居中 */
height: fit-content; margin: auto 0;          /* 垂直居中,不用 transform */
max-height: 84vh; overflow-y: auto;
overscroll-behavior: contain;                 /* 卡片捲到底不要把整列車拉走 */
text-align: left;                             /* 置中的內文兩邊都是鋸齒 */
background: rgba(10, 16, 20, .66);
```

- 垂直居中**不能用 `translateY(-50%)`** —— `transform` 已被淡入的 inline style 佔用。
- `impact` 在手機加琥珀左軸線 + 漸層底（比 `▸` 更好的「廣播中」訊號）。
- `sp-metrics` 加上細線與上方敘述斷開。
- 車廂維持 cover 滿屏，上下不留邊。
- 路線圖 `right: -6px`（44px 命中區的負位移，讓圓點視覺位置維持原樣又不壓到資訊卡，實測留 7px 間隙）。

---

## 6. 動態

- **相機**：`exit` 相位第一人稱起身 + 轉身。桌機真 3D（`rotateY(-85deg)` + `perspective: 1200px`），手機退化成 2.5D（起身 + 橫向滑出 + 輕微轉，省掉重 3D）。
- **滑鼠視差**：sway 層 `translate3d(±15px, ±12px) rotateX/Y(±1.4deg) scale(1.035)`，只在 `ride` 生效，`gate`/`exit` 平滑收斂回 0。`scale(1.035)` 是過掃描，**只有車廂進這層**（文字會被重新取樣而發糊）。
- **窗景流動**：每站約平移一圈，從 `[bg | full | bg]` 的三倍寬長條取切片環繞（地標只在中段出現一次，不會重複）。位移做整數對齊，避免抖色爬行閃爍。
- **時長**：目前面板 500ms / 窗景 600ms / 燈光 800ms / LED 瞬間切換——四種時長各自跑。**到站應該是一個編排好的事件序列**（廣播 → 窗景 → 燈光 → 舊卡淡出 → 新卡逐層點亮），目前還不是（audit §4.2）。
- **觸壓回饋**：所有互動元素 `:active` 位移 1px（路線圖圓點 `scale(.9)`）。
- **`prefers-reduced-motion`**：跑馬燈、modal 動畫、按鈕 pulse 全部關閉；整個捲動旅程換成 `StaticFallback`。

---

## 7. 無障礙基線

- **焦點**：全域 `:focus-visible { outline: 2px solid var(--green); outline-offset: 3px }`——用 LED 綠當「這個控制項通電了」的訊號。
- **觸控目標**：路線圖圓點視覺 10–12px、命中區 44×44（`::before` 畫視覺、按鈕本身撐大）。「看細節」按鈕 padding 拉到約 44px 高。
- **音效**：只在使用者點「開始乘車」時啟動（不是 autoplay），左上角一定要有靜音鍵（WCAG 1.4.2）。音量上限 sfx `0.5` / music `0.35`，兩軌都淡入。
- **語言**：切換時同步更新 `document.documentElement.lang`（否則螢幕閱讀器用中文語音念英文）。
- **降級版**：`prefers-reduced-motion` 拿到 `StaticFallback`，但 `Concourse` 一律渲染——聯絡資訊不能因為使用者關動畫就消失。

⚠️ 尚未達標：「看細節」modal 宣告了 `aria-modal` 但沒有 Escape / focus trap（比不宣告更糟）；換站對螢幕閱讀器完全無聲（缺 `aria-live` 的到站廣播）。

---

## 8. 內容規則

`content/stations.ts` 是唯一的內容來源，六站雙語。每張卡的欄位分工：

| 欄位 | 職責 | 長度 |
|---|---|---|
| `name` | 站名（LED 報站 + 路線圖 + 卡片抬頭） | 短 |
| `impact` | **一句話關鍵成果**，一眼看到的那句 | ≤ 30 字 |
| `body` | 做了什麼、技術路線 | 45–55 字 |
| `tags` | 技術名稱 | 3–7 個 |
| `metrics` | **只放真的量測值** | — |
| `detail` | 問題 / 做法 / 成果，完整故事 | 各 60–90 字 |

**規則**

- **同一件事只講一次。** `impact` 說過的話 `body` 不要再說，`body` 說過的 `detail.result` 不要複述。（曾經「8 成手刻時間」在一張卡上出現四次。）
- `metrics` 的大琥珀數字位只給量測值。`AES-256`、`OTP`、`RT`、`Top20` 是技術名稱，放 `tags`。找不到真數字就不放整列——**時有時無比沒有更糟**，但假數字比時有時無更糟。
- `subtitle` 不要重複 `tags`（曾經 `Claude Code · Gemini · SDD` 兩邊一模一樣）。
- 使用者可見的字串不用 em-dash，用 `·`。
- 英文不是機翻，照同樣邏輯重寫。

---

## 9. 已知偏離（規範說 A、程式碼目前是 B）

依嚴重度排序。完整版與修法見 `docs/design-audit-2026-07.md`。

| # | 偏離 | 出處 |
|---|---|---|
| 1 | **亮站對比崩壞**：`taipei` 的 `brightness(1.5)` 把玻璃卡帶成近白，`--muted` 1.8:1、`--amber` 1.05:1、tag 綠 2.3:1，三個作品站的副標與數據標籤實質看不見 | §1.2 |
| 2 | **燈光曲線斷了**：夜車中間插了一個正午；且 grade overlay 在 DOM 上位於車窗**下方** → 車內比車外亮，光線關係是反的 | §3.1 |
| 3 | **`blend` 三種混用**，換站時 `multiply → screen` 會彈一下 | §3.2 |
| 4 | **`--font-led` 沒有 CJK**，每個含中文的標籤都是雙字型混排 | §2.1 |
| 5 | **UI 浮在畫面上而非長在車廂上**：資訊卡遮住中央窗 45%、路線圖壓在右窗玻璃、語言鍵壓在 LED 條上 | §5 |
| 6 | **單卡 8 級字階**，而最重要的 `impact` 是第 6 小 | §2.3 |
| 7 | **圓角六種**（26 / 22 / 16 / 6 / 999 / 0），形狀系統還沒收斂到三級 | §6.5 |
| 8 | **`--amber` 一個顏色五種語意**；`--seat` / `--seat-pri` 定義了但沒進 UI | §3.3 |
| 9 | **出站大廳落差大**：三塊同版型、「關於我」逐字抄自站 1 與站 6、聯絡資訊與終點站完全重複、沒有 `<h1>` | §6 |
| 10 | **每幀 `setP()` 觸發整棵樹重繪**，吃掉所有動態的預算 | §4.3 |

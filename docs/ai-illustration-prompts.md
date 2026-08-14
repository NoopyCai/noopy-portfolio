# 車廂插畫 AI 生圖提示詞（EMU900 夜間車廂）

> 目標:產出**一張靜態手繪風車廂插畫**,質感對齊 yukiasakura 原站(暗綠顆粒、夜間開燈、正面對稱),
> **中央大車窗留空**,之後由程式挖空並墊入 live 內容(地圖/風景/作品)+ 頂端 LED 跑馬燈。
> 在地化:台鐵 EMU900(白車體、亮綠腰帶、粉藍座椅、粉紅博愛座、黃色博愛拉環、三叉立柱、繁中貼紙)。

---

## A. 主圖 — 全彩夜間車廂(ride state)【最重要】

**English prompt（貼進生圖工具）:**
```
Front-facing, perfectly symmetrical interior of a Taiwan commuter train car (EMU900) at
night, seen from a seated passenger looking straight across the aisle. Flat editorial vector
illustration with fine film-grain texture, muted limited palette, clean flat shapes, cinematic
dim lighting. Dark desaturated teal-green cabin walls (#1f2a27) softly lit by warm overhead
ceiling strip lights that cast gentle pools of light onto the seats and floor; strong contrast
between the dim interior and a large bright empty central window. Composition: one large
rounded-rectangle window in the exact center, flanked by two smaller side windows; a stainless
overhead handrail with hanging circular hand-straps; three-pronged vertical support poles;
longitudinal bench seats upholstered in muted pastel blue with a single pink priority seat on
the right; a thin bright green accent stripe running along the wall; a yellow priority-seat
floor patch; small rectangular wall advertisement panels and a priority-seat notice sticker;
a slim black LED destination-sign strip across the very top edge; a small speaker grille with a
red recording dot on the upper right. No people. Moody night mood, subtle grain, high detail,
horizontal 16:9.
```

**中文對照重點**:正面對稱、暗綠顆粒插畫、車頂暖燈光池、暗車廂 vs 亮車窗強對比、中央大圓角窗(留空)+兩側小窗、不鏽鋼扶手+圓拉環、三叉立柱、粉藍長椅+右側粉紅博愛座、綠色腰帶、黃色博愛地板、牆上廣告與博愛座貼紙、頂端黑色 LED 條、右上喇叭+紅色錄音點、**無人物**。

---

## B. 合成專用變體 — 車窗留空好挖圖

在 A 的基礎上,把中央車窗這句改成其中一種(讓我好遮罩):

- 純黑窗(推薦,最好挖):
  `...the large central window is a completely empty, flat, solid pure-black (#000000) panel with a clean metal frame, no reflection, no scenery inside...`
- 綠幕窗(想用色鍵去背):
  `...the large central window is a flat solid chroma-key magenta (#FF00FF) rectangle, empty, clean edges...`

> 側窗可維持有夜景;**只有中央窗要留空**(那是放 live 地圖/作品的地方)。

---

## C. 進站前藍圖 — 綠色線稿(intro)【可選,SVG 已能做】

```
Front-facing symmetrical interior of a commuter train car, drawn as a single-weight neon-green
(#06ff31) technical line-art wireframe on a pure near-black (#1f241f) background. Only clean
thin outlines, no fill, no shading: overhead handrail with hanging straps, large central window,
two side windows, three-pronged poles, longitudinal bench seats, wall panels. Blueprint /
schematic look, glowing green lines, minimal, 16:9.
```

---

## D. 車門過場素材（三張，已上線）

> **現況**：`public/door/` 的三張圖已經接上 `components/door3d/scene.ts`，是門過場的正式外觀。
> `components/door3d/textures.ts` 的程序貼圖（Canvas 2D、painterly、無外部圖檔）**沒有被刪掉**，
> 它是 runtime fallback：圖檔 404 / 離線 / 解碼失敗時 `TextureLoader` 的 onError 什麼都不做，
> 材質就留在程序貼圖上，過場照跑。要重生素材時照下面的規格，蓋回同樣的檔名即可。
>
> **授權**：三張都是使用者用本檔的 prompt 自行生成的，沒有外部素材授權問題。

| # | 檔案 | 尺寸 | 內容 |
|---|---|---|---|
| ① | `public/door/door-closed.jpg` | **1:1，≥2048²** | 雙片關閉的塞拉門，**門縫在正中**、正面平視 |
| ② | `public/door/car-body.jpg` | **1:1，≥2048²** | 車體外側牆：不鏽鋼拼板 + 鉚釘 + 綠色飾帶 |
| ③ | `public/door/platform-floor.jpg` | **16:9**（可選） | 俯視月台地面：混凝土 + 一條導盲磚黃帶 |

三張共同要求：**orthographic 正投影、無透視收斂**（會被貼到平面 mesh 上，有透視就對不上）、
**無任何文字與 logo**、無人物、無浮水印、夜間曝光。

**① 車門本體**
```
Orthographic front-on elevation of a pair of closed Taiwan commuter train (EMU900) plug doors,
seen from the night platform side, perfectly symmetrical with the central seam exactly at the
image centre. Two door leaves, each with one tall vertical rounded-rectangle window of
near-black glass faintly reflecting the dim platform; dark desaturated teal-green painted metal
door skin with subtle tonal variation; slim dark rubber window seal; a yellow hazard band with
gentle paint wear running horizontally across the lower part of both leaves. Flat elevation
view, no perspective convergence, no vanishing point, even lighting with a soft vignette.
Cinematic night exposure, muted limited palette, fine grain. No people, no text, no lettering,
no signage, no logos, no watermark. Square 1:1.
```

**② 車體外側牆**
```
Orthographic front-on elevation of the exterior side wall of a Taiwan commuter train (EMU900),
brushed stainless steel panels with visible panel seams and rows of small rivets, and one
horizontal bright green livery band running edge to edge across the lower third. Flat elevation
view, no perspective convergence, seamless left and right edges so it can tile horizontally.
Cinematic night exposure, muted palette, fine grain. No people, no text, no lettering, no
logos, no watermark. Square 1:1.
```

**③ 月台地面**
```
Top-down orthographic view of a train platform floor: large smooth concrete slabs with subtle
staining and grout lines, and one horizontal band of yellow tactile paving tiles (raised dot
pattern) running edge to edge across the middle. Straight overhead view, no perspective, no
people, no objects. Dim warm pools of light from overhead platform lamps. Cinematic night
exposure, fine grain. No text, no lettering, no logos, no watermark. Horizontal 16:9.
```

**接上去之後要確認的三件事**（`components/door3d/scene.ts`）
1. **門縫對位**：①的中線切半 → 左片吃 u 0–0.5、右片 0.5–1。實測目前這張 1254px 寬的門縫在
   x = 626，距正中只差 1px，所以 `SEAM_U = 0`；換圖若偏移變大就調那個常數。
2. **綠帶高度**：②的綠帶在貼圖 v 0.301–0.421 → 世界 y 0.53–1.16（門洞上緣 1.5 底下）。
   換圖後綠帶位置若跑掉，改 `CAR_TILE`（一張貼圖代表幾米見方）。
3. **導盲磚位置**：③的黃帶在貼圖 v 0.450–0.590 → 用 `floorTex.offset.y` 壓到門前 1.0–1.6 m。
   換圖後量一次黃帶的 v 範圍，重解那個 offset。

⚠️ **曝光**：門場景的環境光只有 0.25–0.48（冷藍夜色），素材直接乘下去會整片沉進黑裡。
`scene.ts` 的 `EXPOSURE = { door, wall, floor }` 就是各張的曝光補償係數（`color.setScalar`），
換圖後對照 `public/cabin.jpg` 的車廂牆面重新目視校一次。
**2026-08 換基底後這個基準值變了**：舊基底的牆面 sRGB ≈ 0.17，新基底同一塊是 **≈ 0.29**（整張平均
亮度 +15.7%）。`EXPOSURE` **刻意沒跟著調高**——門板/車體/月台三張是「月台側、夜裡」的素材，跟著背板
提亮 1.7 倍只會把不鏽鋼曝成白鐵皮，而「車外暗、車內亮」本來就是這個鏡頭要講的事（暖光潑出門口）。
真的覺得門板太沉再動 `EXPOSURE.door`，而且一次只動一個係數、每次都回頭看門開一半那幀。

4. **標語橫向相位**（②，2026-08 換上帶標語的版本後新增）：新圖的海報／標語全部擠在貼圖
   左右兩端（實測 u 0.026–0.175 與 0.809–0.974），中間是乾淨鋼板。tiling 後兩群會在接縫處
   併成一叢六張的標語牆。`CAR_U0`（現 0.5）就是把「乾淨鋼板的正中」對到門洞中線的相位，
   於是上楣（u 0.31–0.69）整片乾淨、那叢標語落在門的正兩側（世界 x ±1.62–3.54）。
   換圖後重量標語的 u 範圍，取其**乾淨區的中點**當 `CAR_U0`。
   ⚠️ 起始機位看得到 6.26 m 寬而 `CAR_TILE` 只有 5.25 m，所以畫面最外緣一定會看到下一輪的
   標語（1.19 個週期）—— 這是週期被綠帶位置鎖死的必然結果，不是沒調好。

**體積**：原始 PNG 共 1.18 MB，已用 mozjpeg q82 轉成 JPEG 共 434 KB（視覺無差），PNG 已移除。
2026-08 ② 換成帶標語的版本（PNG 568 KB → JPEG q82 4:4:4 200 KB，舊版 126 KB），三張共 518 KB。

---

## E. 車廂基底與拆層（2026-08 換基底，已上線）

> 原定的 L1 拆層計畫（`docs/specs/3d-stages-2026-08.md` 階段 1）是「inpaint 原圖 → 差分切前景」，
> 實測失效：使用者重生成的新版與舊版有 36% 的像素差、而且差異散布全畫面（不是只有立柱區），
> 差分切出來的前景會夾帶整片牆的色偏。**決策改為換基底**：新的無立柱版直接成為全站基底，
> 立柱另外一張帶 alpha 的前景層。兩張都是使用者的 AI 工作流產出，沒有外部素材授權問題。

| 檔案 | 尺寸 / 體積 | 內容 | 狀態 |
|---|---|---|---|
| `public/cabin.jpg` | 1672×941 · 150 KB | 車廂內裝，**無立柱無橫杆**（牆/窗/座椅完整） | 全站基底，已上線（② 版） |
| `public/cabin/cabin-front.png` | 2715×1528 RGBA · 119 KB | 立柱 ×2 + 頂端橫杆的去背層 | 素材就緒，**還沒接進 DOM**（階段 1 後續） |
| `public/cabin/cabin-front-green.png` | 1672×941 · 27 KB | 上面那張的來源母檔（綠幕 `(71,112,76)`，本身已帶 alpha） | 保留備查，未被引用 |

### 換基底的 SOP（照這個順序，每一步都有對應的量測）

1. **比例先於一切**：目標是 `1672/941 = 1.7768329`（CSS 的 `177.68vh` 與 `scene.ts` 的 `CABIN_ASPECT`
   都寫死這個值，見 CLAUDE.md 坑 4）。分子分母互質，所以只有 1672×941 的整數倍是精確值；
   實務上挑一組誤差 < 0.001% 的整數尺寸（現在的 2715×1528 誤差 0.00004%），用 `fit: "fill"`
   把原生尺寸壓過去（2730×1536 → 2715×1528 是橫向拉 0.008%，0.2px，肉眼與互相關都測不出來）。
   **不要反過來去改 CSS 或場景常數。**
2. **壓縮**：mozjpeg q82 + **4:4:4**（圖裡有告示與海報的小字，4:2:0 會把紅字糊成一團）。
   預算 ≤ 500 KB（它有 `layout.tsx` 的 preload，是 LCP 候選）。實測 2715×1528 q82 4:4:4 = 344 KB，
   1672×941 同設定 = 150 KB。
3. **重量三扇窗（`WIN`）**：車窗玻璃在圖裡是純黑 → 取 luma < 26 的連通區塊，bbox 就是玻璃外緣；
   再內縮 0.3–0.7% 得到 `WIN`（窗景不該爬上金屬壓條，圓角處內縮得更多）。數字見 `lib/progress.ts`。
4. **重量 LED（`LED_RECT`）**：取顯示器黑底的實測範圍，**不內縮**——它同時是 DOM 跑馬燈的定位框
   與門場景背板塗黑矩形的來源。驗收方式：門末幀 `render(1)` 後讀背板 canvas 在該矩形內的像素，
   「暖色像素（r > g+12 且 r > 40）」必須是 **0**（原圖同一塊有 3033 個，那就是烤死的橘字）。
5. **門場景末幀對位回歸**（比例守住的話應該自動成立，但一定要實測）：
   `__door3d.render(1, "enter")` 後同一個 task 內 `drawImage(canvas)`（`preserveDrawingBuffer` 是 false，
   跨 task 就讀不到），另一張 canvas 用解析幾何畫 DOM 車廂（`max(100vw, 177.68vh) × 1.035`、置中，
   **不要**用 `getBoundingClientRect`，那會把 sway 的抖動一起量進去），再對兩張的欄/列亮度剖面做
   正規化互相關 + 拋物線次像素插值。2026-08 實測：1920×958 → dx +0.02 / dy +0.03，390×844 →
   dx +0.001 / dy +0.002，相關 0.997–0.999。
6. **曝光**：見 §D 末的 ⚠️（新基底比舊的亮，`EXPOSURE` 刻意不動）。

### 第二輪換基底（② 告示文字修正版）的實測值

使用者為了修掉 ① 版海報／告示上的亂碼字重生成了一次，2026-08-14 上線。**這一版原生就是
1672×941**，比例分毫不差、零重採樣（① 版是 2730×1536 壓成 2715×1528）。逐項照上面的 SOP 重跑：

| 項目 | ② 實測 | 判定 |
|---|---|---|
| 尺寸 / 壓縮 | 1672×941、q82 **4:4:4**、150 KB | 過（預算 ≤ 500 KB） |
| 中央窗玻璃外緣 | 30.68 / 31.99 / 38.64 / 34.11 | 與 ① 差 ≤ 0.12%，`WIN` 不動 |
| 左窗玻璃外緣 | 2.81 / 34.01 / 7.42 / 30.71 | 同上 |
| 右窗玻璃外緣 | 89.65 / 34.01 / 7.66 / 30.71 | 同上 |
| LED 黑底 | 22.37 / 4.14 / 56.10 / 6.27 | `LED_RECT` 更新為 22.4 / 4.1 / 56.1 / 6.3 |
| LED 塗黑驗收 | `LED_RECT` 內 55342 px、暖色像素 **0**、平均 luma **1.0** | 過（② 的 LED 是空白暗屏，沒有烤死字） |
| 車廂牆面 sRGB | 0.299（整張平均 0.275） | 與 ① 的 ≈0.29 同級，`EXPOSURE` 不動 |
| 末幀對位 1920×958 | dx **+0.045** / dy **+0.024**，corr 0.9994 / 0.9996 | 過 |
| 末幀對位 390×844 | dx **+0.016** / dy **+0.037**，corr 0.9993 / 0.9989 | 過 |

文字驗收（放大 6–14×）：博愛座大告示四行「博愛座 / Priority Seats / 請優先禮讓給有需要的旅客 /
Please give your seat to those in need」**全部正確**，海報「山海日常 / 微小旅行 / Taiwan」也正確。
車門旁兩張直式小告示在原圖只有 **43×85 px**（字高約 7px），字形已經化成色塊、判不出對錯——
但它在任何真實視窗下也是同樣的尺寸（1920 寬時約 49×98 CSS px），**讀不出來是構圖決定的，不是缺陷**，
不擋流程。

⚠️ **解析度**：② 版比 ① 版小（1672×941 vs 2715×1528）。1920 寬的桌機要放大 1.19×、retina 再 ×2，
細節會比 ① 版軟。下次再換基底時**優先跟使用者要 2× 尺寸**（3344×1882），比例照樣是 1672:941 的整數倍。

### 立柱層的去背

母檔是綠幕，但**它已經自帶 alpha**（背景 a=0、邊緣有羽化、可見像素裡零殘綠），所以正確做法是
**沿用既有 alpha，用色鍵當交叉檢查**，而不是重新色鍵一次：

- 檢查用「從四邊界出發、只走近色鍵像素的 flood-fill」（不要全域色鍵——立柱本身若有接近的暗綠會被挖洞）。
  實測 flood-fill 判定的背景佔 93.73%，與既有 alpha 的分歧只有 638 px（flood 說背景、alpha 說不透明）
  與 2037 px（alpha 說全透、flood 沒走到 = 立柱 Y 型分叉圍出來的封閉背景，**這正是純邊界 flood-fill
  會漏掉的洞**，也是「別丟掉既有 alpha」的理由）。分歧一律偏向保留不透明。
- 母檔的 alpha 最大值只有 253，要正規化到 255，否則整層永遠透一點。
- 全透明像素的 RGB 從綠幕色換成中性鋼灰：瀏覽器縮放走預乘所以理論上無所謂，但任何非預乘的路徑
  （某些 canvas / 匯出工具）都會吐綠邊，換掉的成本是零。
- 立柱位置實測（%）：兩根立柱在 x 20.28–21.53 與 78.29–79.55，橫杆在 y 10.31–12.43。
  （② 基底上線後用 alpha > 40 重量一次：x 20.22–21.62 / 78.31–79.71、橫杆 y 10.27–12.63、
  立柱 y 10.27–96.66，差異 ≤ 0.2% 且純粹來自 alpha 門檻。alpha 最大值已是 255，正規化沒漏做。
  疊上 ② 基底出的合成圖：橫杆貼在天花板燈帶下緣、兩支柱腳的底盤落在座椅前的地板上、
  無綠邊無白邊，**位置合理，不需要調整**。）
  以階段 1 的規劃值（前景層 `scale 1.06` + 視差係數 1.7、滑鼠 ±15px）做過合成模擬：
  最大位移下立柱兩端仍在畫面外，不會露出杆頭。

---

## 反向提示詞（Negative prompt，SDXL/相容工具用）
```
people, passenger, faces, hands, gibberish text, warped perspective, tilted, asymmetrical,
photorealistic, 3d render, cluttered, extra windows, distorted straps, lens flare, watermark,
signature, logo, jpeg artifacts, blurry
```

## 各工具設定
- **Midjourney v6/v7**:貼 A,後面加 `--ar 16:9 --style raw --stylize 250 --no people,text`。想更「插畫」可 `--stylize 400`。
- **Nano Banana / Gemini / ChatGPT 生圖**:直接貼 A 的自然語言,補一句「horizontal 16:9, flat editorial illustration with film grain, no text on signs」。
- **Adobe Firefly**:Content type 選 **Art**,Aspect 16:9,可加參考風格圖。
- **SDXL**:A 當 positive + 上面 negative,尺寸 1536×864,加一點 film-grain LoRA;出圖後銳利化。

## 產出建議
1. 尺寸越大越好(≥1536×864),之後可縮。
2. 一次生 3–4 張,挑**最對稱、窗框最乾淨**的一張。
3. 交給我後,我會:沿車窗邊緣做遮罩挖空 → 車廂當靜態上層 → live 車窗內容(地圖/風景/作品)墊在窗後 → 頂端 LED 跑馬燈疊上 → 車頂燈光互動。跟原站一樣「車廂不動、窗外會動」。
4. 建議也生一張 **B(黑窗版)** 給合成;A(有側窗夜景)當展示備份。

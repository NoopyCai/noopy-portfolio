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
換圖後對照 `public/cabin.jpg` 的車廂牆面（sRGB ≈ 0.17）重新目視校一次。

**體積**：原始 PNG 共 1.18 MB，已用 mozjpeg q82 轉成 JPEG 共 434 KB（視覺無差），PNG 已移除。

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

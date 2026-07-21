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

# 車窗背景 — Gemini(Nano Banana)生成提示詞

**用法**
1. 在 Gemini 附上 `public/cabin.jpg`(或裁下左側「山海日常」海報那塊)當風格參考。
2. 每張都先貼「風格鎖定」段,再貼該站的「場景」段。
3. 盡量生**寬幅全景**(要求 21:9 或更寬);Gemini 不給超寬就用 16:9,我平移幅度改小。
4. 存檔到 `public/scenery/`,檔名要**完全對應**(小寫):
   `platform.png` `city.png` `river.png` `taipei.png` `field.png` `sea.png`
5. 全部生好告訴我,我改 `Window.tsx` 載入你的圖 + 保留多層平移/換站溶接/滿屏。

---

## 風格鎖定(每張都貼)
> Semi-realistic anime-style digital painting, in the **exact art style of the attached reference image**: soft cinematic lighting, muted natural Taiwan color palette, gentle atmospheric haze, delicate painterly detail (Makoto Shinkai / CoMix Wave scenery mood). **Ultra-wide cinematic panorama, landscape orientation (aspect ratio 21:9 or wider).** The scene is distant scenery viewed while passing by on a moving train — **no window frame, no train, no text, no watermark, no logos, no people.** Keep the **horizon line at ~58% from the top** so every scene aligns. Subtle sense of horizontal motion.

---

## 1. platform.png — 月台・出發(松山夜)
> A quiet Taiwan suburban railway platform at night. Warm sodium-lamp glow pooling on the wet platform, a simple green station-name sign, deep navy sky, distant low-rise buildings with a few warm lit windows, empty tracks catching the light. Calm, cinematic, nocturnal.

## 2. city.png — 電商推薦系統(黃昏城市)
> A Taiwanese city skyline at dusk seen from an elevated railway. Layered building silhouettes fading into warm orange-to-purple haze, thousands of tiny warm window lights, a soft glowing low sun near the horizon, distant blue mountains behind the city. Dreamy dusk atmosphere.

## 3. river.png — LINE LIFF 會員綁定(夜間河橋)
> A wide calm river at night crossed by a softly lit cable-stayed bridge. A gentle full moon, warm city lights shimmering as reflections in the dark water, scattered faint stars, deep blue and teal palette. Tranquil night mood.

## 4. taipei.png — AI 工具整合(白晝台北)
> Taipei city in soft clear daylight. Taipei 101 tower rising elegantly above layered green mountains (Elephant Mountain / Xiangshan), gentle blue sky with soft white clouds, a low-rise cityscape below. Fresh, bright, airy atmosphere.

## 5. field.png — 技能車廂(田野黃昏)
> Rural Taiwan rice paddies at golden hour. Flooded fields mirroring a warm glowing sky, distant green mountain ridges, a lone farmhouse and a solitary tree, telephone poles receding into the distance. Peaceful, nostalgic golden light.

## 6. sea.png — 終點・南迴海景(破曉海岸)
> The Taiwan south-link coastline at dawn. Calm ocean meeting a soft pink-and-orange gradient sky, the sun rising with a shimmering golden light column on the water, a distant rocky headland, a tiny fishing boat far out. Serene and cinematic — echoing the mountain-and-lake poster mood in the reference image.

# 台鐵素材調查（TRA Asset Survey）

> 用途：為「台鐵區間車夜行」概念個人作品集網站蒐集**可合法使用**的素材與可照著畫的視覺參考。
> 調查日期：2026-07-21　·　調查方式：Web 搜尋 / 官方與維基來源
> ⚠️ hex 色碼多為「依照片估計」，最終請對照實際照片微調；官方未公開完整 CIS 色票。

---

## 0. 使用原則（重要，先讀）

| 素材 | 可否直接用 | 做法 |
|---|---|---|
| 台鐵官方 **logo / 商標** | ❌ 不直接用 | 台鐵商標受商標保護（有商標授權辦法）。→ 我們**自製原創站徽**，僅在氣質上呼應，不照抄。 |
| 台鐵官方 **到站音樂 / 廣播錄音** | ❌ 不直接用 | 有版權。→ 用 CC0 音效或 Web Audio 合成「叮咚」。 |
| 車廂 / 車站 **照片** | ⚠️ 僅作繪圖參考 | 用 Wikimedia Commons（CC-BY/CC-BY-SA）當**臨摹參考**，不直接放上網。真要放照片須標作者授權。 |
| 我們自製的 **SVG 車廂線稿 / 插畫** | ✅ | 原創，版權屬自己。這是主素材。 |
| **字型**（Departure Mono 等 OFL） | ✅ | 可商用，隨網站打包。 |
| **音效**（Pixabay/Freesound CC0） | ✅ | 可商用免標註（仍建議記錄來源）。 |
| **圖示**（Lucide/Tabler，MIT） | ✅ | 可商用。 |

**核心結論**：靈魂素材（車廂）由我們**自製 SVG**（對照 CC 照片臨摹）；字型/音效/圖示用 OFL/CC0/MIT；台鐵官方 logo 與音檔不碰，改自製與合成。

---

## 1. 主角車型：**EMU900 型區間車**

**為什麼選它**
- 台鐵最新、被封「**史上最美區間車**」的通勤電聯車（2022~ 陸續上線，跑遍全台，辨識度最高）。
- 招牌特徵：**白車體 + 一條亮綠色腰帶**（暱稱「綠色蟑螂」）、**微笑頭燈**。
- 那條**亮綠腰帶**剛好呼應參考站的霓虹綠 → 綠色線稿階段有正當的在地理由（不是憑空用綠色）。

**內裝逐元素（可照著畫，正面對稱視角）**
- **座椅**：淺色絨布。一般座椅 **粉藍色**、博愛座 **粉紅色**。排列為「非字型」（縱向長排椅 + 部分橫向），第 3/4/7/8 車為「一字型」長排椅（通勤高載客）。
- **立柱**：車門走道中央有**三叉式立柱**（EMU900 特徵），座位區為單立柱 + 周圍拉環。
- **吊環/拉環**：圓形拉環吊在橫桿上；**博愛座區的拉環為黃色**（EMU800/900 共通的無障礙標示）。
- **博愛座**：地板黃色防滑區 + 黃色拉環標示。
- **車窗**：大面橫向車窗，上緣有行李架/廣告燈箱帶。
- **地板**：耐磨深灰色系。
- **照明**：白色 LED 條狀照明（車廂明亮）。

> 備選：**EMU3000 城際列車**（騰雲座艙，橘色系、更高級）——若想走「自強號長途夜行」可當第二主題，但通勤感、綠色呼應以 EMU900 最佳。

---

## 2. 配色板（hex，estimated ⚠️）

| 用途 | 名稱 | hex（估計） |
|---|---|---|
| 車體 | EMU900 車體白 | `#F4F6F5` |
| **招牌色** | EMU900 亮綠腰帶 | `#6EB43F`（亮綠，可再鮮豔到 `#7AC943`）|
| 座椅 | 粉藍 一般座椅 | `#A6C4D8` |
| 座椅 | 粉紅 博愛座 | `#E7A9BC` |
| 無障礙 | 博愛座黃 | `#F2C230` |
| 內壁 | 車廂灰白 | `#DCE1E0` |
| 金屬 | 立柱/扶手 銀灰 | `#B4BBBD` |
| 地板 | 深灰 | `#484D50` |
| 品牌 | 台鐵企業藍（估計） | `#005BAC` |
| 線稿 | 霓虹綠（intro 發光線稿，呼應參考站 & EMU900 綠） | `#06FF31` |
| 底色 | 夜車底黑（帶綠味） | `#1F241F` |

**窗外風景配色**
| 情境 | 色 |
|---|---|
| 黃昏天空 | `#B2380C` → `#EA8330` → `#F2AC57` |
| 城市燈火 | 燈點 `#FFB24D`，剪影 `#0B0F0B` |
| 南迴海景（藍調） | 海 `#1B3A5B` → 遠山 `#0E2438` |

---

## 3. 字型（LED 報站顯示器）

| 字型 | 授權 | 適用 | 連結 |
|---|---|---|---|
| **Departure Mono**（首選）| SIL OFL（可商用）| 等寬像素風,最像交通看板 | departuremono.com · github.com/rektdeckard/departure-mono |
| VT323 | SIL OFL | DEC 終端機像素感,備選 | Google Fonts: VT323 |
| DSEG（7-seg / 14-seg / dot）| SIL OFL | 純數字/時刻表數字段碼感 | github (keshikan/DSEG) |
| **中文報站**：思源黑體 / Noto Sans TC Bold | SIL OFL | 中文 LED 用黑體 Bold 模擬(真點陣中文字型少且授權雜,建議黑體 + CSS 點陣遮罩)| Google Fonts: Noto Sans TC |

> 做法：英文/數字用 Departure Mono，中文用 Noto Sans TC Bold，統一疊一層 CSS 點陣遮罩（radial-gradient dot grid）做出 LED 顆粒感。**取代付費 Mobitec**。

---

## 4. 音效（預設靜音,可開）

| 來源 | 授權 | 內容 | 連結 |
|---|---|---|---|
| **Pixabay Sound Effects**（首選）| 免版稅、免標註 | 進站 chime、月台廣播、車廂 ambience | pixabay.com/sound-effects/search/train-announcement |
| Freesound | CC0 / CC-BY（挑 CC0）| 各式站內音、列車行進 | freesound.org |
| Orange Free Sounds | 免費 | 「叮咚」列車提示音 | orangefreesounds.com/train-announcement-chime |
| BigSoundBank | 免費（SNCF 風）| 月台提示鈴 | bigsoundbank.com |
| **Web Audio 合成**（保險）| 自製 | 兩音「叮—咚」+ 進站音,零版權 | — |

> ❌ 不使用台鐵實際到站音樂/廣播錄音(版權)。→ 用 Pixabay CC0 或直接合成。

---

## 5. 圖示（UI）

| 圖示集 | 授權 | 用途 |
|---|---|---|
| Lucide | ISC（≈MIT）| 喇叭、播放、箭頭、language |
| Tabler Icons | MIT | 交通/介面圖示齊全 |
| Phosphor | MIT | 風格細緻備選 |

---

## 6. 可用照片 / 繪圖參考來源（Wikimedia Commons，CC-BY/CC-BY-SA）

> **僅供臨摹參考**（畫 SVG 用）；若要直接顯示照片需標作者+授權。

- Category: **Train interiors of Taiwan Railway Administration**（27 子分類）
- Category: **TRA EMU800**（車內 135 張）
- Category: **TRA EMU3000**（車內 22 張）
- Category: **Train interiors of Railway coaches of TRA**（126 張）
- 車型維基：台鐵 EMU900 / EMU800（zh.wikipedia）、臺灣鐵道維基館（taiwanrailwiki.miraheze.org）
- 品牌參考：Brandfetch `railway.gov.tw`（看 logo 造型,不直接用）、台鐵商標授權頁 `railway.gov.tw/tra-tip-web/adr/about-biz-3`
- 窗景參考：多良車站（南迴線海景,「全台最美車站」）——太平洋、山海相夾

---

## 7. 待製作的圖片素材清單（給下一步「Claude Design / 生圖」用）

由我自製（SVG，優先）或外部 AI 生圖：
1. **綠色線稿車廂內裝**（intro 藍圖）— EMU900 正面對稱視角，霓虹綠線稿 — *我畫 SVG*
2. **全彩 EMU900 車廂內裝**（ride）— 白壁+綠腰、粉藍/粉紅座椅、黃博愛座、三叉立柱、圓拉環 — *SVG 上色 或 AI 生圖*
3. **窗外風景分層**（黃昏 / 城市夜景 / 南迴海景）— *SVG/Canvas 生成 或 AI*
4. **原創站徽**（非台鐵官方，呼應「工字軌」意象但原創）— *SVG*
5. **元件**：圓形吊環、三叉立柱、粉藍座椅、博愛座標示、廣告燈箱、車門、對講機 — *SVG 元件庫*
6. **LED 報站顯示器材質**（點陣遮罩 + 綠字）— *CSS/SVG*

---

## 8. 來源連結

- 台鐵 EMU900 維基：https://zh.wikipedia.org/zh-tw/台鐵EMU900型電聯車
- 台鐵 EMU800 維基：https://zh.wikipedia.org/zh-hant/台鐵EMU800型電聯車
- EMU900 內裝報導：https://lifeintainan.com/emu900train/ · https://tw.feature.appledaily.com/travelseed/article/208915
- 臺灣鐵路公司（識別）維基：https://zh.wikipedia.org/zh-tw/臺灣鐵路公司
- 品牌識別優化案例：https://www.blueprint.com.tw/portfolio-collections/cis/23a1
- Departure Mono：https://departuremono.com/ · https://github.com/rektdeckard/departure-mono
- VT323：https://fonts.google.com/specimen/VT323 · DSEG：https://github.com/keshikan/DSEG
- Pixabay 音效：https://pixabay.com/sound-effects/search/train-announcement/
- Freesound：https://freesound.org · Orange Free Sounds：https://orangefreesounds.com/train-announcement-chime/
- Wikimedia Commons（TRA 車內）：https://commons.wikimedia.org/wiki/Category:Train_interiors_of_Taiwan_Railway_Administration
- Wikimedia Commons（EMU800）：https://commons.wikimedia.org/wiki/Category:TRA_EMU800
- 多良車站：https://www.taiwan.net.tw/m1.aspx?sNo=0001016&id=A12-00377

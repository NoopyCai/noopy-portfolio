# 夜車・區間 — NoopyCai Portfolio

蔡守傑 NoopyCai 的個人作品集。台鐵 EMU900 夜車主題、捲動驅動的單頁互動:進站綠色線稿藍圖 → 車窗填滿 → **Start ride** → 隨捲動一站站行進,每站一個作品,車窗即時渲染在地風景(月台 / 城市黃昏 / 跨河大橋 / 台北 101 / 田野 / 南迴海景),車內燈光隨窗外光線改變,頂端 LED 報站。靈感來自 [yukiasakura.com](https://yukiasakura.com) 的「從車窗看作品」概念,在地化為原創的台灣夜車版本。

## Tech Stack

- **Next.js 15**(App Router)+ **React 19** + **TypeScript**(strict)
- **GSAP 3 + ScrollTrigger** — 捲動 pin + 進度驅動
- Canvas 像素窗景即時渲染 · Web Audio 合成到站音 · 自製輕量 i18n(繁中 / English)
- **Vitest** 單元測試(進度數學 / 資料 / 場景 / i18n)
- 部署:**Vercel**

## 開發

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # vitest(11 個測試)
```

> 若 `esbuild` / `sharp` 的原生 binary 未安裝(allow-scripts 擋下),跑 `npm rebuild esbuild sharp`。

## 部署(Vercel)

1. push 到 GitHub,於 Vercel import 專案(框架自動辨識 Next.js)。
2. 設定環境變數 `NEXT_PUBLIC_SITE_URL` = 你的正式網域(供 metadata / OG / sitemap 產生絕對網址)。
3. Deploy。

## 結構

```
app/            layout(metadata/OG)、page(reduced-motion 分流)、globals.css、opengraph-image、robots、sitemap
components/     ScrollJourney(捲動旅程)、CabinComposite(車廂合成)、Window、WireCar(線稿)、
                StationPanel、LedSign、SoundToggle、TopBar、LangProvider、StaticFallback
content/        stations.ts(站點/作品資料)、i18n.ts(雙語)
lib/            progress.ts(進度數學)、scene.ts(像素窗景渲染)
public/         cabin.jpg(車廂插畫)、resume、fonts
design-system/  設計原型與素材(HTML,見開發歷程)
docs/           規格調查與實作計畫
```

## 素材與授權

- **車廂插畫** `public/cabin.jpg`:AI 生成的原創插畫(EMU900 風格),非台鐵官方素材。
- **窗景**:程式即時渲染(pixel art),原創。
- **LED 字型**:設計採用 Departure Mono(SIL OFL);若 `public/fonts/DepartureMono-Regular.woff2` 未放置,會 fallback 到系統等寬字。
- **到站音效**:Web Audio 合成的兩音「叮咚」,無版權;**未**使用台鐵官方到站音樂。
- **圖示 / 品牌**:未使用台鐵官方 logo;站徽為原創意象。
- 隱私:僅公開 Email / GitHub / LinkedIn,不含電話與住址。

## 已知簡化(v1)

- 站與站之間窗景為「切換」而非連續全景滑動(地標橫移到下一扇窗)——列為後續增強。
- 手機版 pin + 捲動需在 iOS Safari 實測;必要時降級為直向 snap。
- 側窗與中央窗共用亂數種子,樓群樣式可能相近。

—— Built with Claude Code.

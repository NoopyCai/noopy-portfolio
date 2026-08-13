# Spec:內容線 —— Concourse 時刻表、h1、專案佐證

> 依 2026-08-13 grilling 收斂(Q6a + Q9–Q13)。上游:`docs/design-audit-2026-07.md` §1.3/§6/§7.3/§10.3。
> 與 3D 線(`3d-stages-2026-08.md`)檔案零重疊,可完全並行。
> 已定案:時刻表照 audit §6.1 / **h1 只顯示 NoopyCai**(Q10)/ 文案由 team-lead 草擬使用者改(Q11)/ 三張截圖接進「看細節」modal(Q12a)/ 終點站與 Concourse 聯絡資訊分工(Q13a)。

## 1. 時刻表看板(audit §6.1)

**目的**:一塊東西解決四件事 —— SSR 內容(爬蟲目前看不到四個作品站)、recruiter 60 秒掃描路徑、Concourse 空洞、版型家族單一。

- 位置:Concourse 第一個區塊(hero 之後)。資料從 `STATIONS` 程式化產生,**不新增第二份內容來源**。
- 欄位:`序 | 站名 | 年份 | 停靠內容 | 月台`。停靠內容 = 專案站用 `subtitle` 或 tags 前三項、非專案站用固定描述;年份沿用現值(2024/2024/2025,review 時可改)。
- 互動:每列可點 → 跳回該站。實作:`TOTAL_LEN` 移到 `lib/progress.ts`、`smoothScrollTo` 從 ScrollJourney 導出,Concourse 直接計算 `TOTAL_LEN * pTarget`(公式同 jumpTo);reduced-motion 分支(無 ScrollJourney)時該列不可點(游標與 aria 一致)。
- hover:該列背景亮起(`--font-led` + LED 綠),transition 只動 background/color。
- **hairline 紀律**:只在表頭下、表尾上各一條線,列間靠 hover 區分(audit 明文)。
- 標題列:`◄ 本日行駛紀錄 DEPARTURES ►`(LED 語彙,發光字元)。
- SSR:Concourse 一律渲染(現狀),表格內容自然進 initial HTML —— 驗收要 `curl` 確認六站站名/專案名出現在 HTML。

## 2. h1 站名牌(audit §6.3,依 Q10 修改)

- Concourse hero 重做:
  ```html
  <p class="eyebrow-sign">CONCOURSE</p>          <!-- 降為方位小標(11px) -->
  <h1 class="h1-sign">NoopyCai</h1>              <!-- 只顯示 NoopyCai(Q10 定案) -->
  <p class="h1-role">Software Engineer · 前端 / 全端</p>
  ```
- `h1` 用 `--font-led`、`clamp(40px, 7vw, 76px)`、站名牌式字距。
- **「蔡守傑」的 SEO 保全**(h1 不顯示中文名的配套,不可省):
  - 「關於我」第一段內文包含全名(見 §3 文案)
  - `metadata` title/description 已含(現狀保留)
  - JSON-LD `Person.name = "蔡守傑"`、`alternateName = "NoopyCai"`(見 §6)
- 全站 h1 唯一性:StaticFallback 已有 h1,互斥分支(reduce 才渲染 StaticFallback),但 Concourse 現在一律渲染 → **StaticFallback 的 h1 降為 h2**,Concourse 的 h1 是全站唯一。

## 3. 「關於我」三段新文案(audit §6.2;草稿如下,review 時直接改這裡)

> 現狀問題:兩段逐字抄自站 1 與站 6,讀者捲下來重讀一遍。以下三段取代,zh/en 同步(en 照邏輯重寫非機翻)。

**① 怎麼工作的**
- zh:「我是蔡守傑,在電商團隊同時照顧前端與資料兩端:白天調 Vue 元件的互動,晚上排 BigQuery 的推薦管線。能一個人把功能從 UI 一路做到伺服器端上線,是我最常被需要的原因。」
- en: "I'm NoopyCai. On an e-commerce team I work both ends: tuning Vue interactions by day, scheduling BigQuery recommendation pipelines by night. Owning a feature from UI to server-side launch is what teams rely on me for."

**② 想找什麼**
- zh:「正在尋找前端或全端的角色,偏好產品導向、願意對成效負責的團隊。Base 台北/新北,對遠端友善的環境有加分。」
- en: "Looking for a frontend or full-stack role on a product-minded team that owns outcomes. Based around Taipei; remote-friendly is a plus."

**③ 這個網站本身**(把技術展示變內容,目前只活在 README)
- zh:「這個網站也是作品:六站窗景由 canvas 逐像素即時繪製,車門過場是 three.js 場景,整趟旅程掛在同一個捲動標量上、倒著捲就倒著開。做法都在 GitHub。」
- en: "This site is itself a project: the window scenery is pixel-painted on canvas in real time, the doors are a three.js scene, and the whole ride hangs off a single scroll scalar — scroll back and the train runs backward. It's all on GitHub."
- 「GitHub」連到 repo(使用者的 `github.com/NoopyCai`;若 repo 尚未公開,review 時說,連結先拿掉)。

## 4. 專案佐證:截圖進「看細節」modal(audit §7.3,Q12a)

- 素材:`public/imgs/{recommendation,line_liff,ai_news_hub}.png`(2940px,共 5.2MB)→ 管線壓縮:1600px 寬、mozjpeg q82(無 alpha),目標每張 ≤ 250KB,原 PNG 刪除。對應站:recommendation / liff / ai。
- `PanelData` 加 `screenshot?: string`;modal 在「問題/做法/成果」三段**之前**放截圖(圖先給第一印象),`loading="lazy"`、有 alt(描述畫面內容)、圓角遵守形狀系統(卡片級 16px)。
- 手機:圖滿 modal 寬,maxHeight 40vh、`object-fit: contain`。
- 技能站/月台/終點站無截圖,欄位缺省不渲染(現有慣例)。

## 5. 聯絡資訊分工(audit §6.4,Q13a)

- 終點站(車廂內)panel:**移除 contacts 與履歷連結**,只留 title/body 情緒收尾,body 加一句「出站後的大廳可以找到我」指向下方。
- Concourse「保持聯絡」成為唯一行動點(現有內容不變)。
- StaticFallback:保留終點站 contacts(reduced-motion 使用者的 Concourse 在頁尾,但別讓他們多捲——維持現狀渲染即可,實作時確認兩處皆可達)。

## 6. JSON-LD(audit §10.3,順帶)

- `layout.tsx` 注入 `Person`(name 蔡守傑 / alternateName NoopyCai / jobTitle / sameAs GitHub+LinkedIn / knowsAbout 核心技術)+ 每專案一筆 `CreativeWork`(name/description=impact/keywords=tags),**全部從 STATIONS 程式化產生**。

## RWD

| 元件 | 桌機 | ≤640px |
|---|---|---|
| 時刻表 | 五欄表格,單欄寬 920px(§6.7 的放寬一併做) | 摺成卡列:每站一列兩行(上:序+站名+年份;下:停靠內容),月台欄隱藏;列仍可點,觸控目標 ≥44px 高 |
| h1 站名牌 | clamp 上限 76px | clamp 下限 40px,字距略縮(.2em)防溢出 |
| modal 截圖 | 滿卡寬 | maxHeight 40vh + contain |
| 時刻表 hover | 背景亮起 | 無 hover,以 `:active` 回饋 |

## 驗收

1. `curl localhost:3000` 的 HTML:`<h1>NoopyCai</h1>` 存在且唯一;六站站名與三個專案名出現;JSON-LD 兩類節點可解析(`python -c 'json.loads'`)。
2. 時刻表點列跳站正確(含 reduced-motion 分支不可點);hover/active 回饋。
3. modal 三站有截圖、其餘無;截圖 lazy(首屏網路面板無 imgs 請求)。
4. 終點站無聯絡連結、Concourse 有;StaticFallback 聯絡可達。
5. Lighthouse SEO 分數回報前後對比;tsc + tests 綠(stations 型別變更同步測試);build 照 CLAUDE.md 順序。
6. 390×844 卡列版時刻表可讀可點。

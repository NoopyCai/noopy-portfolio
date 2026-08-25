# 創意批次 · 內容線 + 生命感 + 傳播面(2026-08)

> 8 項提案採納 7 項(「窗景自走」經確認**放棄**,render-on-demand 憲法維持不變)。
> 本批最高原則:**新增任何動態都不得破壞「不捲動 = GPU 零工作」**。
> 決策紀錄:架構圖由 Claude 起草、使用者修正;OG image 程式生成;車票文案「擬真 + 一點玩味」。

---

## §0 效能憲章(全批共同驗收,Batch C 逐條量測)

| # | 規則 | 量法 |
|---|---|---|
| P1 | 閒置時 GPU 零工作維持不變 | `__door3d.stats().frames` 靜止 5 秒不增 |
| P2 | **不新增任何常駐 rAF**(既有 sway 迴圈是唯一例外,不動它) | code review + DevTools Performance 錄影 |
| P3 | 時間驅動動態一律 CSS animation(compositor thread),限定相位、離開相位即停(`display:none` 或移除節點) | DevTools 圖層/主執行緒檢查 |
| P4 | draw calls < 30、三角形 < 500 的既有預算不變;玻璃倒影 +1 draw call 記入 | `stats()` 六站 + 隧道逐段讀值 |
| P5 | 捲動全程 ScriptDuration 不得比現狀差 > 5% | CDP harness 前後對照(同機、同視窗、同捲動腳本) |
| P6 | 所有亮度變化 < 3Hz(WCAG 2.3.1);gate 燈微顫 ~0.15Hz、opacity ≤ 0.02 | 常數 review |
| P7 | 新增靜態資產計入載入預算:og.png ≤ 200KB、三張 SVG 合計 ≤ 120KB、不新增 preload(都不是首屏資源) | `ls -la` + network 面板 |

每項的效能歸類:

| 項目 | 歸類 | 執行期成本 |
|---|---|---|
| OG image / 架構圖 / 車票 / 時刻表欄 | 靜態 | 零 |
| 玻璃倒影 | 純捲動驅動(掛既有 `frame.tunnel.dim`) | 零新增迴圈,+1 draw call |
| LED 時鐘 | setInterval 30s,`document.hidden` 停 | 每 30 秒一次 DOM 文字寫入 |
| gate 月台等車 | 純 CSS keyframes,只在 gate 相位存在 | compositor only |

---

## §1 OG image(傳播面)

**現況**:`layout.tsx` 的 `openGraph` / `twitter` 沒有 `images` —— 連結貼到 LinkedIn / Slack 是一片灰。

**做法**:
- `scripts/og.mjs`(node + sharp,sharp 進 devDependencies):以 SVG 合成輸出 `public/og.png` 1200×630。
- 構圖:LED 看板視覺 —— 夜色底(站內 `--bg` 同色系)、上緣 `◄ 夜車・區間 NIGHT LOCAL ►` 小標、中央 `NoopyCai` 站名牌(Departure Mono,琥珀 `--amber` 發光字)、下緣 `Software Engineer · Frontend / Full-stack`。字型直接嵌 `public/fonts/DepartureMono-Regular.woff2`(SVG `@font-face` → sharp 光柵化;若 sharp 吃不到 woff2 就先轉 ttf 給 script 用,轉檔不進 repo 的 public/)。
- 中文字(夜車・區間)用系統黑體會與站內一致性差 —— 構圖以拉丁字為主、中文只出現在小標,掉字型風險最低。
- `layout.tsx`:`openGraph.images = [{ url: "/og.png", width: 1200, height: 630 }]`、`twitter.images = ["/og.png"]`、`twitter.card` 維持 `summary_large_image`。
- script 進 repo(`npm run og` 加進 package.json scripts),PNG 也進 repo —— build 不依賴它重跑。

**驗收**:og.png ≤ 200KB;`npm run build` 後 head 裡有 `og:image` / `twitter:image` 絕對網址;像素字邊緣銳利(不做縮放模糊)。

**RWD**:不適用(固定 1200×630;各平台自己裁切,重要內容置中 60% 安全區)。

---

## §2 專案架構圖 ×3(內容線,最能換到面試)

**做法**:
- 三張靜態 SVG 進 `public/diagrams/`:`recommendation.svg`、`ai-news-hub.svg`、`line-liff.svg`。
- 視覺語言 = 台鐵路線圖:節點(站點)= 服務/元件,連線 = 資料流,換線(轉乘)= API 邊界,粗線 = 主資料流。配色沿用站內 token(`--amber` / `--muted` / LED 綠),字用 Departure Mono(英文技術名詞)+ 系統黑體(中文標籤,SVG 裡明確給 fallback stack)。
- **內容流程(紅線)**:實作前 Claude 依 `content/stations.ts` 的描述起草三張的元件/資料流清單給使用者修正,**使用者確認內容正確後才畫圖**。圖上不得出現臆測的元件名。
- 呈現:`content/stations.ts` 的 `panel` 加 `diagram?: { src: string; alt: Bi }`;`StationPanel` 的「看細節」modal 裡渲染 `<img>`(放在 body 文字之後);`StaticFallback` 的對應專案區塊也渲染(reduced-motion / 爬蟲的內容對等)。
- **文字不進 WebGL**(既有紅線):圖只活在 modal / StaticFallback,不上車廂牆。

**RWD**:SVG 帶 `viewBox`、`max-width: 100%`;圖若寬於 480px 的可讀極限,外層給 `overflow-x: auto` 容器(頁面本體不得橫向捲動);最小字級以 390px 寬的 modal 實測可讀為準(不可讀就簡化圖,不是縮字)。

**驗收**:三張合計 ≤ 120KB;390px 與 1440px 下 modal 內可讀;alt 雙語;`stations.test.ts` 的隱私檢查涵蓋新欄位。

---

## §3 車票履歷(內容線)

**做法**:
- `Concourse` 「保持聯絡」區的履歷入口從文字連結改為台鐵名片式車票(橫式,比例約 2.3:1,純 CSS + 既有字型,不用圖檔)。
- 欄位(擬真 + 一點玩味,雙語走 `t()`):
  - 票種列:`區間 LOCAL` + 票號(裝飾用固定字串)
  - 主行:`求職中 → 貴公司`(en:`Job Hunting → Your Company`)
  - 日期:發行日印 `2026.--.--`(不做動態日期,車票是印刷品)
  - 票價欄:`面談後議 · Fare negotiable`
  - 下緣:`憑本票下載履歷 PDF ↓` 一行小字
- 整張是一個 `<a href="/resume/Noopy_resume2026.pdf">`,`download` 屬性不加(讓瀏覽器內開 PDF)。
- 樣式進 `globals.css` 新 `.ticket-*` class 群;虛線裁切邊、淡水印用 CSS(repeating-linear-gradient / border-style: dashed),不引資產。
- hover:輕微亮起 + 1° 旋轉歸正(既有 `:active` 觸壓語言);reduced-motion 下無 transform 過渡。

**RWD**:寬度 `min(420px, 100%)`,320px 下維持橫式、字級縮至可讀下限;不換直式版型。

**驗收**:桌機/手機點擊都開得了 PDF;鍵盤 focus 有 `:focus-visible` 框;車票文字對 AA 對比。

---

## §4 時刻表狀態欄(內容線)

**做法**:
- `content/stations.ts` 加 `status?: Bi`(每站一句):上線專案「正點抵達 / Arrived on time」、進行中「行駛中 / In service」、技能站「加開列車 / Extra service」、hero/contact 站給對應敘事(「本日始發 / First departure」「終點站 / Terminus」)。實際措辭 Claude 起草、使用者修正(與 §2 同一輪確認)。
- `Concourse` 時刻表加「狀態」欄(`th` + `td`),LED 綠/琥珀兩色語意:正點 = 綠、其他 = 琥珀(沿用既有 token)。
- `StaticFallback` 不動(它沒有時刻表)。

**RWD**:新欄不得造成頁面橫向捲動。< 520px 時「年份」欄隱藏(資訊在資訊卡裡有)讓位給狀態欄;狀態欄在窄幅顯示圓點 + 兩字縮寫(`正點` / `行駛` / `加開`)。390px 實測無溢出。

**驗收**:六站狀態雙語齊;390px / 1440px 無橫向溢出;`stations.test.ts` 型別與隱私檢查更新。

---

## §5 玻璃倒影(生命感,本批唯一動場景的項目)

**做法**:
- `door3d/cabin.ts` 加一片 cover 尺寸的平面於 **z = -8.01**(牆後、隧道壓暗 -9 之前):cabin 貼圖**水平鏡像**(`texture` 共用既有的牆貼圖,材質 `map` 同源、uv x 翻轉或 `scale.x = -1`),`transparent`,`opacity = frame.tunnel.dim × K_REFLECT`。
- 透過窗洞(牆的 alpha)露出 —— 進隧道窗外一暗、玻璃上浮出車廂內部的倒影;出隧道歸零。**純捲動驅動、倒捲天然可逆、零新增迴圈**。
- `K_REFLECT` 起始值 0.22(「看得見但要注意才發現」),驗收時由使用者現場調。
- 倒影平面**參與 exit 的佈景凍結**(它在 frozen 清單裡與牆同組),不參與 cover 重算之外的任何特例。
- 灰階/壓暗處理:倒影材質吃同一個 grade shader 會把六站燈光曲線也鏡像進去 —— **刻意不吃 grade**,用單獨的 basic material + 固定壓暗常數(倒影本來就該比實景灰),避免 shader 分支。
- 降級路徑(CabinComposite)**不做**:它連隧道都沒有(Q3a 凍結的降規格),沒有 `tunnel.dim` 可掛。

**RWD**:cover 幾何天然視窗無關;直式手機下窗洞比例不同但倒影邏輯相同,390×844 實測不露邊。

**驗收**:+1 draw call(P4 記帳);隧道外 `stats()` 讀值與現狀相同;倒捲逐像素可逆(既有 CDP 腳本加一段隧道區間對照);`opacity = 0` 時該平面不噴 draw call(three 對全透明材質仍會畫 —— 用 `visible = frame.tunnel.dim > 0.01` 切,這行是 P4 的必要條件)。

---

## §6 LED 時鐘(生命感)

**做法**:
- `CabinFrame` 跑馬燈輪播插一則「現在時刻 HH:MM」(訪客本機時間,24 小時制;en:`TIME NOW HH:MM`)。
- 更新:`setInterval` 30 秒,`document.hidden` 時暫停(visibilitychange);只改 textContent,不觸發 React re-render(跑馬燈本來就是 DOM 直寫的層)。
- 字元集全是數字/拉丁,`--font-led` 無 CJK 的既有缺陷不會被踩到(「現在時刻」四個中文字改用 `◄ ►` 與數字為主的排版:`◄ 22:47 ►`,中文乾脆不出現 —— 與既有缺陷解耦)。

**RWD**:跑馬燈既有版式,無新工作。

**驗收**:掛起分頁 5 分鐘回來時間正確(interval 暫停後恢復要重算,不是累加);reduced-motion 路徑無此元件,不需處理。

---

## §7 gate 月台等車(生命感)

**做法**:
- gate 相位那片 `var(--bg)` 空白加兩個**純 CSS 動畫**(新 DOM 節點掛在 gate 層,`phase !== "gate"` 時整組不渲染):
  1. **頂棚燈微顫**:全幅淡暖色 overlay,`opacity` 0 → 0.02 keyframes,週期 6.5s(~0.15Hz,P6 紅線內)。
  2. **對向列車通過**:每 ~10s 一道橫向亮帶(寬 ~18vw 的漸層,`transform: translateX(-20vw → 120vw)`,1.2s,`animation-delay` 錯開;只用 transform + opacity,compositor only)。
- 亮帶語意:你站在月台上,對面軌道有車過 —— 不動月台本身(既定原則:等車時月台不該動)。
- 「開始乘車」按鈕的既有 pulse 不動。
- reduced-motion:整條 ScrollJourney 都不掛載,天然免疫;另在 CSS 加 `@media (prefers-reduced-motion: reduce) { animation: none }` 兜底(防未來 mount 條件改動)。

**RWD**:vw 單位天然滿幅;直式手機亮帶寬改 ~30vw(窄幅下 18vw 太細讀不到)。

**驗收**:gate 相位 DevTools Performance 錄 10 秒 —— 主執行緒無週期性工作、動畫都在 compositor;捲進 ride 後節點消失、動畫停;亮度變化頻率與幅度符合 P6。

---

## §8 實作順序與派工

**前置**:先 commit 目前工作樹的 3D 收官批次(2b + 死區 + panel/gate 修正)—— 本批動同一批檔案,不能疊在未 commit 的變更上。

| Batch | 內容 | 派工 | 相依 |
|---|---|---|---|
| 內容確認 | 架構圖三張的元件/資料流清單 + 時刻表六站狀態措辭,給使用者修正 | 主 session 起草 | 無 |
| A 內容批 | §1 OG + §3 車票 + §4 時刻表欄(並行);§2 架構圖(等內容確認) | task-implementer ×2~3 | 內容確認 |
| B 場景批 | §5 玻璃倒影 + §6 LED 時鐘 + §7 gate 月台 | task-implementer ×1(§5 與 §7 都碰 ScrollJourney 周邊,串行安全) | **排在 A 之後**:§3/§4/§7 都動 `globals.css`,並行必撞檔 |
| C 效能收官 | §0 P1–P7 逐條量測 + 全站捲動掃描前後對照 | task-reviewer / 驗證 agent | A + B 完成 |

驗收後一次 commit(或 A/B 各一個 commit),使用者手感驗收 → push。

## §9 測試

- `content/stations.test.ts`:`status` / `diagram` 欄位型別與隱私檢查(alt 文字不得含電話/地址)。
- `lib/progress.test.ts`:不動(本批不碰相位數學)。
- 視覺/效能驗收走 CDP harness(P1/P4/P5 + §5 倒捲對照),腳本沿用 /tmp/noopy-cdp 既有那套。

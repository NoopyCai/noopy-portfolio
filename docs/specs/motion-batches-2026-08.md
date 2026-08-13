# Spec:動畫深化 · 第一批 / 第二批

> 依 2026-08-13 grilling 收斂的決策撰寫,實作前需使用者 review 通過。
> 上游文件:`docs/motion-proposals-2026-08.md`(提案與依賴圖)、`docs/design-audit-2026-07.md`。
> 已定案的決策:明顯停站(Q2)/ 微晃幾乎無感(Q3)/ 出站門在身後關上(Q4)/ 隧道一段、LIFF→AI 之間(Q5)/ 玻璃極淡(Q6)/ 隧道無音效(Q7)/ 分兩批驗收(Q8)/ B2 併第二批(Q9)/ §4.4 併第二批且先於 E1(Q10)/ E1 分鏡照 Q11。

## 全局約束(兩批共同)

- **不加任何新依賴。**
- 三條紅線:亮度變化 <3Hz(WCAG 2.3.1)/ sway 過掃描垂直餘裕 ≤3px / 時間驅動迴圈必須在「非 ride、`document.hidden`、reduced-motion」三態停止。
- reduced-motion 檢查從 mount-once 改為 `mq.addEventListener("change")`(現況 `ScrollJourney.tsx` 只查一次)。
- 所有捲動敘事效果由 progress 插值(可倒放);時間驅動效果只做氛圍(微晃、微顫),不承載敘事。
- 每批完成:tsc + `npm test` 綠、production build 照 CLAUDE.md 順序、真機(桌機+手機)由使用者驗手感後才進下一批。
- 不動:末幀對位常數(FOV/CAM_Z1/CABIN_Z/zoom)、燈光與 emissive(坑 11)、`drawScene` 快取結構(坑 8)。

---

## 第一批(半天,無依賴、零效能風險)

### 1. B1 · 到站減速曲線(明顯停站)

**檔案**:`lib/progress.ts`、`lib/progress.test.ts`、`components/ScrollJourney.tsx`

- 新增 `stationEase(x: number): number`:對每段 `f = x - floor(x)` 做
  `f' = smooth(clamp((f - DWELL) / (1 - 2*DWELL)))`,**`DWELL = 0.15`**。
  效果:每站前後各 15% 的捲動距離完全靜止(合計每站有 30% 段長的「停站窗口」),中段以 smoothstep 起步/巡航/減速。
- `ScrollJourney` 的 `x` 改為 `stationEase(rp * (n-1))`;`index`/`dist`/`pan`/`grade` 全部吃 eased x(單一來源,不要兩套)。
- `jumpTo` **不需要反函式**:現有線性目標落在 `f=0`,即停站窗口正中(`stationEase(整數)=整數`)。維持現狀,加註解說明為什麼不用改。
- 測試(加 4 條):整數點不動(`stationEase(i)===i`)、單調不減、整數點兩側導數趨近 0(有限差分 <0.01)、中點對稱(`stationEase(i+0.5)≈i+0.5`)。

**驗收**:捲動時列車在每站「明顯停住」再起步;資訊卡的可讀期間 = 停站期間;點路線圖跳站落點在停站窗口內。

### 2. A1 · 行進底噪(幾乎無感)

**檔案**:`components/ScrollJourney.tsx`(既有 sway rAF 內)

- 疊加項(t = 秒):
  `noiseX = (sin(t*1.3) + 0.5*sin(t*3.7)) / 1.5 * 2.0px`
  `noiseY = (sin(t*1.7) + 0.6*sin(t*2.9)) / 1.6 * 1.5px`(**上限 2px,絕不超過 3px**)
  `noiseR = sin(t*1.1) * 0.08deg`(加進 transform 的 rotate)
- **到站收斂**:`calm = smooth(clamp((0.15 - dist) / 0.15))`(dist 用 eased x),振幅乘 `(1 - calm)` → 停站時完全靜止,起步漸起。這同時是 B4 的「停穩」觸覺證據。
- Gating:`phase === "ride" && doorP >= 1 && !document.hidden && !reducedMotion`;掛 `visibilitychange`;非 ride 時噪聲項為 0(滑鼠收斂邏輯照舊)。

**驗收**:手機(無滑鼠)畫面不再是凍結照片;晃動「讀不出在動,只讀得出不是靜止」;進站時晃動平息。

### 3. B4 · exit 分節(停穩 → 起身 → 半拍 → 轉身)

**檔案**:`components/ScrollJourney.tsx`(純數值)

- `rise = smooth(clamp(e / 0.40))`(原 0.45)
- **半拍:e 0.40–0.48 什麼都不動**
- `turn = smooth(clamp((e - 0.48) / 0.52))`(原 0.35/0.65,消除與 rise 的重疊)
- `camOpacity` / `introOpacity` 的窗口第一批不動(第二批 E1 會重排)。
- 「停穩」由 A1 的 calm 在終點站自然達成,不需額外程式。

**驗收**:起身和轉身讀成兩個動作,中間有一個「定住」的瞬間。

### 4. A6 · 車窗玻璃實體感(極淡)

**檔案**:`components/Window.tsx`(每窗一層 overlay div)、`app/globals.css`(`.win-glass`)、`components/ScrollJourney.tsx`(CSS 變數)

- 每扇窗內加 `position:absolute; inset:0; pointer-events:none` 的 `.win-glass`:
  - 斜向反光帶:`linear-gradient(105deg, transparent 40%, rgba(220,235,255,.045) 47%, rgba(220,235,255,.02) 53%, transparent 61%)`
  - 角落水氣:兩個 `radial-gradient`(左下/右上,`rgba(255,255,255,.03)`,半徑 ~30%)
  - **總不透明度上限 0.05**(「極淡」的定義)
- 視差:sway rAF 把滑鼠值寫成 `.camera` 上的 `--glass-x/--glass-y`(±3.5px),`.win-glass` 用 `translate` 吃它 → 玻璃比景多動一點。手機/reduced-motion:變數恆 0,靜態層保留。

**驗收**:注意看才看得到;亮站(taipei)下不加劇資訊卡的對比問題。

### 5. C1b · 路線圖點擊漣漪

**檔案**:`app/globals.css`

- `.routemap-dot::after`:琥珀色圓環,`:active` 觸發 `ripple 260ms ease-out`(scale .6→2.2、opacity .8→0)。
- reduced-motion:`animation: none`。

**驗收**:點擊跳站的 1200ms 等待期間,有即時的「按到了」回饋。

---

## 第二批(第一批真機驗收後動工;順序固定如下)

### 6. §4.4 · exit blur 移除(先做)

**檔案**:`components/ScrollJourney.tsx`

- 刪除 `camFilter` 的每幀 `blur()`(全視窗高斯模糊,效能地雷)。轉身的空間感由既有 rotateY/translateX/opacity 承擔。
- **先不做**雙層預模糊 crossfade:E1 的門會接管 exit 尾段的畫面,blur 的敘事空缺由門補上;驗收時若覺得少了失焦感再議。
- `will-change` 收斂:exit 結束後設回 `auto`。

### 7. E1 · 出站的門(車門在你身後關上)

**檔案**:`components/door3d/scene.ts`、`components/Door3D.tsx`、`components/ScrollJourney.tsx`、`lib/progress.ts`(+tests)

- `lib/progress.ts` 加 `exitDoorProgress(p)`:e 0.62–0.95 映射 0→1(e = exitProgress)。
- **分鏡**(全部由 e 插值,可倒放):
  | e | 畫面 |
  |---|---|
  | 0–0.40 | 起身(B4) |
  | 0.40–0.48 | 半拍 |
  | 0.48–0.62 | 轉身(turn 前段) |
  | 0.62–0.75 | `.camera` 淡出;**Door3D 淡入**:月台側視角(相機固定 z≈+3,不 dolly),門開著,門縫裡是車廂內裝 |
  | 0.62–0.95 | 門由開到關(進站開門動畫反放) |
  | 0.80–1.0 | 門閉合的同時 Concourse hero 淡入(門關 = 簾幕落下) |
- `scene.ts`:`render(p, mode)` 加 `mode: "enter" | "exit"`。exit 模式:相機固定月台側、門位置 = `1 - p` 的開度、暖光楔隨門縫收窄。**不動 enter 模式的任何常數。**
- `Door3D` 的 `active`:`p < PHASE.doorEnd + 0.02 || (phase === "exit" && e >= 0.60)`。同一個 canvas、同一個 context(坑 10)。
- 出站門**不需要像素級對位**(前後都是 crossfade,不是硬交棒)。

**驗收**:轉身後看到車門在眼前關上、大廳隨之浮現;往回捲門重新打開、回到車上;來回三趟無白屏。

### 8. A5 · 隧道段(一段,LIFF → AI 之間)

**檔案**:`components/CabinComposite.tsx` 或 `ScrollJourney.tsx`(overlay 層)、`app/globals.css`

- 觸發區間(eased x 空間):`x ∈ [2.42, 2.58]`(LIFF=2、AI=3 的巡航段中央;資訊卡隱藏區間是 dist>0.34 ⇒ x∈[2.34,2.66],隧道完全落在其內,**不與卡片重疊**)。
- 分段(以 `u = (x - 2.42) / 0.16` 插值):
  - 進洞 u 0–0.15:三扇車窗各自疊的 `.win-dim` overlay opacity 0→0.94(窗景近黑);一道垂直暗帶按 pan 方向掃過中央窗(translate 由 u 驅動)
  - 洞中 u 0.15–0.85:車廂加一層極淡暖色提亮 overlay(opacity 0.05,「車內比車外亮」在這裡是對的);一條暖色光帶(`repeating-linear-gradient`)以 `u` 驅動橫掃車廂內壁(**由捲動不由時間**,可倒放)
  - 出洞 u 0.85–1:窗景恢復 + 回光(白色 overlay opacity 0.12→0,由 u 驅動)
- 亮度變化全部由捲動速度決定 → 使用者自己控制頻率;正常捲速下 <1Hz,快速捲動最壞情況也受 scrub 0.5 平滑;所有 overlay 只動 opacity/transform(合成層)。
- 無音效(Q7)。

**驗收**:LIFF 離站後過一段隧道再進台北;倒捲隧道倒放;讀卡片時不會突然變暗。

### 9. B2 · 月台進站(窗外真的有站)

**檔案**:`components/Window.tsx`(中央窗第二層)、`lib/scene.ts`(不改繪製,只複用 platform 場景)

- 中央窗新增 `platformLayer`(canvas,同 blit 機制,src = 既有 `drawScene("platform")` 的 strip,走同一個 Map 快取)。
- `opacity = smooth(clamp((0.12 - dist) / 0.12))`(dist 用 eased x):隨 B1 減速,月台從無到有滑入、隨停站定格。
- `pan` 與主窗景同源 → 減速曲線免費繼承。
- **第 0 站(platform)不疊**(窗外本來就是月台,疊了會雙重)。
- 快取增量:+1 種 scene 組合(platform strip 已存在,實際 +0)。

**驗收**:每站進站時窗外滑入月台(警戒線、立柱、燈池)並停住;離站時月台退出;第 0 站無雙重月台。

---

## RWD 設計(兩批共同)

### 全局規則

1. **裝置能力用 media query 判斷,不用寬度猜**:滑鼠相關(玻璃視差、之後的 C3)gate 在 `matchMedia("(hover: hover) and (pointer: fine)")`;觸控裝置該變數恆 0,靜態層保留。既有的 `narrow`(≤640px)只管版面,不拿來判斷有沒有滑鼠(iPad 外接滑鼠、觸控筆電都會誤判)。
2. **斷點沿用現有三檔**:≤900px / ≤640px / `max-height:480px + landscape`。動畫不新增斷點。
3. **所有 overlay 用百分比定位**(相對 `CabinComposite` 的 cover 幾何),不寫死 px —— 直式手機的 cover 裁切下位置才會跟著對。
4. **效能預算以中階 Android 為準**:兩批加總後,ride 相位的每幀工作 = 既有 sway rAF + A1 兩個 sin + (第二批)最多一次 platformLayer blit。不允許新增獨立 rAF 迴圈。

### 逐項 RWD 行為

| 項 | 桌機 | 手機直式(≤640) | 橫式矮螢幕(≤480h) | 備註 |
|---|---|---|---|---|
| B1 減速曲線 | 停站窗口 30% 段長 | **同值**。觸控甩動(flick momentum)下停站手感可能偏短,真機驗收若不夠「停」,DWELL 可上調至 0.18(只調常數) | 同左 | 純數學,無裝置分支 |
| A1 行進微晃 | X±2 / Y±1.5 / R±0.08° | **同值**(直式垂直餘裕 ~14.5px,滑鼠 ty=0,安全)。**手機是本項最大受益者**——修掉「凍結照片」 | 同值 | gating 三態相同 |
| B4 exit 分節 | rise/turn 重排 | **自動繼承**——`narrow` 的 2.5D camTransform 用同一組 rise/turn 變數,分節數值不用另寫 | 同左 | 驗收要兩種各跑一次 |
| A6 玻璃 | 靜態層 + 滑鼠視差 ±3.5px | **只有靜態層**(`hover:none` → 變數恆 0) | 同左 | 直式中央窗被 cover 裁切,反光帶角度在裁切後仍要落在可視區 → 用 % 定位 |
| C1b 漣漪 | 圓環從視覺圓點(12px)擴散 | **`::after` 要對齊 `::before` 的視覺圓點置中,不是 44px 命中區**——從 44px 盒子擴散會大得離譜 | 同左 | 觸控 `:active` 可觸發,無需 JS |
| §4.4 移除 blur | 移除 | 移除(**手機受益最大**——現況 blur 兩端都在跑) | 移除 | — |
| E1 出站門 | 月台側固定機位 | **exit 模式相機距離依 aspect 調整**:直式下門要佔畫面高度 ~70%(cover 思維,寧可門框裁切不要門變小);390×844 實測定案 | 橫式沿用桌機構圖 | enter 模式的對位常數不動;exit 不需像素對位所以 aspect 適配是安全的 |
| A5 隧道 | 窗景壓暗 + 光帶掃壁 | **同邏輯**。`.win-dim` 蓋在窗矩形(% 座標)上,直式裁切自動正確;光帶掃過滿屏車廂內壁,直式反而更沉浸 | 同左 | 亮度變化由捲速決定,觸控甩動最壞情況受 scrub 0.5 平滑,仍 <3Hz |
| B2 月台進站 | 中央窗第二層 blit | **同邏輯**(直式中央窗約滿寬,效果更明顯)。blit 只在 `opacity > 0`(dist<0.12)時執行,巡航段零成本 | 同左 | — |

### RWD 已知債(不在本 spec 範圍,但相關)

- `TOTAL_LEN = 8200` 寫死,橫式手機要捲 ~19 屏(audit §8.4)——B1 的停站手感在橫式會被放大檢視,若驗收時橫式手感差,優先修 §8.4 而不是調 DWELL。
- 手機無 swipe 跳站(audit §8.5)——C1b 漣漪只解「點了有回饋」,不解「難點到」。

## 驗收與回歸清單(每批跑一次)

1. `npx tsc --noEmit`、`npm test`(12+ tests)、production build(CLAUDE.md 順序)。
2. 桌機:gate → 門 → 六站 → exit → Concourse 全程;來回三趟;`isContextLost() === false`。
3. 手機(真機 192.168.5.54:3000):同上,並確認 A1 讓畫面不再凍結、無露邊;直式 390×844 與橫式各跑一趟(E1 的直式門構圖、A6 反光帶落點、C1b 漣漪大小)。
3b. 觸控裝置(hover:none):玻璃視差變數恆 0、靜態層仍在;B1 停站在甩動慣性下仍讀得出「停」。
4. reduced-motion(系統開啟後**中途切換**也要生效):StaticFallback 正常、Concourse 可見。
5. 首頁 First Load JS 不得增加(目前 162 kB);三角形數不得顯著增加(E1 復用場景)。
6. 已知的截圖環境限制:分頁被判遮擋時 rAF 凍結,截圖用 `__door3d.render(p)` 釘幀 + 隔次截圖交叉驗證。

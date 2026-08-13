# 「整個畫面更 3D 化」設計研究

> 2026-08-13。回應使用者:「如果整個畫面要更 3D 化,可以怎麼做設計」。
> 核心論點:先前(motion-proposals §2e)反對 ride 全 3D 的兩條理由 —— 常駐執行成本、末幀對位 —— 在**「統一場景」**(門場景不落幕)的前提下同時消解。本報告給出 L1→L3 的光譜、工程橫切面與分階段路線圖。

---

## §1 現況資產盤點(3D 化視角)

**已驗證的 3D 灘頭堡(door3d/)**:手寫 three、`render(x)` 一幀制無常駐 rAF、async chunk 已付費(~135KB gz)、76 tri / 23 calls、雙模式(enter/exit)共用一個 canvas 一個 context、EXPOSURE 曝光體系 + 程序貼圖 fallback、AI 素材換裝 SOP 成熟。

**2.5D 車廂(DOM)**:cabin.jpg 是**一張烤死的平面照** —— 拆不拆得開是資產面最大瓶頸(L1 的切入點)。三扇窗 = 2D canvas blit;LED/資訊卡/路線圖 = DOM。

**動態投資**:B1/A5/B2/E1 全由 eased x 插值、無時間項 —— 這個紀律是 3D 化的通行證。AI 生圖管線能產平面貼圖與拆層變體,**不能產 3D 模型**。

## §2 光譜總覽

| 層 | 一句話 | ride 渲染 | 新資產 | 工時 | 風險 |
|---|---|---|---|---|---|
| L1 深化 2.5D | cabin 拆層 + 窗景深度,全留 DOM | 照舊 | 2–3 張 AI 拆層變體 | M | 低 |
| **L2 統一場景** | 門場景不落幕,ride/exit 同一個 three 場景,DOM 只留文字 | WebGL render-on-demand | 複用 L1 + 現有全部 | L | 中 |
| L3 全 3D 建模 | glTF 車廂、相機軌道 | WebGL | Blender 建模(**管線外**) | XL | 高 |

不建議的中繼點:「只把窗景 3D 化」—— A3 雙層 blit 1/10 成本拿 8 成效果,且撞坑 10。

## §3 L1 · 拆層視差(2.5D 深化)

- cabin 拆兩層:`cabin-back.jpg`(inpaint 填掉立柱)+ `cabin-front.png`(立柱/拉環去背)。**正解是 inpaint 原圖**:back+front 疊回 = 原圖,像素 diff 可驗證對齊。
- 前景視差係數 1.6–1.8(滑鼠 ±15px 時多走 9–12px);**過掃描要重算**(近層自己 scale ~1.06 或滑鼠幅度降 ±10px)。不用真 translateZ(cover 幾何在不同視窗比例會錯位),乘係數平移即可。
- 窗景深度層 = A3 原案(快取 12→18 張)。
- 門過場零改動(sway 位移趨近 0 時兩層疊合 = 原圖)。
- **戰略價值:拆層素材正是 L2 的 relief 層素材** —— 分階段可交付的接點。
- 工時 M(一半在素材對齊);驗收:視差最大位移下立柱邊緣不露 inpaint 痕跡。

## §4 L2 · 統一場景「立體舞台」(核心提案)

**門開完 canvas 不落幕**,相機停在車廂裡繼續當 ride 舞台:
- 沒有 DOM 交棒 → **末幀對位問題整個消失**,FOV/CAM_Z1/CABIN_Z 常數解鎖
- **常駐 WebGL ≠ 常駐 rAF**:場景無時間軸,`render(x)` 捲動才畫。唯二時間項(A1 微晃、滑鼠視差)留在 canvas 的 CSS transform(進現有 sway 層),合成器搬已畫好的幀,WebGL 零重繪

場景構成(theater flat / diorama):近層立柱 z≈-6.5、牆+座椅 z=-8、**窗是牆上真正的洞**、窗外像素 strips 當 `CanvasTexture` 貼 z≈-11/-14 兩層(`NearestFilter`)——**pan 變 `texture.offset.x`,GPU 零成本,A3 視差是天然結果**。月台層 = 窗外 z≈-9.5 第三層。隧道從 CSS overlay 升級成**有深度的掃光**(近層先亮遠層後亮)。燈光曲線(數值 Grade)直接映射場景光,「車外亮於車內」變物理事實。

相機:ride 基本靜止;停站 dwell 內極輕 dolly-in;**exit 相機真實 yaw 轉身一鏡到底接出站門**(取代 CSS rotateY 的平面卡穿幫,E1 投資被吸收)。

分界:WebGL = 車廂視覺全部;DOM = LED/資訊卡/路線圖/控制鍵/Concourse 全部不動(**文字永不進 WebGL** —— 坑 3 升級版)。

**最實在的隱藏成本**:DOM 車廂凍結為 no-WebGL fallback,兩套 ride 視覺並存 —— 建議 fallback 降規格壓同步面。

**前置依賴:audit §4.3 ref 通道重構**(render(x) 直通 onUpdate,不過 React)。

風險:直式手機層深係數要 aspect 插值重調;站切換 crossfade 在材質層重做;拆層接縫在 dolly 下較 L1 易露餡(層深壓 1.5m 內);測試靠 stats + 截圖。預估 <30 calls / <500 tri,dpr 手機 1.5,Adreno 610 級單幀 <8ms。

## §5 L3 · 全 3D 建模 —— 判斷:炫技陷阱

glTF 低模(1–2 萬 tri、烤光、atlas)、相機沿走道推進、「廣告板 = 作品位」。可讀性解法:海報只當 teaser,閱讀交 DOM(或 CSS3DRenderer 備案)。美術分岔:Papercraft 烤手繪(Aimee 前例)vs 像素 3D(RenderPixelatedPass / t3ssel8r)—— 都是「改版」不是「升級」。

**致命題:資產從哪來** —— AI 管線出平面不出模型;image-to-3D 品質不可靠;務實只有 Blender 手工,而使用者管線沒有這個角色。**L1/L2 的資產缺口在管線內,L3 在管線外。**

風險:美術身份重置、受眾錯位(受益者是 Awwwards 評審不是技術主管)、**建模完成前沒有可上線中間態**、內容迭代被資產管線綁死。

**但偷一個構件進 L2:「廣告板 = 作品位」**(牆面層平面海報,不建模)。

## §6 工程橫切面

- **render-on-demand 是憲法**:idle = 0 GPU;fill rate 是瓶頸(L2 overdraw ~3–4×,dpr 1.5 可行);`drawScene` Map 快取原封不動(blit 來源 → texture 來源)。
- **投資保留矩陣**:L2 之下邏輯層(x 的函式)全存活、表現層換場景物件;A1 原樣;E1 吸收強化;Window blit 退役(strip 快取存活)。
- **R3F:不上**(2026-08 再查證:v9 已支援 React 19.0–19.2,舊「鎖版本」結論放寬,但常駐場景前提下更不利 —— 單一場景物件個位數、組合收益趨近零;「標量繞過 React」正是 R3F 會擋路的地方;door3d 手寫模式已驗證)。
- **L1→L2 是搬家,L2→L3 是跳崖** —— L2 是漸進路徑的自然終點。

## §7 案例

- Lempens(3D 巴黎騎行,SOTD):同構;資產全靠本人是 3D 藝術家 = L3 管線缺口對照組
- ZERO:單一標量驅動一切,背書「換渲染後端不換架構」
- **Aimee Papercraft World**:手繪插畫烤上 3D 幾何 —— 「插畫身份 + 真 3D」不互斥的前例
- Henry Heffernan:CSS3DRenderer 活 DOM 進場景(L3 資訊卡技術備案)
- Bruno Simon:天花板兼警世牌(玩具優先、內容其次,與本站哲學相反)
- **pixel × 3D 成立**(t3ssel8r / RenderPixelatedPass);本案 door 場景已在混用。紅線一條:**像素素材不能吃透視收斂**,窗景平面要正對相機(L2 構圖本來就是)

## §8 建議路線圖

**總判斷:L2 是甜蜜點,L3 是炫技陷阱,L1 是 L2 的首期工程。**
前提聲明:`<h1>`/SSR 與專案 links(audit #2/#3)拿面試的效率仍高於任何 3D,建議與階段 0/1 並行。

| 階段 | 內容 | 工時 | 交付物(可上線) |
|---|---|---|---|
| 0 | audit §4.3 ref 通道重構 | M | 動態全面順跑,一切的地基 |
| 1 = L1 | cabin inpaint 拆層 + 層視差 + A3 窗景深度層 | M | 2.5D 立體感升級;素材即 L2 備料 |
| 2 = L2a | 門場景吞下 ride(relief 層/窗景 CanvasTexture/月台隧道入景/Grade 轉場景光;DOM 車廂凍結為 fallback) | L | 統一場景上線,對位常數解鎖 |
| 3 = L2b | exit 入景:相機真實轉身一鏡到底,刪 CSS rotateY | M | 全旅程單場景 |
| 4(選) | 牆面海報位 = 作品 teaser(L3 唯一值得偷的構件) | M | 「UI 長在車廂上」字面化 |
| ✗ | L3 全建模 | XL | 不建議;重啟條件:目標改為站點獎 + 取得 Blender 產能 |

每階段可交付、停在任何一階前面投資不作廢。階段 0+1 可直接寫 spec(拆層驗收標準與視差/過掃描數字已在 §3 給到規格粒度)。

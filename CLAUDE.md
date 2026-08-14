# CLAUDE.md

給在這個 repo 工作的 Claude。設計規範另見 [DESIGN.md](./DESIGN.md)，設計稽核報告見 [docs/design-audit-2026-07.md](./docs/design-audit-2026-07.md)。

## 這是什麼

蔡守傑 NoopyCai 的個人作品集。台鐵 EMU900「夜車・區間」主題，捲動驅動的單頁互動：整頁被 GSAP pin 住，scroll progress `0 → 1` 分三個相位，六站一路開到終點，最後起身轉身走進出站大廳。

觀眾是台灣的技術主管與 recruiter。**內容 > 視覺**：一張推薦系統的架構圖比任何視覺調整都更能拿到面試。

## 指令

```bash
npm run dev     # localhost:3000（也綁 0.0.0.0，手機可連區網 IP）
npm run build   # 產品建置
npm test        # vitest run（25 tests）
npx tsc --noEmit
```

**⚠️ 不要在 `next dev` 開著的時候跑 `npm run build`。** build 會蓋掉 dev 的 `.next`，導致 `main-app.js` / `polyfills.js` 全部 404 → 頁面完全不 hydrate（畫面看起來正常但按鈕點了沒反應，而且很難聯想到是這個原因）。正確順序：

```bash
kill $(lsof -ti:3000 -sTCP:LISTEN) && npm run build && rm -rf .next && npm run dev
```

## 技術棧

Next.js 15 App Router · React 19 · GSAP ScrollTrigger · lucide-react · three.js（**只有車門過場用，而且只能透過 `dynamic import()` 進來**，見下方「門過場」）· **純 CSS，沒有 UI framework 也不要加**。全部樣式集中在 `app/globals.css`（單檔，~250 行）。測試是 vitest + jsdom。

## 架構

```
app/page.tsx            相位分派:reduced-motion → StaticFallback,否則 ScrollJourney
                        Concourse 一律渲染(不要放進 reduced-motion 的 else 分支)
components/
  ScrollJourney.tsx     ★ 核心。ScrollTrigger pin、相位、相機動畫、滑鼠視差、跳站
  Door3D.tsx            車門開啟過場的 React 殼(canvas + dynamic import three + 餵 progress)
  door3d/scene.ts       ★ 過場的 three.js 場景(純函式,非 React;一個 render(doorP) 畫一幀)
  door3d/textures.ts    門板 / 月台警戒條 / 光楔 / 門縫光的程序貼圖(canvas,無外部圖檔)
  CabinComposite.tsx    車廂照(back)+ 三扇車窗 + LED + grade + 立柱前景層(front,.cabin-front,
                        節點順序最後 —— 橫杆要從跑馬燈前面掠過,見下方「前景立柱層」)
  Window.tsx            單扇車窗:scene crossfade + 隨捲動水平流動(canvas blit);中央窗拆遠近兩層
  StationPanel.tsx      作品資訊卡(liquid glass)+「看細節」modal
  RouteMap.tsx          右側六站進度點,點擊跳站
  Concourse.tsx         出站大廳(ConcourseHero 由轉場與正式區塊共用,確保交棒無縫)
  StaticFallback.tsx    reduced-motion 的語意化降級版
  Icon.tsx              lucide 薄包裝,語意固定
  SoundToggle.tsx       音軌狀態機(module scope)+ 左上角靜音鍵
lib/
  progress.ts           相位數學 + 車窗/LED 座標(cabin.jpg 實測百分比;換基底必須重量,量法見
                        docs/ai-illustration-prompts.md §E。LED_RECT 是唯一來源:DOM 跑馬燈的
                        定位框與門場景背板「把烤死字塗黑」的矩形共用它)
  scene.ts              ★ 六種窗景的逐像素 canvas 繪製(純函式,無動畫)。`layer: "far" | "near"`
                        把一個場景拆成遠近兩張(A3 深度層);不傳 = 完整版,舊呼叫端不受影響
  frame.ts              捲動連續量的 ref 通道(階段 0):applyFrame 直寫 → 訂閱者寫 DOM,零 re-render
content/stations.ts     六站全部內容(雙語)。改文案只動這裡
public/
  cabin.jpg             ★ 全站的車廂基底(1672×941,150 KB)。2026-08 換成**無立柱**的新版
  cabin/cabin-front.png   立柱+橫杆去背層(1672×941 RGBA,63 KB)。3D 化階段 1 已接進 DOM
                          (CabinComposite 的 front 層,視差係數見下);門場景的背板也會把它
                          合成上去,不然交棒時立柱會憑空淡入
```

### 相位

`lib/progress.ts`：`PHASE = { gateEnd: 0.13, doorEnd: 0.22, rideEnd: 0.8 }`，`TOTAL_LEN = 8200`（`ScrollJourney.tsx`）。

| 相位 | progress | 畫面 |
|---|---|---|
| `gate` | 0 → 0.13 | 「開始乘車 ►」按鈕（0.09 起淡出） |
| （door） | 0.13 → 0.22 | 車門開啟過場：`Door3D` 的 three.js 場景蓋在最上層，車廂已掛載在門後。**不是獨立 phase**（`phaseOf` 回 `ride`），由 `doorProgress` 驅動 |
| `ride` | 0.22 → 0.8 | 車廂 + 六站（`rideProgress` 從 doorEnd 起算，門開完剛好停在第一站） |
| `exit` | 0.8 → 1 | 第一人稱起身 + 轉身，尾段淡出交棒給 Concourse |

門過場是**真的 3D 場景**（`components/Door3D.tsx` + `components/door3d/`）：three.js、一台 `PerspectiveCamera(50°)`、月台在門外、cabin.jpg 貼在門後 `z = -8` 的背板上。門板/車體/月台地面貼的是 `public/door/*.jpg`（使用者以 `docs/ai-illustration-prompts.md` §D 的 prompt 自行 AI 生成，共 518 KB；`textures.ts` 的程序繪製版是載入失敗時的 runtime fallback，**不可刪**）。材質亮度靠 `EXPOSURE` 常數做曝光補償（`color.setScalar`，材質層級）——燈光與 emissive 不動。**換圖後必須重量三個對位數字**（門縫 x、綠帶 v、導盲磚 v）＋ car-body 的標語橫向相位 `CAR_U0`，量法見 prompts 文件 §D。分鏡全部由 `doorP` 插值，**沒有 delta time、沒有常駐 rAF**，所以倒著捲就是倒著關：

| doorP | 這一拍 | 實作 |
|---|---|---|
| 0 → 0.15 | 關門待機，中線門縫漏出一道細光 | `slitMat.opacity`（additive 光柱貼在門板**前面**，擺後面會被門板切成硬邊白線） |
| 0.15 → 0.70 | 兩片門板 3D 滑開（塞拉門：先往車體外浮 0.1 再滑），暖光楔灑上月台地面 | `panelL/R.position`、`wedgeMat.opacity`、`warm`（PointLight，擺在門**外** z=0.45，門板正面朝月台） |
| 0.30 → 0.85 | 相機 dolly-in 穿過門框（`z 4.2 → -1.2`），門柱與門板從兩側掠過＝視差；俯角 -4.5° 在中途回正 | `camera.position.z` / `camera.rotation.x`，`near = 0.05`（不然穿門那幾幀門框會被近平面切掉） |
| 0.85 → 1.0 | 相機定住，canvas CSS opacity 1→0 溶接給 DOM 車廂 | `Door3D` 的 `fade`；相機必須是靜止的，會動的畫面溶接會抖 |

**末幀對位**是這個場景唯一不能妥協的數字：背板每幀重算成「剛好 cover 視錐」的大小（`2·dist·tan(fov/2)`，寬螢幕改由 `aspect / 1.77683` 決定），再乘上 sway 那層常駐的 `1.035`。末幀（`doorP = 1`，相機 `z = -1.2`、俯角 0、`zoom = 1`）算出來就等於 DOM 車廂的 `max(100vw, 177.68vh)` cover 幾何 × 1.035。實測（與 DOM 的 cabin.jpg 逐列/逐行互相關，取拋物線插值的次像素峰值）**位移 dx / dy 都在 0.1px 以內**：2026-08 ② 二次換基底後重測，1920×958 是 dx +0.045 / dy +0.024、直式 390×844 是 dx +0.016 / dy +0.037，相關係數 0.9989–0.9996；同一輪在 Chrome 實機另量一組(視窗 1470×801 與直式 390×801，dpr 2)是 dx +0.019 / dy +0.084 與 dx +0.011 / dy +0.053，相關 0.9988–0.9997（① 那輪是 +0.02/+0.03 與 +0.001/+0.002，同一量級。量法見 prompts §E）。動到 `FOV` / `CAM_Z1` / `CABIN_Z` / `zoom` 任何一個都會破壞這件事。

交棒是 **crossfade 不是硬切**：canvas 畫的是 cabin.jpg 原圖（車窗全黑、LED 是照片裡烤死的字），底下的 DOM 車廂有即時窗景與跑馬燈，最後 15% 讓它從底下漸亮，語意是「上車後設備通電」。門的區間外 canvas 只掛 `.door-canvas-idle`（`display:none`），**元件本身永不卸載**——原因見坑 10。

效能與載入：

- three 只透過 `Door3D` 裡的 **`import("./door3d/scene")`** 進來，是獨立的 async chunk（實測首頁 First Load JS 162 kB，裡面**沒有** three；three 那兩塊 chunk 合計 ~135 kB gzip，只有進門相位前才下載）。預載排在 `requestIdleCallback`（timeout 1200ms），另外在 `doorP > 0` 而場景還沒好時補叫一次 boot——使用者可能比 idle callback 快。
- 拿不到 WebGL、或 chunk 載不下來（離線）：`createDoorScene` 回 `null` / `import` 的 `.catch()`，canvas 保持透明，過場退化成直接看到門後的車廂。**不要給 `.door-canvas` 任何 CSS 底色**，那會讓退化路徑變成一塊蓋住車廂的色塊。
- render-on-demand：只有 `progress` / `active` 變或 `ResizeObserver` 觸發才畫一幀。`setPixelRatio(min(dpr, 2))`、沒有 shadow map、整個場景 **76 個三角形 / 23 draw calls**（末幀只剩 10 / 4，其餘被相機切掉）。`display:none` 期間 `clientWidth = 0`，`render` 直接 return（畫了只會把 buffer 縮成 0）。
- dev 下 `window.__door3d.stats()` 可以讀三角形數、draw calls、`isContextLost()`、相機 z（production 不掛）。

### 前景立柱層(L1 拆層視差)

車廂不再是一張圖：`cabin.jpg`（無立柱的 back）+ `cabin/cabin-front.png`（立柱 ×2 + 頂端橫杆的 alpha 層，1672×941、63 KB，與基底同一格網）。兩張同一組 cover 幾何，front 是 `CabinComposite` 的**最後一個節點**——tint／隧道／窗／LED 全部畫在它底下。

**為什麼是最後：**橫杆（圖上 y 10.5–12.6%，再被 front 自己的 1.024 過掃描往上推）與 LED 顯示區（`LED_RECT` 到 y 10.4%）在螢幕上本來就擦邊，而視差讓 front 垂直多走到 ±23px。舊層序（LED 最後畫）在滑鼠推到右下角時，實測橫杆上緣被 LED 面板吃掉 **17px**——那 17px 讀到的是 `#050805` 的面板底色，而橫杆物理上比牆面顯示器更靠近觀者，深度是反的。改成 front 最後畫之後，同一個取樣帶的亮度 7.1 → 229（靜止）／153（最大視差）＝橫杆確實在跑馬燈前面；跑馬燈的字是垂直居中的，被遮的只有面板下緣的空白帶。

- **視差係數 K = 1.7**（直式降到 1.25，依 aspect 插值），寫在 `ScrollJourney` 的 sway 迴圈裡：front 的螢幕位移 = K × sway 的位移（A1 底噪自動同係數放大）。
- **front 自帶 `scale`**：sway 的 1.035 過掃描蓋不住多走的位移（1440×900 垂直餘裕 15.75px < 需求 22.95px，差 7.2px），所以 front 在螢幕上是 **1.06**＝1.035 × `1.0241546`。**`1.0241546` 有三處必須同步**：`ScrollJourney` 的 `FRONT_SCALE_REL`、`globals.css` 的 `.cabin-front`（第一幀預設值）、`door3d/scene.ts` 的 `FRONT_REL_SCALE`（背板合成）。
- **front 自帶 tint，而且必須用同一張 PNG 當遮罩**：前景排到 LED 之後就吃不到底圖那片 `inset: 0` 的 tint 色片了，所以 `.cabin-front` 是個**容器**，裡面是 img（`grade.filter` 寫在 img 上，不是容器上，見坑 13 的同一個理由）+ 一層 `.cabin-front-tint`（同色同 `GRADE_BLEND`）。**遮罩不是為了省算力而是正確性**：soft-light 混的是「底下已經畫好的東西」，alpha = 0 的地方 backdrop 是透明的 → 沒有遮罩就會直接塗上 tint 原色，變成蓋住整個畫面、疊在底圖 tint 之上的雙重色紗。少了這一層的代價實測過：立柱色相會定住（river 站 R 偏 **+10/255**、city 站 **−9**，ΔE ≈ 6，1× 下讀得出來是「另一種金屬」，而且與車廂壁的暖冷關係在曲線兩端**反向**）；補上之後六站立柱的 RGB 與舊層序差 **≤ 0.4/255**。隧道的 lift/sweep 仍然掃不到立柱（差 ≤ 1.7/255，L2 才有真深度掃光）。
- **門場景的背板要先合成立柱**：背板是 cabin.jpg 原圖，DOM 車廂卻有立柱 → 交棒 crossfade 會變成「柱子憑空淡入」。所以背板貼圖在上傳前用同樣的 1.0241546 把 front 疊上去（順序：cabin → **LED 塗黑 → front**，和 DOM 的節點順序一致——順序反了，交棒就會在橫杆／LED 那條 8px 的縫裡閃一下）。交棒瞬間滑鼠視差與底噪都收斂到 0，所以純縮放就對得上：實測背板與 DOM 立柱的欄剖面互相關 **lag −0.40 / −0.50 px**（1440×900 兩根柱），橫杆的列剖面 **+0.06 px**（直式 +0.03 px；層序修正前是 −0.38/−0.47 與 +0.08/+0.05，同一量級，橫杆的 corr 從 0.982 升到 0.988）。
- **末幀對位重驗**（參考圖同樣合成 front + 塗黑 LED —— 少了 LED 那一步，橫杆上緣被面板蓋住的那一條帶子會讓 corrY 掉到 0.96）：1920×958 `dx +0.042 / dy +0.024`（corr 0.9992 / 0.9996）、1440×900 `dx +0.029 / dy +0.054`、390×844 `dx +0.017 / dy +0.028` —— 與換基底那輪（+0.045/+0.024）同一量級。
- **fallback**：front 載入失敗 → `onError` 把**整個容器**收成 `display: none`（連 tint 那層一起——遮罩用的是同一張圖，圖沒了遮罩也沒了，只留 tint 就是一片色紗），畫面就是無立柱的 back，其餘完全不受影響（門場景那邊也一樣，背板退回原圖）。
- **中央窗的遠近層（A3）**：`drawScene` 的 `layer` 參數把場景拆成 `far`（天空／星／雲／遠山／中景剪影）與 `near`（近景建物／地面／前景物件／**全部地標**），中央窗把兩層畫進同一張 canvas、平移倍率 0.35 / 1.0（左右窗維持單層，那道 7% 寬的窄縫讀不出差速）。月台站不拆（站內場景，而且站名燈牌是地標）。地標一律留在 near 的理由見坑 8。

## 踩過的坑（改動前務必讀）

1. **不要用 GSAP ScrollToPlugin。** 它與 pinned + scrub 的 ScrollTrigger 會回饋成死迴圈而凍結整頁。用 `ScrollJourney.tsx` 裡自己寫的 `smoothScrollTo`（逐幀 `window.scrollTo`，會觸發真實 scroll 事件）。

2. **`scrollRestoration` 必須是 `manual`。** pin 建立前文件只有 ~1916px，之後才被撐到 ~9516px。瀏覽器會在那之前就還原捲動位置 → 被 clamp 到出站大廳頂端 → 重整時先閃一下最下方的區塊。已在 pin 的 effect 裡處理，cleanup 會還原原值。

3. **文字不要放進 sway 層。** 那層常駐 `scale(1.035)`（滑鼠視差 ±15px 的過掃描），加上 `will-change` + `preserve-3d`，瀏覽器會整層先光柵化再 GPU 縮放 → 文字與像素字型被重新取樣而**發糊**。照片和 canvas 放大 3.5% 看不出來，文字看得出來。資訊卡與路線圖必須是 `.camera` 的直接子元素。

4. **`CabinComposite` 的寬度是 `max(100vw, 177.68vh)`，不要加上限。** 177.68 = 1672/941，也就是 cabin.jpg 的比例——**這個數字是全站的紅線，換基底時是圖去遷就它**（2026-08 ① 的基底原生 2730×1536 = 1.77734，重採樣成 2715×1528 = 1.7768324 才上線；② 的重生成版直接就是 1672×941，比例分毫不差、零重採樣。讓比例漂掉就得同步改 `door3d/scene.ts` 的 `CABIN_ASPECT`，而末幀對位會跟著崩）。加了 `min(..., Nvw)` 之類的上限，直式手機就會出現上下留邊。直式滿屏的代價是中央窗的圓角框會被裁到畫面外——這是比例算出來的，不是可以兩全的選擇。

5. **`StationPanel` 的 `transform` 已被淡入的 inline style 佔用。** 要垂直居中請用 `top/bottom: 0` + `height: fit-content` + `margin: auto 0`，不要用 `translateY(-50%)`（inline style 會蓋掉 CSS）。

6. **`--font-led` 沒有 CJK 字符集。** Departure Mono 只有拉丁/數字/符號，中文會掉回系統黑體 → 同一串字雙字型混排。目前是已知缺陷（audit §2.1）。

7. **Departure Mono 是單一字重，永遠不要 `font-weight: 700`。** synthetic bold 會把 bitmap 邊緣往外糊一格、破壞像素網格。要更重就加大字級或用 `text-shadow` 光暈。

8. **`drawScene` 有 module-scope 的 Map 快取**（`Window.tsx`）。它是逐像素迴圈（單張約 108k 次 `fillRect`），key 是 `scene|bg|layer`：一個戶外站最多 4 張（左右窗的完整版、中央窗的 `far`、`near-bg`、`near-full`），月台 2 張，全程走完六站 = 22 張 ≈ 9 MB。**`far` 層永遠不畫地標**，所以它的 `bg` 與 `full` 是同一張（`getScene` 直接把 bg 釘成 true）——地標的「每站出現一次」靠的是 `[bg | full | bg]` 三段長條加上每站一圈的 pan，而 far 只走 0.35 圈。不要繞過快取直接呼叫。

9. **字型、`cabin.jpg`、`cabin/cabin-front.png` 都在 `layout.tsx` 裡 preload。** cabin.jpg 只有進 ride 相位才進 DOM，沒有 preload 的話第一次搭車必然看到 pop-in。它同時是 LCP 候選，所以壓縮預算是 **≤ 500 KB**（現在 150 KB；4:4:4 不要動——圖裡的告示與海報都是小字，色度取樣一減就糊）。**下次換基底請盡量拿到原生 2× 尺寸**：現行 1672×941 在 1920 寬的桌機已經要放大 1.19×（retina 再 ×2），②之前的 2715×1528 版本沒有這個問題。

10. **`Door3D` 不可以條件式掛載，cleanup 也不可以 `loseContext()` / `renderer.dispose()`。** 一個 `<canvas>` 一輩子只有一個 WebGL context（`getContext` 對同一元素永遠回傳同一物件），被 `loseContext()` 殺掉就再也活不過來。舊寫法是「離開門相位就卸載」+ cleanup 呼叫 `loseContext()`，於是上下捲一趟就建/毀一次 context；dev 的 StrictMode 更會 mount→cleanup→mount，第二次拿到的正是剛被殺掉的 context，之後所有 `gl.*` 都是 no-op（實測 `isContextLost() === true`）→ **整頁白屏**，而且 refresh 才會好。現在：永遠掛載、用 `display:none` 收起來、只在真的離開頁面時交給瀏覽器回收，另外掛 `webglcontextlost`/`restored` 做二次保險。

11. **門場景裡的 `emissive` 值要壓得很低（現在 0.16）。** emissive 不吃幾何明暗，值一大就是一塊死平的純色；而 dolly 到中段時相機正好貼著兩根門柱掠過，那兩個側面各佔近 1/10 螢幕 —— 實測 `emissiveIntensity = 0.55` 會變成兩條純 `#ff9a3c` 的橘柱，把整個推軌鏡頭染成橘色。要更亮請加 additive 的光片（像 `wedge` / `slit`），不要調 emissive。

12. **`ScrollJourney` 的開頁 `scrollTo(0, 0)` 用 module-scope 旗標擋住。** effect 在 StrictMode/HMR 下會 re-run，那時使用者可能已經在車廂裡，再歸零一次會把人硬拉回月台（`scrollRestoration = "manual"` 要保留，那個沒問題）。

13. **`cabin.jpg` 與立柱前景層的 grade `filter` 要各套一次，不要包一層 div 一起套。** 包起來省一趟濾鏡（4× throttle 下 p50 反而比階段 0 還快），代價是那一層會先被光柵化成一張圖、再交給 sway 的 `scale(1.035)` 縮放 —— 等於多一次重取樣，實測車廂圖上的小字會軟掉（博愛座海報區的橫向梯度能量 −15%、告示區 −6%）。cabin.jpg 在 1920 寬的桌機本來就要放大 1.19×（坑 9），禁不起再軟一次。這一項是**畫質優先於幀時**的取捨，改動前請先量梯度能量。

## 慣例

- **註解用繁體中文**，寫「為什麼」而不是「做什麼」。既有註解密度不低，跟著寫。
- 樣式一律進 `globals.css` 的 `.sp-*` / `.routemap-*` 等既有 class。**不要在元件裡新增 inline style 排版**（已經從 `StationPanel` 收乾淨過一次）。
- 非破壞性的可讀性/無障礙修正可以直接做；動到構成、燈光曲線、資訊架構的請先問。
- 內容改動只動 `content/stations.ts`，六站的 `zh` / `en` 要同步（英文不要機翻，照同樣邏輯重寫）。
- **`metrics` 欄位只放真的量測值。** 技術名稱（`AES-256`、`OTP`、`RT`）請放 `tags`。目前六站的 metrics 資料都清空了，型別與渲染邏輯留著等真數字。
- 使用者可見的字串**不要用 em-dash（—）**，用 `·`。
- **不要用 emoji。** 介面控制項用 `Icon.tsx`（lucide）；LED 顯示器上的內容用會發光的字元箭頭 `◄ ►`（見 DESIGN.md）。

## 測試

`lib/progress.test.ts`（相位數學）、`lib/scene.test.ts`、`content/stations.test.ts`（含「不得外洩電話/地址」的檢查）、`components/LangProvider.test.tsx`。動到相位常數或 `STATIONS` 結構時要一起更新。

## 已知待辦

完整清單見 `docs/design-audit-2026-07.md`（約 60 項，排序過）。最高優先的四項：

1. ~~**六站燈光曲線**（§3.1 + §3.2）~~ — **已修**：曲線重排成「傍晚出發、天亮到站」（`taipei` 1.5 的正午 → 0.86 的夜間台北 101 點燈、`field` golden hour → 凌晨 blue hour），`Grade` 改數值型別逐幀連續插值、六站 blend 統一 `soft-light`。曲線與規則見 DESIGN.md §1
2. **亮站對比**（§1.2）— 已大幅緩解但未全解：28 個量測點中 < 3:1 的從 12 個降到 5 個（`taipei` 站從「7 項全掛」變成 4 項過 AA）。**剩下的不是 grade 的問題**，是資訊卡壓在 `cabin.jpg` 的淺藍座椅上：`--muted` 在 `city` 1.80:1、`--amber` 在 `sea` 2.06:1。要做 scrim 才會過
3. **SSR HTML 沒有 `<h1>`**，四個作品站的內容爬蟲完全看不到（§1.3）
4. **三個專案零個可驗證連結** — `links` 的型別/CSS/渲染邏輯全寫好了但沒資料（§7.3）

死程式碼：`components/WireCar.tsx`（零 import，已移除的 boot 相位遺留）、根目錄的 `train_background.{png,jpg}`（2MB，未被引用）、`content/i18n.ts` 的 `UI` 物件、`lib/progress.ts` 的 `stationAt()` / `panoramaOffset()`。README 仍在描述已移除的 boot 相位。

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
  Door3D.tsx            three 場景的 React 殼(canvas + dynamic import three + 餵每幀的一包值)
  door3d/scene.ts       ★ 門的 three.js 場景(純函式,非 React;一個 render(doorP, mode, frame) 畫一幀)
  door3d/cabin.ts       ★ **車廂本體的場景層**(L2a):牆(窗區挖洞)+ 立柱 + 窗景遠近層 +
                        月台層 + 隧道;grade / soft-light tint 是自寫 shader(見下方「統一場景」)
  door3d/textures.ts    門板 / 月台警戒條 / 光楔 / 門縫光的程序貼圖(canvas,無外部圖檔)
  CabinFrame.tsx        L2a:疊在 canvas 車廂上的 DOM 層 —— **只有跑馬燈與玻璃反光**
                        (文字永不進 WebGL;A6 反光要跟滑鼠走,留在 CSS 才是零重繪)
  CabinComposite.tsx    ⚠ **no-WebGL 的降級路徑**:車廂照 + 三扇車窗 + LED + grade + 立柱層
  Window.tsx            ⚠ 同上(降級路徑):單扇車窗的 crossfade + 水平流動(canvas blit)
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
  frame.ts              捲動連續量的 ref 通道(階段 0):applyFrame 直寫 → 訂閱者寫 DOM / 場景,零 re-render
  strips.ts             窗景 3× 長條([bg | full | bg])的建置與 drawScene 快取(坑 8)。
                        3D 場景(當 CanvasTexture)與降級的 DOM 車廂(blit)共用同一份
content/stations.ts     六站全部內容(雙語)。改文案只動這裡
public/
  cabin.jpg             ★ 全站的車廂基底(1672×941,150 KB)。2026-08 換成**無立柱**的新版
  cabin/cabin-front.png   立柱+橫杆去背層(1672×941 RGBA,63 KB)。L2a 之後它是**場景裡
                          z=-6.5 的一個平面**(door3d/cabin.ts);降級路徑才走 DOM 的 .cabin-front
```

### 相位

`lib/progress.ts`：`PHASE = { gateEnd: 0.13, doorEnd: 0.22, rideEnd: 0.8 }`，`TOTAL_LEN = 8200`（`ScrollJourney.tsx`）。

| 相位 | progress | 畫面 |
|---|---|---|
| `gate` | 0 → 0.13 | 「開始乘車 ►」按鈕（0.09 起淡出） |
| （door） | 0.13 → 0.22 | 車門開啟過場：`Door3D` 的 three.js 場景。**不是獨立 phase**（`phaseOf` 回 `ride`），由 `doorProgress` 驅動。門後看到的車廂就是同一個場景裡的東西（窗景是活的） |
| `ride` | 0.22 → 0.8 | 車廂 + 六站（`rideProgress` 從 doorEnd 起算，門開完剛好停在第一站）。**canvas 不落幕**：相機停在車廂裡，場景繼續當舞台（L2a） |
| `exit` | 0.8 → 1 | 第一人稱起身 + 轉身，尾段淡出交棒給 Concourse |

門過場是**真的 3D 場景**（`components/Door3D.tsx` + `components/door3d/`）：three.js、一台 `PerspectiveCamera(50°)`、月台在門外、cabin.jpg 貼在門後 `z = -8` 的背板上。門板/車體/月台地面貼的是 `public/door/*.jpg`（使用者以 `docs/ai-illustration-prompts.md` §D 的 prompt 自行 AI 生成，共 518 KB；`textures.ts` 的程序繪製版是載入失敗時的 runtime fallback，**不可刪**）。材質亮度靠 `EXPOSURE` 常數做曝光補償（`color.setScalar`，材質層級）——燈光與 emissive 不動。**換圖後必須重量三個對位數字**（門縫 x、綠帶 v、導盲磚 v）＋ car-body 的標語橫向相位 `CAR_U0`，量法見 prompts 文件 §D。分鏡全部由 `doorP` 插值，**沒有 delta time、沒有常駐 rAF**，所以倒著捲就是倒著關：

| doorP | 這一拍 | 實作 |
|---|---|---|
| 0 → 0.15 | 關門待機，中線門縫漏出一道細光 | `slitMat.opacity`（additive 光柱貼在門板**前面**，擺後面會被門板切成硬邊白線） |
| 0.15 → 0.70 | 兩片門板 3D 滑開（塞拉門：先往車體外浮 0.1 再滑），暖光楔灑上月台地面 | `panelL/R.position`、`wedgeMat.opacity`、`warm`（PointLight，擺在門**外** z=0.45，門板正面朝月台） |
| 0.30 → 0.85 | 相機 dolly-in 穿過門框（`z 4.2 → -1.2`），門柱與門板從兩側掠過＝視差；俯角 -4.5° 在中途回正 | `camera.position.z` / `camera.rotation.x`，`near = 0.05`（不然穿門那幾幀門框會被近平面切掉） |
| 0.85 → 1.0 | 相機定住。**canvas 不再淡出**（L2a）——場景就是車廂；這 15% 只讓 DOM 的跑馬燈與玻璃反光淡入（`.cabin-frame` 的 opacity），語意仍是「上車後設備通電」 | `ScrollJourney` 寫 `frame3d.style.opacity`；相機從 0.85 起靜止，DOM 疊層的 cover 幾何因此與場景完全一致 |

**cover 幾何**：車廂各層每幀重算成「剛好 cover 視錐」的大小（`2·dist·tan(fov/2)`，寬螢幕改由 `aspect / 1.77683` 決定）再乘 `1.035`。那個 1.035 同時出現在三個互相抵消的地方——canvas 元素自己大 3.5%、相機 `zoom = 1/1.035`、cover 乘 1.035——**改一個就要三個一起改**（理由見坑 14 與 `scene.ts` 的 `SWAY` 註解）。任何相機位置下各層在螢幕上都對齊同一格網 = DOM 合成的樣子。

**L2a 之前**這裡有一段「末幀對位」的紅線：doorP 0.85–1.0 讓 canvas 淡出、交棒給 DOM 車廂，兩邊必須像素級重合（歷次實測 dx/dy 都在 0.1px 內）。**那個交棒已經不存在了**——門開完場景就是車廂。實測 doorP 0.99 → 1.00 → 1.01 三幀(把資訊卡/路線圖/DOM 疊層都收掉後)**逐像素完全相同**(diffPx = 0)。`FOV` / `CAM_Z1` / `CABIN_Z` / `zoom` 因此解鎖，但**進站分鏡本身仍然是紅線**(改了就是改構圖)。

門的區間外 canvas 只掛 `.door-canvas-idle`（`display:none`）——只有降級路徑會走到，3D 模式全程都要它。**元件本身永不卸載**，原因見坑 10。

效能與載入：

- three 只透過 `Door3D` 裡的 **`import("./door3d/scene")`** 進來，是獨立的 async chunk（實測首頁 First Load JS 166 kB，與 L1 版同數字，裡面**沒有** three；three 那兩塊 chunk 只有進門相位前才下載）。預載排在 `requestIdleCallback`（timeout 1200ms），另外在 `doorP > 0` 而場景還沒好時補叫一次 boot——使用者可能比 idle callback 快。
- 拿不到 WebGL、或 chunk 載不下來（離線）：`createDoorScene` 回 `null` / `import` 的 `.catch()` → `onStatus(false)` → **掛精簡 DOM 車廂**（見下方「降級路徑」）。**不要給 `.door-canvas` 任何 CSS 底色**，那會讓退化路徑變成一塊蓋住車廂的色塊。
- render-on-demand：只有 `applyFrame`（捲動）／貼圖到貨／`ResizeObserver` 才畫一幀。`setPixelRatio(min(dpr, 2))`、沒有 shadow map。實測 ride 全程 **9–16 draw calls / 18–32 三角形**（預算 <30 / <500），閒置時 `stats().frames` 完全不動 = GPU 零工作。`display:none` 期間 `clientWidth = 0`，`render` 直接 return。
- dev 下 `window.__door3d.stats()` 可以讀三角形數、draw calls、`isContextLost()`、相機 z、貼圖數、以及 `frames`（idle 零 GPU 的證據）（production 不掛）。

### 統一場景(L2a:門場景吞下 ride)

門開完 canvas 不落幕,相機停在車廂裡,**同一個 three 場景繼續當 ride 的舞台**(`door3d/cabin.ts`)。
DOM 只剩「永遠不進 WebGL」的東西。z 由遠到近:

| z | 這一層 | 素材 | 動態 |
|---|---|---|---|
| -14 / -11 | 窗景遠 / 近層 ×3 扇窗 | `lib/strips.ts` 的 3× 長條當 `CanvasTexture`(`NearestFilter`) | pan = `texture.offset.x`(GPU 零成本);兩層倍率 0.35 / 1.0 = A3 差速 |
| -9.5 | 月台層 ×3 | 同上,`platform` 場景 | opacity = `frame.platform`(B2 邏輯原樣) |
| -9 | 隧道壓暗 + 洞口暗帶 ×3 | shader(無貼圖) | `frame.tunnel.dim` / `.band` |
| -8 | 車廂牆(**三個窗區挖成真的洞**) | `cabin.jpg` 程序處理:LED 塗黑 → `WIN` 的圓角矩形 `destination-out` | grade shader |
| -7.5 | 出洞回光 | 純色平面 | `frame.tunnel.flash` |
| -6.5 | 立柱 + 橫杆 | `cabin/cabin-front.png` | 同一個 grade shader,`uLead > 0`(隧道掃光近層先亮) |

- **窗洞是牆自己的 alpha**:壓暗 / 月台 / 窗景全部擺在牆**後面**,洞就是它們的 `overflow: hidden`,圓角自然由牆切。這也是為什麼暗帶掃到窗外不會漏到別扇窗。
- **各層都重算成 cover**(見上方「cover 幾何」):照片不是模型,它必須永遠填滿畫面(坑 4)。代價是 ride 相機靜止時**層與層之間沒有相對視差** —— L1 的立柱滑鼠視差(K = 1.7)在 3D 模式退役,深度改由窗景差速 / 真窗洞 / 隧道掃光的先後承擔。真正的層視差要等階段 2b(相機真的轉身)。
- **grade 是自寫 shader,不是場景燈光**:六站燈光曲線的定義是 CSS 的 `filter: brightness saturate contrast` + 一層 soft-light 的 tint(DESIGN.md §1),映射成 Ambient/Point 等於重調一次曲線。所以 `cabin.ts` 把那三個 filter 函式與 soft-light 的**規格算式**原樣搬進 fragment shader,貼圖走 `NoColorSpace`(取樣拿到的就是 sRGB 值)、輸出不做色彩空間轉換 —— 算式因此和合成器在做的事逐位對應。實測六站 + 隧道的車廂壁 / 座椅 / 海報 / 天花板取樣點,與 L1 的 DOM 版**差 ≤ 2/255**。
- **窗景 pan 走 `texture.offset.x`**:長條上傳一次,每幀只改 uv(舊版是每幀兩次 `drawImage` × 3 扇窗)。`repeat/offset` 同時吃 `objectFit: cover` + `objectPosition` 的取樣框(每扇窗的裁切框是常數,因為窗框的螢幕比例 = `(w/h) × CABIN_ASPECT` 與視窗大小無關)。offset 做**整數對齊**,理由同 blit 版(像素風景不能次像素平移)。同一站的長條 `clone()` 給三扇窗共用 source = 只上傳一次。
- **站切換 crossfade 由 x 驅動**(`XFADE = 0.07`,`ScrollJourney`):A = 離開中的站、B = 進入中的站,`frame.mix` 是 B 疊在 A 上的不透明度。倒著捲就是倒著溶,而且零 re-render(舊版是掛新層 + CSS transition,一次換站 7 次 commit → 現在 5 次)。**代價**:沒有時間軸就沒有「停久了自己收斂」,停在正中間會停在 50/50 的疊影上 —— 所以窗口壓到約 93px 捲動(巡航段最快的一段,兩三格滾輪就過完)。
- **隧道在 shader 裡**(A5 從 CSS overlay 升級):暖光池(舊 `.tunnel-lift` 的橢圓)與掃光帶(舊 `.tunnel-sweep-band` 的 100° 重複漸層)都算在 grade shader 的末段,牆與立柱**共用同一段程式、不同的 `uLead`** —— 立柱早 0.12 個週期亮起來、多吃 12% 的光池,這就是「掃光沿 z 有先後」。L1 那條「lift/sweep 掃不到立柱(差 ≤ 1.7/255)」的缺陷因此結案(實測立柱在洞中亮 +1.2/255,而車廂壁只 +0.14)。
- **DOM 疊層 `CabinFrame`**:只有跑馬燈與玻璃反光(A6 要跟滑鼠走 ±3.5px,搬進場景等於每次滑鼠動就要重畫一幀)。**跑馬燈的面板底色不在 DOM**(`.cabin-frame .led { background: transparent }`)——那塊 `#050805` 是牆貼圖裡塗掉烤死字的矩形;DOM 若自己畫一片不透明面板,就會蓋掉場景裡「橫杆壓在跑馬燈前面」的那 8px,深度又反了(L1 的同一個坑)。疊層在 doorP 0.85→1 淡入(相機從 0.85 起靜止,cover 幾何與場景完全一致)。
- **exit 的交棒**(本階段沿用 CSS 相機):車廂與出站的門是**同一個 canvas**,不能像 DOM 版那樣兩層並存。所以門等 `.camera` 的 opacity 收乾才接手 —— `EXIT_HANDOFF = e 0.72`(= camOpacity 歸零那一點),接手瞬間 `.camera` 的 transform 歸位、`sway` 那層收成 opacity 0(否則跑馬燈會在月台上的門裡復活)。門的淡入因此從 exitDoorP 0.303 起算(舊版 0.18),0.15 內站滿,仍然早於 hero 的 e 0.80。階段 2b 會把整段 exit 收進場景,這個交棒也會消失。

### 降級路徑(no-WebGL,Q3a 降規格凍結)

`createDoorScene` 回 `null`(拿不到 WebGL)或 chunk 載入失敗 → `Door3D` 的 `onStatus(false)` → `ScrollJourney` 掛 `CabinComposite`(**靜默,不顯示任何提示**)。降級版保留內容與識別:車廂 + 立柱層(含 K = 1.7 的視差與 `.cabin-front-tint` 遮罩)+ 三扇單層窗景 + 燈光曲線 + 跑馬燈 + 資訊卡 + 路線圖;**砍掉**隧道(A5)、月台層(B2)、窗景深度層(A3)、門過場(canvas 保持透明 → 直接切換)。兩套 ride 視覺的同步面只剩 cover 幾何常數(`max(100vw, 177.68vh)` 與 `1.0241546`,四處註解互相指向)。

`gl` 有三態:`pending` 期間(場景在 idle callback 才 boot)先掛 DOM 車廂,任何時刻畫面上都有一個車廂;`ok` 之後整組卸載。

L1 的立柱層知識**只剩降級路徑在用**,但數字仍然是唯一來源:
- **`1.0241546`(front 相對於 sway 的放大,螢幕上 1.035 × 1.0241546 = 1.06)有三處必須同步**:`ScrollJourney` 的 `FRONT_SCALE_REL`、`globals.css` 的 `.cabin-front`、`door3d/cabin.ts` 的 `FRONT_REL`(場景版的立柱平面)。
- **front 必須是最後一個節點**(連 LED 都畫在它底下):橫杆(圖上 y 10.5–12.6%)與 LED 顯示區(到 y 10.4%)在螢幕上擦邊,而視差讓 front 垂直多走到 ±23px。舊層序實測橫杆上緣被 LED 面板吃掉 **17px** —— 橫杆物理上比牆面顯示器更靠近觀者,深度不能反。
- **front 自帶 tint,而且必須用同一張 PNG 當遮罩**:排到 LED 之後就吃不到底圖那片 `inset: 0` 的 tint 了。遮罩不是為了省算力而是正確性 —— soft-light 混的是「底下已經畫好的東西」,alpha = 0 的地方 backdrop 是透明的,沒有遮罩就會塗成蓋住整個畫面的雙重色紗(實測少了它立柱色相會定住:river 站 R 偏 +10/255、city 站 −9,ΔE ≈ 6)。
- **fallback 的 fallback**:front 載入失敗 → `onError` 把**整個容器**收掉(連 tint 那層一起),畫面就是無立柱的 back。
- **視差係數 K = 1.7**(直式降到 1.25,依 aspect 插值):front 的螢幕位移 = K × sway 的位移。1440×900 沿用 1.035 的話垂直餘裕只有 15.75px 而需求 22.95px,所以 front 才要自帶 1.06 的過掃描。

## 踩過的坑（改動前務必讀）

1. **不要用 GSAP ScrollToPlugin。** 它與 pinned + scrub 的 ScrollTrigger 會回饋成死迴圈而凍結整頁。用 `ScrollJourney.tsx` 裡自己寫的 `smoothScrollTo`（逐幀 `window.scrollTo`，會觸發真實 scroll 事件）。

2. **`scrollRestoration` 必須是 `manual`。** pin 建立前文件只有 ~1916px，之後才被撐到 ~9516px。瀏覽器會在那之前就還原捲動位置 → 被 clamp 到出站大廳頂端 → 重整時先閃一下最下方的區塊。已在 pin 的 effect 裡處理，cleanup 會還原原值。

3. **文字不要放進 sway 層。** 那層常駐 `scale(1.035)`（滑鼠視差 ±15px 的過掃描），加上 `will-change` + `preserve-3d`，瀏覽器會整層先光柵化再 GPU 縮放 → 文字與像素字型被重新取樣而**發糊**。照片和 canvas 放大 3.5% 看不出來，文字看得出來。資訊卡與路線圖必須是 `.camera` 的直接子元素。

4. **`CabinComposite` 的寬度是 `max(100vw, 177.68vh)`，不要加上限。** 177.68 = 1672/941，也就是 cabin.jpg 的比例——**這個數字是全站的紅線，換基底時是圖去遷就它**（2026-08 ① 的基底原生 2730×1536 = 1.77734，重採樣成 2715×1528 = 1.7768324 才上線；② 的重生成版直接就是 1672×941，比例分毫不差、零重採樣。讓比例漂掉就得同步改 `door3d/scene.ts` 的 `CABIN_ASPECT`，而末幀對位會跟著崩）。加了 `min(..., Nvw)` 之類的上限，直式手機就會出現上下留邊。直式滿屏的代價是中央窗的圓角框會被裁到畫面外——這是比例算出來的，不是可以兩全的選擇。

5. **`StationPanel` 的 `transform` 已被淡入的 inline style 佔用。** 要垂直居中請用 `top/bottom: 0` + `height: fit-content` + `margin: auto 0`，不要用 `translateY(-50%)`（inline style 會蓋掉 CSS）。

6. **`--font-led` 沒有 CJK 字符集。** Departure Mono 只有拉丁/數字/符號，中文會掉回系統黑體 → 同一串字雙字型混排。目前是已知缺陷（audit §2.1）。

7. **Departure Mono 是單一字重，永遠不要 `font-weight: 700`。** synthetic bold 會把 bitmap 邊緣往外糊一格、破壞像素網格。要更重就加大字級或用 `text-shadow` 光暈。

8. **`drawScene` 有 module-scope 的 Map 快取**（`lib/strips.ts`，L2a 從 `Window.tsx` 搬出來給 3D 場景與降級路徑共用）。它是逐像素迴圈（單張約 108k 次 `fillRect`），key 是 `scene|bg|layer`：一個戶外站最多 4 張（左右窗的完整版、中央窗的 `far`、`near-bg`、`near-full`），月台 2 張，全程走完六站 = 22 張 ≈ 9 MB。**`far` 層永遠不畫地標**，所以它的 `bg` 與 `full` 是同一張（`getScene` 直接把 bg 釘成 true）——地標的「每站出現一次」靠的是 `[bg | full | bg]` 三段長條加上每站一圈的 pan，而 far 只走 0.35 圈。不要繞過快取直接呼叫。

9. **字型、`cabin.jpg`、`cabin/cabin-front.png` 都在 `layout.tsx` 裡 preload。** cabin.jpg 只有進 ride 相位才進 DOM，沒有 preload 的話第一次搭車必然看到 pop-in。**場景端這兩張要用原生 `new Image()` 讀，不要用 three 的 `TextureLoader`**：後者預設帶 `crossOrigin = "anonymous"`，和沒有 crossorigin 的 preload credentials mode 對不上，瀏覽器會整張再下載一次（實測 cabin-front 被抓兩次）。它同時是 LCP 候選，所以壓縮預算是 **≤ 500 KB**（現在 150 KB；4:4:4 不要動——圖裡的告示與海報都是小字，色度取樣一減就糊）。**下次換基底請盡量拿到原生 2× 尺寸**：現行 1672×941 在 1920 寬的桌機已經要放大 1.19×（retina 再 ×2），②之前的 2715×1528 版本沒有這個問題。

10. **`Door3D` 不可以條件式掛載，cleanup 也不可以 `loseContext()` / `renderer.dispose()`。** 一個 `<canvas>` 一輩子只有一個 WebGL context（`getContext` 對同一元素永遠回傳同一物件），被 `loseContext()` 殺掉就再也活不過來。舊寫法是「離開門相位就卸載」+ cleanup 呼叫 `loseContext()`，於是上下捲一趟就建/毀一次 context；dev 的 StrictMode 更會 mount→cleanup→mount，第二次拿到的正是剛被殺掉的 context，之後所有 `gl.*` 都是 no-op（實測 `isContextLost() === true`）→ **整頁白屏**，而且 refresh 才會好。現在：永遠掛載、用 `display:none` 收起來、只在真的離開頁面時交給瀏覽器回收，另外掛 `webglcontextlost`/`restored` 做二次保險。

11. **門場景裡的 `emissive` 值要壓得很低（現在 0.16）。** emissive 不吃幾何明暗，值一大就是一塊死平的純色；而 dolly 到中段時相機正好貼著兩根門柱掠過，那兩個側面各佔近 1/10 螢幕 —— 實測 `emissiveIntensity = 0.55` 會變成兩條純 `#ff9a3c` 的橘柱，把整個推軌鏡頭染成橘色。要更亮請加 additive 的光片（像 `wedge` / `slit`），不要調 emissive。

12. **`ScrollJourney` 的開頁 `scrollTo(0, 0)` 用 module-scope 旗標擋住。** effect 在 StrictMode/HMR 下會 re-run，那時使用者可能已經在車廂裡，再歸零一次會把人硬拉回月台（`scrollRestoration = "manual"` 要保留，那個沒問題）。

13. **（降級路徑）`cabin.jpg` 與立柱前景層的 grade `filter` 要各套一次，不要包一層 div 一起套。** 包起來省一趟濾鏡（4× throttle 下 p50 反而比階段 0 還快），代價是那一層會先被光柵化成一張圖、再交給 sway 的 `scale(1.035)` 縮放 —— 等於多一次重取樣，實測車廂圖上的小字會軟掉（博愛座海報區的橫向梯度能量 −15%、告示區 −6%）。cabin.jpg 在 1920 寬的桌機本來就要放大 1.19×（坑 9），禁不起再軟一次。這一項是**畫質優先於幀時**的取捨，改動前請先量梯度能量。

14. **3D 場景的 canvas 不可以吃 sway 那層的 `scale(1.035)`。** 同一個坑的 WebGL 版：canvas 是一張已經光柵化的點陣圖，交給合成器縮放就是多一次雙線性重取樣 —— 實測(1440×900、dpr 1)車廂上的小字橫向梯度能量掉 **12.6%**(告示區)/ **7.1%**(海報區),正是坑 13 拒絕過的量級。DOM 的 `<img>` 沒這問題(瀏覽器會直接用最終尺寸光柵化原圖)。
    正解是**過掃描留在元素上**:`.cabin-canvas` 用 `inset: -1.75%` 讓盒子自己大 3.5%,sway 迴圈只寫位移與旋轉(沒有 scale),相機 `zoom = 1/1.035` 把視野等比放大回來 —— 三者互相抵消,門過場在螢幕上一個像素都沒變(實測 profile 互相關 scale 0.9995–1.0000、位移 ≤ 0.25px),而小字反而比 DOM 版更銳(海報 +2.7%、告示 +2.3%)。改這三個數字之一就要三個一起改。

15. **`Window.tsx` 的 crossfade 舊層移除計時器要掛在 `layers.length` 上,不能掛在 `layers` 上。** raf 把 `on` 改成 true → `layers` 換新陣列 → effect 重跑 → cleanup 先把計時器清掉,而重跑時已經沒有 pending 就直接 return —— 舊層於是永遠留在 DOM。實測 L1 版(當時這還是主路徑)走完六站累積 **17 張 canvas**,每一張的 `useFrame` 每幀都還在 blit。`length` 不會被 `on` 的翻面改動,所以計時器活得下來(修正後穩定在 3 張 + 門的 canvas)。

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

// 車門過場的 three.js 場景。**非 React**:純函式建場景 + 一個 render(doorP)。
//
// 這整個模組(連同 three 本身)只透過 components/Door3D.tsx 的 dynamic import() 進來,
// 所以 three 會被打成獨立的 async chunk,首頁的 First Load JS 不會因此變大。
//
// 沒有常駐 rAF:過場是捲動驅動的,render 只在 progress 或尺寸改變時被叫一次。
// 這也是「倒著捲門就倒著關」為什麼是免費的 —— 場景沒有自己的時間軸,doorP 就是時間。

import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  Fog,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  Texture,
  TextureLoader,
  WebGLRenderer,
} from "three";
import {
  getFloorCanvas,
  getPanelCanvas,
  getSlitCanvas,
  getStripCanvas,
  getWallCanvas,
  getWedgeCanvas,
} from "./textures";

// ── 尺度 ─────────────────────────────────────────────────────────────────────
// 一個世界單位大約是「一公尺」。眼睛在原點,月台地面在 y = -1.0(視高一米,
// 略低於真人 —— 這樣 50° 的垂直視角才吃得到門前那片地,光灑地的招牌鏡頭才看得見)。
const FOV = 50;
const FLOOR_Y = -1.0;
const DOOR_TOP = 1.5;              // 門洞上緣
const DOOR_HALF = 1.0;             // 門洞半寬(整個門洞 2 米,兩片對開)
const PANEL_W = 1.01;              // 單片門板寬:比半個門洞多 0.01,關起來時壓住門柱不露縫
const PANEL_T = 0.07;              // 門板厚度(BoxGeometry,側面才有厚度感)
const SEAM = 0.01;                 // 關門時中線留的縫:門縫光就是從這裡漏出來的
const PANEL_OPEN_X = 1.05;         // 開門時單片門板往外滑的距離
const PANEL_OPEN_Z = 0.10;         // 塞拉門(plug door):先往外浮出一點再沿車體外側滑開。
                                   // 不是往車體內縮 —— 縮進去會被牆面遮住,整段滑行就白做了。
const CAM_Z0 = 4.2;                // 起始機位:門前 4.2 米
const CAM_Z1 = -1.2;               // 末幀機位:已經穿過門面(z=0)進到車廂側
const CABIN_Z = -8;                // 車廂背板的世界座標(實際大小每幀重算,見下方 cover)
const PITCH0 = -4.5 * (Math.PI / 180); // 起始俯角:低頭看月台的光。dolly 到一半就回正

// cabin.jpg 的原始比例。DOM 車廂用 width:max(100vw,177.68vh) 做 cover,
// sway 層再常駐 scale(1.035) —— 末幀要像素級對位就得把這兩件事一起複製過來。
const CABIN_ASPECT = 1672 / 941;
const SWAY = 1.035;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type DoorScene = {
  /** 畫一幀。doorP = 0(全閉)→ 1(全開,已經站在車廂裡) */
  render(doorP: number): void;
  /** 除錯用:回報三角形數與 context 狀態 */
  stats(): { triangles: number; calls: number; contextLost: boolean; camZ: number };
};

/**
 * 建立場景。onReady 會在 cabin.jpg 解碼完成後被叫一次(要求外層補畫一幀)。
 * 回傳 null = 這台機器開不出 WebGL,外層讓 canvas 保持透明即可。
 */
export function createDoorScene(canvas: HTMLCanvasElement, onReady: () => void): DoorScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null; // 沒有 WebGL:canvas 維持透明,門相位直接看到底下的車廂
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // 上限 2:再高只是燒 GPU
  renderer.setClearColor(0x04060a, 1); // 深夜的天空色。不是純黑,純黑會讓 fog 的邊界看得出來

  const scene = new Scene();
  scene.fog = new Fog(0x05070a, 4, 18); // 夜深感:遠處自然沉進黑裡,不用畫背景

  const camera = new PerspectiveCamera(FOV, 1, 0.05, 60);
  camera.position.set(0, 0, CAM_Z0);
  // near 0.05:相機會直接穿過門面,門框從兩側掠過時不能被近平面切掉

  // ── 貼圖 ───────────────────────────────────────────────────────────────────
  // 全部走 LinearFilter + mipmap:門板已經不是像素風(見 textures.ts 開頭),
  // NEAREST 會把 painterly 的柔漸層放大成硬邊色階,正好毀掉這次改版的目的。
  // anisotropy 是給月台地面用的 —— 那片地在起始機位是接近水平的斜視角,
  // 沒有各向異性過濾的話遠端磁磚縫會糊成一片灰。
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const softTex = (c: HTMLCanvasElement) => {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace; // 少了這行整個場景會偏亮偏灰(three 預設 linear 工作空間)
    t.magFilter = LinearFilter;
    t.minFilter = LinearMipmapLinearFilter; // 縮小走 mipmap,不然遠處門板會閃爍
    t.anisotropy = Math.min(8, maxAniso);
    return t;
  };
  const glowTex = (c: HTMLCanvasElement) => {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  };

  // ── 外部素材(public/door/*.jpg)───────────────────────────────────────────
  // 三張圖是使用者用 docs/ai-illustration-prompts.md 的 prompt 自行生成的
  // (原始 PNG 已轉成 JPEG q82,視覺無差、1.18 MB → 434 KB),沒有外部授權問題。
  //
  // 上面那些程序貼圖**不是暫時的鷹架**:它們是預設值,也是永久的 fallback ——
  // 圖檔 404、離線、解碼失敗,過場都只是留在 painterly 版本上,不會少一塊或變白。
  // 所以這裡是「先掛程序貼圖 → 照片到了才換上去」,不是「等照片」。
  //
  // 三張照片都是「已經打好光」的素材,而這個場景的環境光只有 0.25–0.48(冷藍夜色),
  // 兩者相乘會把整面車體壓成一塊黑。`material.color` 在這裡的角色就是**曝光係數**:
  // 不是調燈(坑 11:燈光常數不碰),而是把素材自己的曝光校正到場景的曝光上。
  // 用 setScalar 寫的是 linear 工作空間的值,>1 合法(把暗部提起來,亮部才會開始截頂)。
  // 校準基準:門板要和門後 cabin.jpg 的車廂牆面(sRGB ≈ 0.17)落在同一個亮度層級。
  const EXPOSURE = { door: 1.55, wall: 0.72, floor: 0.55 };

  const loader = new TextureLoader();
  const photo = (url: string, use: (t: Texture) => void) => {
    loader.load(
      url,
      (t) => {
        t.colorSpace = SRGBColorSpace; // 不設會整片發灰(three 預設 linear 工作空間)
        t.magFilter = LinearFilter;
        t.minFilter = LinearMipmapLinearFilter;
        t.anisotropy = Math.min(4, maxAniso);
        use(t);
        onReady(); // 非同步到貨,要求外層補畫一幀
      },
      undefined,
      () => {}, // onError 刻意留空 = 留在程序貼圖上。不給這個 three 會往 console 噴錯
    );
  };

  const panelTexL = softTex(getPanelCanvas());
  // 右片門是左片的鏡射:同一張 canvas 再包一個 texture,repeat.x = -1 就好,不用重畫。
  // wrapS 維持預設的 ClampToEdge(不要改 RepeatWrapping):uv 反轉後仍落在 [0,1],
  // clamp 讓邊緣的雙線性取樣停在最外一列,不會 wrap 到門板另一側 —— 換成 linear
  // 取樣之後這件事才有影響,NEAREST 時代看不出來。
  const panelTexR = softTex(getPanelCanvas());
  panelTexR.repeat.x = -1;
  panelTexR.offset.x = 1;

  // ── 車體牆面(門洞的三塊:左柱、右柱、上楣)────────────────────────────────
  // 沒有真的挖洞:三塊平面圍出門洞就夠,而且省下 CSG 的一切麻煩。
  // 牆要夠大 —— 21:9 的螢幕在起始機位看得到 ±4.7,所以拉到 ±7。
  const wallTex = softTex(getWallCanvas());
  wallTex.wrapS = wallTex.wrapT = RepeatWrapping;
  const wallMat = new MeshLambertMaterial({ color: 0x14181a, map: wallTex });
  const WALL_TOP = 4.2, WALL_BOTTOM = FLOOR_Y - 0.05; // 比地面低 0.05:接縫處不會露出背景
  // 一張 car-body 貼圖代表的實際尺寸(米見方)。取 = 牆高,綠飾帶(貼圖 v 0.301–0.421,
  // 實測)就落在世界 y 0.53–1.16 —— 剛好在門洞上緣(1.5)底下,和 EMU900 的腰帶位置相符。
  const CAR_TILE = WALL_TOP - WALL_BOTTOM;
  // UV 走**世界座標**而不是 texture.repeat:三塊牆尺寸不同,repeat 是材質層級的,
  // 三塊共用一個材質就只能共用一組 repeat → 上楣的紋理密度會和側牆對不上,
  // 綠飾帶更會在門洞左右斷成三截。改成每塊牆自己把 uv 換算成世界座標,
  // 一份貼圖、一個材質、一次上傳,綠帶自然連成一條直線。
  const wallPiece = (w: number, h: number, x: number, y: number) => {
    const geo = new PlaneGeometry(w, h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const wx = x + (uv.getX(i) - 0.5) * w;
      const wy = y + (uv.getY(i) - 0.5) * h;
      uv.setXY(i, wx / CAR_TILE, (wy - WALL_BOTTOM) / CAR_TILE);
    }
    uv.needsUpdate = true;
    const m = new Mesh(geo, wallMat);
    m.position.set(x, y, 0);
    scene.add(m);
    return m;
  };
  wallPiece(6, WALL_TOP - WALL_BOTTOM, -DOOR_HALF - 3, (WALL_TOP + WALL_BOTTOM) / 2);
  wallPiece(6, WALL_TOP - WALL_BOTTOM, DOOR_HALF + 3, (WALL_TOP + WALL_BOTTOM) / 2);
  wallPiece(DOOR_HALF * 2, WALL_TOP - DOOR_TOP, 0, (WALL_TOP + DOOR_TOP) / 2);

  photo("/door/car-body.jpg", (t) => {
    t.wrapS = t.wrapT = RepeatWrapping;
    wallMat.map = t;
    // 程序貼圖是「平均接近白」的明暗圖,顏色由 color 給;照片自己帶顏色,
    // 所以 color 換成單純的曝光係數 —— 留著 0x14181a 乘下去整面車體就是一塊黑。
    wallMat.color.setScalar(EXPOSURE.wall);
    wallMat.needsUpdate = true;
  });

  // 門柱內側:門洞邊緣的一道亮邊。車內的光溢出來時這裡最先亮(emissive 隨開門度上升)。
  // 位置要**壓在門洞裡面**(|x| < DOOR_HALF、y < DOOR_TOP):牆是一片沒有厚度的平面,
  // 擺在門洞外就會整根被牆遮掉,等於白做;而 z = -0.2 讓它躲在門板後面不互穿。
  const jambMat = new MeshLambertMaterial({ color: 0x1c2124, emissive: new Color(0xff9a3c), emissiveIntensity: 0 });
  const jamb = (x: number) => {
    const m = new Mesh(new BoxGeometry(0.08, DOOR_TOP - FLOOR_Y, 0.3), jambMat);
    m.position.set(x, (DOOR_TOP + FLOOR_Y) / 2, -0.2);
    scene.add(m);
  };
  jamb(-DOOR_HALF + 0.04);
  jamb(DOOR_HALF - 0.04);
  const lintel = new Mesh(new BoxGeometry(DOOR_HALF * 2 - 0.16, 0.08, 0.3), jambMat);
  lintel.position.set(0, DOOR_TOP - 0.04, -0.2);
  scene.add(lintel);

  // ── 月台地面 + 警戒條 ──────────────────────────────────────────────────────
  // 地面貼圖同樣是「平均接近白」的明暗圖(磁磚縫 + 濕氣髒污),color 維持原值。
  // repeat 6 × 3.5 = 一個 tile 4 米見方,裡面剛好四塊一米的地磚。
  const FLOOR_W = 24, FLOOR_D = 14;
  const floorTex = softTex(getFloorCanvas());
  floorTex.wrapS = floorTex.wrapT = RepeatWrapping;
  floorTex.repeat.set(6, 3.5);
  const floorMat = new MeshLambertMaterial({ color: 0x0d1013, map: floorTex });
  const floor = new Mesh(new PlaneGeometry(FLOOR_W, FLOOR_D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR_Y, 7); // 只鋪門前:z 0 → 14,門後是車廂不是月台
  scene.add(floor);

  const stripTex = softTex(getStripCanvas());
  stripTex.wrapS = RepeatWrapping;
  stripTex.repeat.x = 14;
  const strip = new Mesh(new PlaneGeometry(14, 0.34), new MeshLambertMaterial({ map: stripTex }));
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, FLOOR_Y + 0.004, 0.42); // 微微墊高:和地面共平面會 z-fighting
  scene.add(strip);

  // platform-floor.jpg:俯視混凝土 + 一條導盲磚黃帶(實測在貼圖 v 0.450–0.590)。
  // 地板 mesh 轉了 -90°,局部 v 對到世界 z:z = FLOOR_D − FLOOR_D·v(v=1 就是門口)。
  //
  // 橫向可以無限鋪,**縱向不行** —— 一個月台只有一條導盲磚帶,wrapT 一 repeat 就變成
  // 每 4.5 米一條斑馬線。所以 wrapT 維持預設的 ClampToEdge,再用 offset.y 把那條帶子
  // 平移到門前 1.0–1.6 米(正好是暖光楔落地的位置,也是相機起始俯角看得最清楚的地方)。
  const FLOOR_TILE_W = 8, FLOOR_TILE_D = 4.5; // 一張貼圖代表的實際尺寸(米),維持 16:9
  photo("/door/platform-floor.jpg", (t) => {
    t.wrapS = RepeatWrapping;
    t.repeat.set(FLOOR_W / FLOOR_TILE_W, FLOOR_D / FLOOR_TILE_D);
    t.offset.y = -2.299; // 解:0.450 = (1 − 1.63/14)·(14/4.5) + offset
    floorMat.map = t;
    floorMat.color.setScalar(EXPOSURE.floor); // 同 wallMat:照片自帶顏色,color 退回曝光係數
    floorMat.needsUpdate = true;
    strip.visible = false; // 照片自帶導盲磚帶,程序畫的黃帶會變成離譜的第二條線
  });

  // ── 暖光灑地(3D 版的招牌鏡頭:2D shader 做不到的東西)──────────────────────
  // additive 平面貼在地上假掉「光從門口潑出來」。不用 shadow map —— 手機跑不動,
  // 而且真正的陰影在這個構圖裡也看不到什麼。
  const wedgeMat = new MeshBasicMaterial({
    map: glowTex(getWedgeCanvas()),
    color: 0xffb15e,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
    opacity: 0,
  });
  const wedge = new Mesh(new PlaneGeometry(1, 1), wedgeMat);
  wedge.rotation.x = -Math.PI / 2;
  wedge.position.set(0, FLOOR_Y + 0.012, 1.25); // 貼圖 v=1 那側朝門(rotation.x=-90 把局部 +y 轉成世界 -z)
  scene.add(wedge);

  // ── 門縫漏光 ───────────────────────────────────────────────────────────────
  // 擺在門板**前面**(z 比門板大)。擺後面的話光暈會被門板切掉,只剩一條硬邊的白線;
  // 擺前面用 additive 疊上去,才有光從縫裡溢到門板上的感覺。
  const slitMat = new MeshBasicMaterial({
    map: glowTex(getSlitCanvas()),
    color: 0xffc074,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
    opacity: 0,
  });
  const slit = new Mesh(new PlaneGeometry(0.26, DOOR_TOP - FLOOR_Y), slitMat);
  slit.position.set(0, (DOOR_TOP + FLOOR_Y) / 2, PANEL_T / 2 + 0.02);
  scene.add(slit);

  // ── 門板 ───────────────────────────────────────────────────────────────────
  // 薄 BoxGeometry:相機掠過時看得到側面的厚度,一片平面就穿幫了。
  // 六面的材質陣列順序是 [+x, -x, +y, -y, +z, -z],只有 +z(正面)貼門板圖。
  const edgeMat = new MeshLambertMaterial({ color: 0x1a1f1a });
  const panelGeo = new BoxGeometry(PANEL_W, DOOR_TOP - FLOOR_Y, PANEL_T);
  const faceMatL = new MeshLambertMaterial({ map: panelTexL });
  const faceMatR = new MeshLambertMaterial({ map: panelTexR });
  const makePanel = (face: MeshLambertMaterial) => {
    const m = new Mesh(panelGeo, [edgeMat, edgeMat, edgeMat, edgeMat, face, edgeMat]);
    m.position.y = (DOOR_TOP + FLOOR_Y) / 2;
    scene.add(m);
    return m;
  };
  const panelL = makePanel(faceMatL);
  const panelR = makePanel(faceMatR);
  const panelClosedX = SEAM + PANEL_W / 2;

  // door-closed.jpg 一張含兩片門,從中線切半:左片吃 u 0–0.5、右片 0.5–1。
  // 實測(sharp 逐行取最暗直行)門縫在 1254px 寬的 x = 626,距正中只差 1px = 0.0008 uv,
  // 不需要校正常數;將來換圖若偏移變大,調 SEAM_U 就好。
  // clone() 在 three r151+ 共用同一個 Source,所以兩個 Texture 只上傳一次 image。
  // ⚠️ 半張圖是 627×1254(1:2),門板 mesh 是 1.01×2.5(1:2.475)—— 縱向會被拉長約
  // 24%(車窗因此比原圖再高一點)。要修就得動 PANEL_W / DOOR_TOP,那是門洞構圖,
  // 不在這次的範圍內;程序貼圖版本本來就活在同一個比例下。
  const SEAM_U = 0;
  photo("/door/door-closed.jpg", (t) => {
    t.repeat.x = 0.5;
    t.offset.x = SEAM_U;
    const right = t.clone();
    right.offset.x = 0.5 + SEAM_U;
    right.needsUpdate = true;
    faceMatL.map = t;
    faceMatR.map = right;
    faceMatL.color.setScalar(EXPOSURE.door);
    faceMatR.color.setScalar(EXPOSURE.door);
    faceMatL.needsUpdate = true;
    faceMatR.needsUpdate = true;
  });

  // ── 車廂背板 ───────────────────────────────────────────────────────────────
  // 尺寸不是固定的:每幀依當時的相機距離重算成「剛好 cover 視錐」的大小(見 render)。
  // 這樣任何視窗比例下、任何一幀,門後看到的都一定是滿版的車廂,不會露出背板外的黑邊;
  // 而末幀的 cover 幾何就等於 DOM 車廂的 max(100vw,177.68vh) × 1.035。
  const cabinMat = new MeshBasicMaterial({
    color: 0x0a0d0f, // 貼圖載好前先用暗色:預設白色會在門縫裡閃一下白
    fog: false,      // 背板絕不能吃霧 —— 吃了顏色就和 DOM 車廂對不上,交棒會看到色差
  });
  const cabin = new Mesh(new PlaneGeometry(1, 1), cabinMat);
  cabin.position.z = CABIN_Z;
  scene.add(cabin);

  loader.load("/cabin.jpg", (tex) => {
    tex.colorSpace = SRGBColorSpace;
    cabinMat.map = tex;
    cabinMat.color.set(0xffffff);
    cabinMat.needsUpdate = true;
    onReady();
  });

  // ── 燈光 ───────────────────────────────────────────────────────────────────
  scene.add(new AmbientLight(0x37506b, 1.15)); // 夜的冷調環境光(月台燈的漫射)
  // 暖光點光源擺在門**外**一點:門板正面是朝著月台的,光源擺車內照不到它。
  // 語意上就是「車內的光潑出門口」,強度隨開門度上升。
  const warm = new PointLight(0xffa94d, 0, 9, 2);
  warm.position.set(0, 0.55, 0.45);
  scene.add(warm);

  // ── 每幀 ───────────────────────────────────────────────────────────────────
  let lastP = 0;
  let cw = 0, ch = 0;

  const render = (doorP: number) => {
    lastP = doorP;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return; // display:none 期間 clientWidth = 0,畫了只會把 buffer 縮成 0
    if (w !== cw || h !== ch) {
      cw = w; ch = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
    }
    const p = clamp01(doorP);

    // 四拍時間軸。全部由 doorP 插值,沒有任何 delta time。
    const open = easeOut(clamp01((p - 0.15) / 0.55));  // 0.15–0.70 開門
    const dolly = smooth(clamp01((p - 0.30) / 0.55));  // 0.30–0.85 推軌;0.85 後定住讓 CSS 交棒
    const seamGlow = smooth(clamp01(p / 0.15));        // 0–0.15 門縫光漸亮(關門待機)

    // 拍 2:門板往外滑 + 塞拉門先浮出車體外側
    const plug = easeOut(clamp01(open / 0.25)); // 前四分之一先完成「浮出」,之後才是滑行
    const dx = open * PANEL_OPEN_X;
    const dz = plug * PANEL_OPEN_Z;
    panelL.position.set(-panelClosedX - dx, panelL.position.y, dz);
    panelR.position.set(panelClosedX + dx, panelR.position.y, dz);

    // 門縫光:關門待機時漸亮,門一開就沒有「縫」了,交給光楔和點光源接手
    slitMat.opacity = (0.22 + 0.78 * seamGlow) * (1 - easeOut(clamp01(open / 0.35)));
    slit.position.z = PANEL_T / 2 + 0.02 + dz;

    // 拍 2:暖光灑地。寬度與亮度都隨開門度長出來
    wedgeMat.opacity = 0.9 * open;
    wedge.scale.set(1.9 + 1.5 * open, 2.5, 1);
    warm.intensity = 11 * open;
    // 門框內側只要一道「被車內光舔到」的暖邊。emissive 不吃幾何明暗,值一大就是死平的
    // 色塊 —— 而 dolly 到中段時相機正好貼著門柱掠過,那兩根柱子的側面各佔近 1/10 螢幕
    // (實測 0.55 是兩條純 #ff9a3c 的橘柱,把整個推軌鏡頭壓成橘色)。所以壓到 0.16,
    // 並且隨 dolly 收掉:人已經進車廂,門框在身後就不該再發光。
    jambMat.emissiveIntensity = 0.16 * open * (1 - smooth(clamp01(dolly / 0.7)));

    // 拍 3:dolly-in。相機沿 Z 前推穿過門框,俯角在中途回正(末幀必須是 0,否則背板對不上)
    camera.position.z = lerp(CAM_Z0, CAM_Z1, dolly);
    camera.rotation.x = PITCH0 * (1 - smooth(clamp01((p - 0.1) / 0.55)));
    camera.updateProjectionMatrix();

    // 車廂背板:每幀重算成 cover 尺寸。
    //   視錐在背板距離上的高度 = 2·dist·tan(fov/2);要 cover 就得再乘上
    //   max(1, aspect/CABIN_ASPECT)(寬螢幕改由寬度決定),最後乘 sway 的 1.035。
    //   zoom 讓早期的背板稍微放大一點(車廂由深處「落定」),收斂到 1 時就是 DOM 的幾何。
    const dist = camera.position.z - CABIN_Z;
    const halfFov = (FOV * Math.PI) / 360;
    const pitch = Math.abs(camera.rotation.x);
    // 俯角期間視錐是斜的,用 tan(fov/2 + |pitch|) 取一個略大的保守值,免得背板上緣露空
    const frustumH = 2 * dist * Math.tan(halfFov + pitch);
    const zoom = 1 + 0.24 * (1 - dolly);
    const ph = frustumH * Math.max(1, camera.aspect / CABIN_ASPECT) * SWAY * zoom;
    cabin.scale.set(ph * CABIN_ASPECT, ph, 1);
    cabin.position.y = dist * Math.tan(camera.rotation.x); // 背板跟著視線中心,俯角歸零時回到 y=0

    renderer.render(scene, camera);
  };

  // 尺寸變化才重畫一幀(沒有常駐 rAF,resize 時沒人會幫我們補畫)
  const ro = new ResizeObserver(() => render(lastP));
  ro.observe(canvas);

  // context 真的被 GPU 收走時(顯卡驅動重啟、分頁長期背景化)的保險。
  // preventDefault 才會讓瀏覽器嘗試補發 restored;three 的資源在 restore 後會自動重上傳。
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => render(lastP));
  // 這裡刻意沒有 dispose():元件一輩子只掛載一次(見 CLAUDE.md 坑 10),
  // 真的走到卸載就是離開頁面,context 交給瀏覽器回收就好。

  return {
    render,
    stats: () => ({
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      contextLost: renderer.getContext().isContextLost(),
      camZ: camera.position.z,
    }),
  };
}

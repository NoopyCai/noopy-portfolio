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
  Vector3,
  WebGLRenderer,
} from "three";
import type { Frame } from "@/lib/frame";
import { exitDoorAt } from "@/lib/progress";
import { FRONT_REL, Z_FRONT, createCabin } from "./cabin";
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

// cabin.jpg 的原始比例。車廂用 width:max(100vw,177.68vh) 做 cover,再常駐一層
// scale(1.035) 的過掃描(sway,讓 ±15px 的滑鼠視差不露邊)。
//
// L2a 之後這裡有**兩個不同的過掃描**,不要混在一起:
//   · SWAY = 1.035:DOM sway 層的 scale,也就是車廂在螢幕上該有的大小 —— cover 的 ph
//     乘的是這個(乘完就等於 DOM 車廂的 max(100vw, 177.68vh) × 1.035)。
//   · CANVAS_OVER = 1.055:canvas **元素自己**比舞台大的比例(globals.css 的
//     .cabin-canvas 用 inset: -2.75%)。過掃描留在元素上而不是讓 sway 的 scale 去縮放
//     canvas —— 縮放一張已經光柵化的點陣圖 = 多一次重取樣,實測小字梯度能量掉 12.6%
//     (坑 13 / 坑 14)。相機 zoom 補 1/CANVAS_OVER,所以門過場在螢幕上的大小不變,
//     多出來的 5.5% 落在舞台的 overflow: hidden 外面,只是給滑鼠視差的位移用的餘裕。
//   兩個數字各自有對應處要同步:SWAY ↔ sway 迴圈的 scale(1.035);
//   CANVAS_OVER ↔ .cabin-canvas 的 inset(-2.75% × 2 = 5.5%)。
const CABIN_ASPECT = 1672 / 941;
const SWAY = 1.035;
const CANVAS_OVER = 1.055;

const HALF_FOV = (FOV * Math.PI) / 360;

// 出站模式(E1)的構圖:門高佔畫面高的比例。垂直 FOV 固定 → 這個比例與 aspect 無關,
// 直式只會把左右裁掉(cover 思維:寧可門框被裁,不要門變小,見 spec RWD 表)。
// 0.70 是 390×844 直式的定案值;寬螢幕再前推一點,不然兩側空出一大片車體、門會變成
// 畫面正中的一個小方塊。這是「相機距離依 aspect 調整」的全部內容。
const EXIT_FILL_PORTRAIT = 0.70;
const EXIT_FILL_WIDE = 0.82;

// ── 出站分鏡(L2b:一鏡到底)─────────────────────────────────────────────────
// 全部是 e(exitProgress)的區間,沒有時間軸 → 倒著捲就是倒著演(坐回去、門重開)。
//
//   0.00–0.10 窗景層深度塌陷。**相機完全不動**,所以螢幕上一個像素都沒變 ——
//             這 10% 買到的是「之後相機怎麼動,像素窗景都不會吃到透視、也不會從
//             窗洞邊緣露出底色」(紅線:像素平面必須正對相機)。語意上就是 A1 的
//             「停穩」再多停一拍。
//   0.06–0.40 起身:相機升高 RISE_Y,俯角同步補償 PITCH_COMP —— 補償是為了讓**牆**
//             大致定住(疊在上面的 DOM 跑馬燈才有時間淡出而不穿幫),而立柱層(z=-6.5,
//             比牆近 1.5 m)補不回來,那個差就是視差。
//   0.40–0.48 半拍(B4 的節奏常數原樣平移):什麼都不動。
//   0.48–0.66 轉身:相機繞著**牆面上的樞紐**公轉(不是原地 yaw)—— 原地轉頭在數學上
//             零視差(繞眼點的旋轉只是同一組射線的重投影),而公轉是真的橫移,
//             立柱才會相對牆滑動。樞紐選在牆上 = 牆永遠在視野正中,平面佈景不會轉出畫面。
//   0.62–0.72 轉回:yaw 收乾,身體「站直朝門」。
//   0.60–0.82 退出:相機沿 z 穿過門洞退到月台側的出站構圖(fill 0.70/0.82)。
//   0.72–0.96 門關(EXIT_DOOR):相機已經在 z > 0,門板才不會從鏡頭身上掃過去。
const EXIT = {
  collapse: 0.10,
  riseFrom: 0.06, riseTo: 0.40,
  turnFrom: 0.48, turnTo: 0.66,
  backFrom: 0.62, backTo: 0.72,
  outFrom: 0.60, outTo: 0.82,
} as const;
const RISE_Y = 0.40;        // 起身升高(米)。坐姿→站姿的眼高差約 0.6,壓到 0.4 是為了下面那條補償
const PITCH_COMP = 0.85;    // 俯角補償比例:1 = 牆完全定住(起身讀不出來),0 = 牆整片往下滑
// 轉身的 yaw 上限(度)。**這是平面佈景的硬約束,不是美感選擇**:牆是一片 z = -8 的平面,
// 公轉 θ 度時視錐的遠角會掃到牆上 x = R·sinθ − R·cosθ·tan(θ + hfov),而牆的半寬只有
// cover 的 1.035 倍。1440×900(水平半視角 36.7°)實測:θ = 4° 就要開始過掃描,
// θ = 10° 需要 1.02×、θ = 15° 需要 1.13×、θ = 20° 需要 1.27×。過掃描 = 車廂照被放大,
// 而放大在螢幕上讀起來就是「鏡頭在推」—— 12° 的峰值(back 曲線會把實際峰值壓到 ~10.4°)
// 只需要 1.02–1.03×,推得出來但讀不出來。再大就得在轉身中段偷偷 zoom,那是另一種穿幫。
const TURN_MAX = 12 * (Math.PI / 180);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** enter = 進站(門開 + 推軌穿門);exit = 出站(站在月台上,門在身後關起來) */
export type DoorMode = "enter" | "exit";

export type DoorScene = {
  /**
   * 畫一幀。
   * enter:doorP = 0(全閉)→ 1(全開,已經站在車廂裡;之後相機定住,場景就是 ride 舞台)
   * exit :doorP = 0(全開,剛下車)→ 1(全閉,簾幕落下)
   * frame:車廂那一層的連續量(窗景 pan、燈光曲線、月台、隧道)。門相位也要餵 ——
   *        門一開就看得到車廂裡面,窗景不是黑的。
   */
  render(doorP: number, mode: DoorMode, frame: Frame): void;
  /** 除錯用:回報三角形數與 context 狀態 */
  stats(): { triangles: number; calls: number; contextLost: boolean; camZ: number; camYaw: number; over: number; geometries: number; textures: number; frames: number };
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
  // YXZ = 先偏航再俯仰(FPS 慣例):出站要同時有 yaw 與 pitch,用預設的 XYZ 會讓地平線
  // 在轉身時歪掉。yaw = 0 時兩種順序的矩陣完全相同,所以**進站分鏡一個位元都沒動**。
  camera.rotation.order = "YXZ";
  camera.position.set(0, 0, CAM_Z0);
  // canvas 元素比舞台大 5.5%(過掃描留在元素上,見上面的註解);zoom 把視野等比放大回來,
  // 門過場在螢幕上的大小因此與 L1 版一模一樣(實測 profile 互相關 scale 0.9995–1.0000)。
  camera.zoom = 1 / CANVAS_OVER;
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
  // wall 0.72 → 0.85:2026-08 換上帶標語的車體貼圖後重校。新舊兩張的「乾淨鋼板區」
  // (排除海報與綠帶)平均線性亮度是 0.2327 → 0.1972,比值 1.18,乘回去就是 0.85。
  // 用鋼板區而不是整張的平均:海報是暗色塊,拿整張校會把鋼板overexpose 成一片白鐵皮。
  const EXPOSURE = { door: 1.55, wall: 0.85, floor: 0.55 };

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
  // 2026-08 換圖後重量:0.3006–0.4211,與舊圖一致所以 CAR_TILE 不用動)就落在世界
  // y 0.53–1.16 —— 剛好在門洞上緣(1.5)底下,和 EMU900 的腰帶位置相符。
  const CAR_TILE = WALL_TOP - WALL_BOTTOM;
  // 橫向相位。car-body.jpg 上的標語/海報全部擠在貼圖的左右兩端(實測 u 0.026–0.175 與
  // 0.809–0.974),中間 u 0.175–0.809 是乾淨鋼板。tiling 之後那兩群會在接縫處併成一叢
  // 六張的密集標語牆(週期 5.25 m 裡佔 1.92 m)—— 這其實就是真實車廂的樣子(標語成組貼在
  // 兩個車門之間),問題只在**它落在哪裡**。
  // 取 0.5 = 把乾淨鋼板的正中對到門洞中線,於是:
  //   · 上楣(x ±1 ⇒ u 0.31–0.69)整片乾淨,不會有半張海報被門框切掉
  //   · 那叢標語剛好落在世界 x ±1.62–3.54,也就是起始機位(可見到 ±3.13)裡門的正兩側
  //   · 左右位置對稱、內容卻不同(左邊靠門的是「請勿倚靠車門」那組,右邊是「夜間乘車」那組)
  //     —— 對稱構圖不破,又看不出是同一張圖 tile 出來的
  const CAR_U0 = 0.5;
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
      uv.setXY(i, wx / CAR_TILE + CAR_U0, (wy - WALL_BOTTOM) / CAR_TILE);
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

  // ── 車廂(L2a:不再是一張背板,而是一疊有深度的平面)──────────────────────────
  // 牆(窗區挖成真的洞)+ 立柱 + 窗景遠近層 + 月台層 + 隧道層,全部在 cabin.ts。
  // 尺寸不是固定的:每幀依當時的相機距離重算成「剛好 cover 視錐」的大小(見 render 與
  // cabin.ts 檔頭)。這樣任何視窗比例下、任何一幀,門後看到的都一定是滿版的車廂。
  //
  // 舊版這裡是「一張烤死的 cabin.jpg 背板 + 最後 15% canvas 淡出交棒給 DOM 車廂」。
  // 交棒整段消失了 —— 門開完相機就停在車廂裡,同一個場景繼續當 ride 的舞台,
  // 於是末幀對位這個一直要守的東西不再是風險(它已經沒有對象要對)。
  const cabin = createCabin(scene, onReady);

  // ── 燈光 ───────────────────────────────────────────────────────────────────
  scene.add(new AmbientLight(0x37506b, 1.15)); // 夜的冷調環境光(月台燈的漫射)
  // 暖光點光源擺在門**外**一點:門板正面是朝著月台的,光源擺車內照不到它。
  // 語意上就是「車內的光潑出門口」,強度隨開門度上升。
  const warm = new PointLight(0xffa94d, 0, 9, 2);
  warm.position.set(0, 0.55, 0.45);
  scene.add(warm);

  // ── 每幀 ───────────────────────────────────────────────────────────────────
  let lastP = 0;
  let lastMode: DoorMode = "enter";
  let lastFrame: Frame | null = null;
  let cw = 0, ch = 0;
  let lastOver = 1; // stats() 回報用(L2b 驗收:佈景被迫放大多少)

  // ── 佈景過掃描的精算(L2b)──────────────────────────────────────────────────
  // exit 的相機是真的在動,而車廂各層是**凍結在 ride 那一刻**的平面(這正是視差的來源)。
  // 平面不會自己跟上來,所以每幀要問一次:「這一幀的視錐,有沒有超出這片平面?」
  // 作法是把四條角射線打到該層的平面上,取最大的 |x| / |y| 除以平面的半寬/半高。
  // 回傳 ≤ 1 就代表還蓋得住(ride 那一幀是 1/1.035 = 0.966,所以外面 clamp 到 1 之後
  // **與 2a 逐位相同**);> 1 就是這一幀需要的最小放大倍率。
  const _dir = new Vector3();
  const coverNeed = (zPlane: number, halfW: number, halfH: number) => {
    // ⚠️ 用**舞台**的視角而不是 canvas 的:canvas 比舞台大 5.5%(過掃描留在元素上,坑 14),
    // 相機的 zoom = 1/1.055 把那 5.5% 補回去 —— 也就是說 canvas 邊緣那一圈本來就落在
    // 舞台的 overflow: hidden 外面,cover 從來沒有負責蓋住它。把 zoom 算進來會多要 5.5%
    // 的過掃描,e = 0 就不再與 ride 逐位相同了(實測整片差 1.9%、77.8% 的像素被動到)。
    const tv = Math.tan(HALF_FOV);
    const th = tv * camera.aspect;
    let need = 0;
    for (let i = 0; i < 4; i++) {
      _dir.set(i < 2 ? -th : th, i % 2 ? -tv : tv, -1).applyQuaternion(camera.quaternion);
      if (_dir.z > -1e-3) return 8; // 射線幾乎與平面平行(yaw 已經接近 90°):放棄,交給分鏡別走到這裡
      const t = (zPlane - camera.position.z) / _dir.z;
      if (t <= 0) continue;
      need = Math.max(
        need,
        Math.abs(camera.position.x + t * _dir.x) / halfW,
        Math.abs(camera.position.y + t * _dir.y) / halfH,
      );
    }
    return need;
  };

  const render = (doorP: number, mode: DoorMode, frame: Frame) => {
    lastP = doorP;
    lastMode = mode;
    lastFrame = frame;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return; // display:none 期間 clientWidth = 0,畫了只會把 buffer 縮成 0
    if (w !== cw || h !== ch) {
      cw = w; ch = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
    }
    const p = clamp01(doorP);

    // 兩種模式共用同一組幾何、同一個 context、同一個 renderer:差別只在「開度怎麼算」
    // 與「相機站在哪」。exit 完全不碰 enter 的任何常數(FOV/CAM_Z0/CAM_Z1/CABIN_Z/zoom
    // 以及燈光、emissive),末幀對位因此不受影響。
    let open: number;      // 門的開度 0(全閉)→ 1(全開)
    let slitOpacity: number;
    let jambFade: number;  // 門柱暖邊的衰減係數
    let zoom: number;
    let over = 1;          // L2b:佈景過掃描(exit 才會 > 1)
    let collapse = 0;      // L2b:窗景層的深度塌陷
    // L2b:exit 的佈景**凍結在 ride 那一刻**(不隨相機重算 cover)—— 這就是真視差的來源。
    // null = 照舊每幀重算(ride / 進站)。
    let frozen: { ph: number; dist: number } | null = null;

    if (mode === "exit") {
      // ── 出站(L2b):起身 → 半拍 → 轉身 → 退出門外 → 門關,一顆鏡頭到底 ────────
      // p 在這個模式下就是 e(exitProgress),分鏡表見檔頭的 EXIT。
      collapse = smooth(clamp01(p / EXIT.collapse));
      const rise = smooth(clamp01((p - EXIT.riseFrom) / (EXIT.riseTo - EXIT.riseFrom)));
      const turn = smooth(clamp01((p - EXIT.turnFrom) / (EXIT.turnTo - EXIT.turnFrom)));
      const back = smooth(clamp01((p - EXIT.backFrom) / (EXIT.backTo - EXIT.backFrom)));
      const out = smooth(clamp01((p - EXIT.outFrom) / (EXIT.outTo - EXIT.outFrom)));
      const close = smooth(exitDoorAt(p));
      open = 1 - close;
      // 門快閉合時才重新有「縫」可以漏光;完全關上時是最亮的一道細線,接著 hero 蓋上來
      slitOpacity = 0.95 * smooth(clamp01((close - 0.55) / 0.45));
      // 門柱暖邊只在「已經站到月台上」之後才有意義(車廂內看不到門柱)。用 out 當閘門
      // 還有一個硬要求:e = 0 必須與 ride 末幀逐位相同,而 ride 的 jambFade 已經衰減到 0。
      jambFade = out;
      zoom = 1;

      // 公轉:樞紐擺在牆面(z = CABIN_Z)正中,半徑 = ride 的機位到牆的距離。
      // θ = 0 時位置與朝向剛好回到 ride 的 (0, 0, CAM_Z1) —— 所以 e = 0 不需要任何特例。
      const R = CAM_Z1 - CABIN_Z;
      const yaw = TURN_MAX * turn * (1 - back);
      const fill = lerp(EXIT_FILL_PORTRAIT, EXIT_FILL_WIDE, clamp01((camera.aspect - 1.0) / 0.8));
      // 出站構圖:相機抬到門洞正中(不是眼高 0),門在畫面裡置中,「門高佔畫面高 fill」才是準的
      const zDoor = (DOOR_TOP - FLOOR_Y) / fill / (2 * Math.tan(HALF_FOV));
      const yDoor = (DOOR_TOP + FLOOR_Y) / 2;
      camera.position.set(
        lerp(R * Math.sin(yaw), 0, out),
        lerp(RISE_Y * rise, yDoor, out),
        lerp(CABIN_Z + R * Math.cos(yaw), zDoor, out),
      );
      camera.rotation.y = yaw * (1 - out);
      // 起身時低頭補償(見 PITCH_COMP);退出門外時歸零,末段構圖是正對門的
      camera.rotation.x = -Math.atan((RISE_Y * rise * PITCH_COMP) / R) * (1 - out);

      // 佈景凍結在 ride 那一刻 → 相機一動就有真視差。代價是平面不會自己跟上視錐,
      // 所以每幀精算最小過掃描(牆 + 立柱兩層都要蓋得住;其餘層都躲在窗洞裡)。
      const frozenH = 2 * R * Math.tan(HALF_FOV) * Math.max(1, camera.aspect / CABIN_ASPECT) * SWAY;
      const frozenW = frozenH * CABIN_ASPECT;
      const kFront = (R - (Z_FRONT - CABIN_Z)) / R;
      camera.updateProjectionMatrix(); // coverNeed 讀 camera.aspect / zoom,先確保投影是最新的
      over = Math.max(
        1,
        coverNeed(CABIN_Z, frozenW / 2, frozenH / 2),
        coverNeed(Z_FRONT, (frozenW * FRONT_REL * kFront) / 2, (frozenH * FRONT_REL * kFront) / 2),
      );
      lastOver = over;
      frozen = { ph: frozenH, dist: R };
    } else {
      // ── 進站:四拍時間軸。全部由 doorP 插值,沒有任何 delta time ────────────
      open = easeOut(clamp01((p - 0.15) / 0.55));       // 0.15–0.70 開門
      const dolly = smooth(clamp01((p - 0.30) / 0.55)); // 0.30–0.85 推軌;0.85 後定住讓 CSS 交棒
      const seamGlow = smooth(clamp01(p / 0.15));       // 0–0.15 門縫光漸亮(關門待機)
      // 門縫光:關門待機時漸亮,門一開就沒有「縫」了,交給光楔和點光源接手
      slitOpacity = (0.22 + 0.78 * seamGlow) * (1 - easeOut(clamp01(open / 0.35)));
      // 人已經進車廂,門框在身後就不該再發光
      jambFade = 1 - smooth(clamp01(dolly / 0.7));
      zoom = 1 + 0.24 * (1 - dolly);
      lastOver = 1;
      // 拍 3:dolly-in。相機沿 Z 前推穿過門框,俯角在中途回正(末幀必須是 0,否則背板對不上)
      camera.position.set(0, 0, lerp(CAM_Z0, CAM_Z1, dolly));
      camera.rotation.x = PITCH0 * (1 - smooth(clamp01((p - 0.1) / 0.55)));
    }
    camera.updateProjectionMatrix();

    // 拍 2:門板往外滑 + 塞拉門先浮出車體外側(出站就是同一件事倒著跑)
    const plug = easeOut(clamp01(open / 0.25)); // 前四分之一先完成「浮出」,之後才是滑行
    const dx = open * PANEL_OPEN_X;
    const dz = plug * PANEL_OPEN_Z;
    panelL.position.set(-panelClosedX - dx, panelL.position.y, dz);
    panelR.position.set(panelClosedX + dx, panelR.position.y, dz);

    slitMat.opacity = slitOpacity;
    slit.position.z = PANEL_T / 2 + 0.02 + dz;

    // 拍 2:暖光灑地。寬度與亮度都隨開門度長出來 —— 出站時就是隨門縫收窄而收乾
    wedgeMat.opacity = 0.9 * open;
    wedge.scale.set(1.9 + 1.5 * open, 2.5, 1);
    warm.intensity = 11 * open;
    // 門框內側只要一道「被車內光舔到」的暖邊。emissive 不吃幾何明暗,值一大就是死平的
    // 色塊 —— 而 dolly 到中段時相機正好貼著門柱掠過,那兩根柱子的側面各佔近 1/10 螢幕
    // (實測 0.55 是兩條純 #ff9a3c 的橘柱,把整個推軌鏡頭壓成橘色)。所以壓到 0.16。
    jambMat.emissiveIntensity = 0.16 * open * jambFade;

    // 車廂:每幀重算成 cover 尺寸(牆那一層,其餘各層在 cabin.ts 依距離比例跟著算)。
    //   視錐在牆面距離上的高度 = 2·dist·tan(fov/2);要 cover 就得再乘上
    //   max(1, aspect/CABIN_ASPECT)(寬螢幕改由寬度決定),最後乘 **SWAY**(不是
    //   CANVAS_OVER):相機 zoom 已經把元素比舞台大的那 5.5% 抵消掉,所以「螢幕上多大」
    //   只由 ph/frustumH 決定 —— 乘 1.035 算出來就是 DOM 車廂的 cover × sway。
    //   zoom 讓早期的車廂稍微放大一點(由深處「落定」),收斂到 1 就是 DOM/cover 的幾何。
    //   **出站(L2b)完全不走這一段**:佈景凍結在 ride 的那一組數字,只有相機在動 ——
    //   cover 重算的定義就是「佈景永遠跟著相機」,而跟著相機就等於沒有視差。
    if (frozen) {
      cabin.update({ camY: 0, dist: frozen.dist, ph: frozen.ph, cy: 0, frame, visible: true, over, collapse });
    } else {
      const dist = camera.position.z - CABIN_Z;
      const pitch = Math.abs(camera.rotation.x);
      // 俯角期間視錐是斜的,用 tan(fov/2 + |pitch|) 取一個略大的保守值,免得上緣露空
      const frustumH = 2 * dist * Math.tan(HALF_FOV + pitch);
      const ph = frustumH * Math.max(1, camera.aspect / CABIN_ASPECT) * SWAY * zoom;
      // 車廂跟著視線中心:俯角歸零、相機在 y=0 時回到 y=0(= enter 末幀的對位條件)
      const cy = camera.position.y + dist * Math.tan(camera.rotation.x);
      cabin.update({ camY: camera.position.y, dist, ph, cy, frame, visible: true });
    }

    renderer.render(scene, camera);
  };

  // 尺寸變化才重畫一幀(沒有常駐 rAF,resize 時沒人會幫我們補畫)
  const ro = new ResizeObserver(() => lastFrame && render(lastP, lastMode, lastFrame));
  ro.observe(canvas);

  // context 真的被 GPU 收走時(顯卡驅動重啟、分頁長期背景化)的保險。
  // preventDefault 才會讓瀏覽器嘗試補發 restored;three 的資源在 restore 後會自動重上傳。
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => lastFrame && render(lastP, lastMode, lastFrame));
  // 這裡刻意沒有 dispose():元件一輩子只掛載一次(見 CLAUDE.md 坑 10),
  // 真的走到卸載就是離開頁面,context 交給瀏覽器回收就好。

  return {
    render,
    stats: () => ({
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      contextLost: renderer.getContext().isContextLost(),
      camZ: camera.position.z,
      // L2b 的驗收要看的兩個數字:相機轉了幾度、佈景被迫放大了多少(紙片穿幫的量測面)
      camYaw: (camera.rotation.y * 180) / Math.PI,
      over: lastOver,
      // L2a 的效能預算(spec:<30 calls / <500 tri):車廂那疊平面全程都在,
      // 這兩個數字是驗收要看的。geometries/textures 用來抓「窗景長條有沒有重複上傳」。
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      // 「idle 零 GPU」的證據:閒置時這個數字不能動(render-on-demand 是憲法)
      frames: renderer.info.render.frame,
    }),
  };
}

// L2a:車廂本體進場景。門開完 canvas 不落幕,這一組平面就是 ride 的視覺層。
//
// 這裡沒有 React、沒有 rAF、沒有時間軸:一個 update() 畫一幀,由 ScrollJourney 的
// applyFrame 經 Door3D 直呼。倒著捲就是倒著跑,和門場景同一套紀律。
//
// ── 幾何:為什麼每一層都「重算成 cover」而不是靠透視 ──────────────────────────────
// 車廂那張基底是**照片**,不是模型:它必須永遠剛好填滿畫面(DOM 版是
// width: max(100vw, 177.68vh) 的 cover),否則直式手機會露出上下黑邊(坑 4)。
// 所以每一層都依「自己到相機的距離」重算成剛好 cover 視錐的大小 —— 於是任何相機位置下,
// 各層在螢幕上永遠對齊同一格網(= DOM 合成的樣子),進站推軌時不會有層與層錯開的破綻。
// 代價:ride 相機靜止時層與層之間沒有相對視差(滑鼠視差整片走 CSS,見 ScrollJourney)。
// 深度真正兌現的地方是:窗景遠近層的差速(A3)、窗是牆上真的洞、隧道掃光沿 z 的先後,
// 以及階段 2b 出站相機真的轉身時 —— 那時 cover 重算會換成固定尺寸(見檔尾註解)。
//
// ── 色彩:為什麼是自寫 shader 而不是把 Grade 映射成場景燈光 ─────────────────────
// 六站燈光曲線是上一批工作的成果(DESIGN.md §1),它的定義是 CSS 的
// `filter: brightness saturate contrast` + 一層 soft-light 的 tint。改成 Ambient/Point
// 的顏色強度等於**重調一次曲線**,而曲線本身沒有要改。所以這裡把 CSS 的那三個 filter
// 函式與 soft-light 混色**原式**搬進 fragment shader:貼圖走 NoColorSpace(取樣拿到的
// 就是 sRGB 值)、輸出不再做色彩空間轉換,算式因此和瀏覽器合成器在做的事情逐位對應。
// 「車外亮於車內」仍然成立,而且是物理的:窗景平面是 MeshBasic(自發光),車廂被 grade 壓暗。
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoColorSpace,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Texture,

} from "three";
import { LED_RECT, WIN } from "@/lib/progress";
import { PAN_LOOPS, buildStrip } from "@/lib/strips";
import type { Frame } from "@/lib/frame";
import type { SceneType } from "@/content/stations";
import type { SceneLayerKind } from "@/lib/scene";

// cabin.jpg 的比例(坑 4 的紅線,換基底時是圖去遷就它)。scene.ts 有同一個常數 ——
// 那裡算背板 cover,這裡算窗洞座標,兩邊必須同一個數字。
const CABIN_ASPECT = 1672 / 941;
// 立柱層相對於底圖的放大。**四處必須同步**:globals.css 的 .cabin-front(降級路徑的
// DOM 版)、ScrollJourney 的 FRONT_SCALE_REL(降級路徑的視差)、這裡(場景版)。
// 1.035(sway,現在由 canvas 的 CSS transform 提供)× 1.0241546 = 1.06 = 螢幕上的實際倍率。
const FRONT_REL = 1.0241546;

// 各層的世界 z(相機在 ride 停在 z = -1.2)。距離只決定「哪一層先畫」與 2b 的視差,
// 螢幕上的大小一律由 cover 重算決定(見檔頭)。
const Z = { far: -14, near: -11, platform: -9.5, dim: -9, wall: -8, flash: -7.5, front: -6.5 } as const;
// 畫序(three 先畫不透明再畫透明,透明內部依 renderOrder → 距離排序)。
// 順序照抄 DOM 的節點順序:窗景 → 月台 → 隧道壓暗 →(牆)→ 出洞回光 → 立柱。
const ORDER = { far: -60, near: -59, platform: -58, dim: -57, wall: -50, flash: -45, front: -40 } as const;

const LED_BLANK = "#050805";

// ── 車廂表面的 shader(牆 + 立柱共用)────────────────────────────────────────────
const GRADE_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// CSS filter 的三個函式與 mix-blend-mode: soft-light 的規格算式(都在 sRGB 空間,
// 每一步 clamp —— 瀏覽器的 filter primitive 也是逐段 clamp 的)。
// uTun:隧道段的車內光。uLead 是**深度階梯** —— 近層(立柱)比車廂壁早 uLead 個週期
// 亮起來、而且多吃一點光池,這就是 L2 相對於 L1 的「掃光沿 z 有先後」。
const GRADE_FRAG = `
precision highp float;
uniform sampler2D map;
uniform vec3 uFil;   // brightness / saturate / contrast
uniform vec4 uTint;  // soft-light 的色片(rgb + alpha)
uniform vec2 uTun;   // x = 光池強度(0 = 不在隧道), y = 掃光位移(%)
uniform float uLead; // 深度階梯:0 = 車廂壁,>0 = 更近的層
varying vec2 vUv;

float softLight(float b, float s) {
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return s <= 0.5 ? b - (1.0 - 2.0 * s) * b * (1.0 - b)
                  : b + (2.0 * s - 1.0) * (d - b);
}

void main() {
  vec4 t = texture2D(map, vUv);
  if (t.a <= 0.004) discard; // 窗洞 / 立柱層的空白:整塊丟掉,省 fill 也省掉「洞裡有色」的風險
  vec3 c = clamp(t.rgb * uFil.x, 0.0, 1.0);
  float l = dot(c, vec3(0.213, 0.715, 0.072));
  c = clamp(mix(vec3(l), c, uFil.y), 0.0, 1.0);
  c = clamp((c - 0.5) * uFil.z + 0.5, 0.0, 1.0);
  vec3 sl = vec3(softLight(c.r, uTint.r), softLight(c.g, uTint.g), softLight(c.b, uTint.b));
  c = mix(c, sl, uTint.a);

  if (uTun.x > 0.0) {
    // 車內暖光池(舊 .tunnel-lift):橢圓 70%×55%,中心 (50%, 42%),premultiplied 內插
    vec2 d = vec2((vUv.x - 0.5) / 0.70, ((1.0 - vUv.y) - 0.42) / 0.55);
    float r = length(d);
    vec4 g0 = vec4(vec3(255.0, 186.0, 110.0) / 255.0 * 0.55, 0.55);
    vec4 g1 = vec4(vec3(255.0, 150.0, 70.0) / 255.0 * 0.12, 0.12);
    vec4 pool = r < 0.7 ? mix(g0, g1, r / 0.7)
                        : mix(g1, vec4(0.0), clamp((r - 0.7) / 0.3, 0.0, 1.0));
    pool *= uTun.x * (1.0 + uLead * 1.2);
    c = c * (1.0 - pool.a) + pool.rgb;
    // 洞壁燈帶橫掃(舊 .tunnel-sweep-band):100deg、一段隧道剛好掃過一輪。
    // 0.985 / 0.0979 是 100° 方向在(寬 1、高 1/1.7768)的車廂框裡的分量,
    // 1.034 是原本 CSS 週期(元素寬 200%、gradient 週期 50%)換算成車廂寬的長度。
    float phase = (0.985 * vUv.x + 0.0979 * (1.0 - vUv.y) + 0.0197 * uTun.y) / 1.034 + uLead;
    float f = fract(phase);
    float band = 0.11 * smoothstep(0.4, 0.5, f) * (1.0 - smoothstep(0.5, 0.6, f));
    c = c * (1.0 - band) + vec3(255.0, 193.0, 122.0) / 255.0 * band;
  }
  gl_FragColor = vec4(c, t.a);
}
`;

// ── 隧道壓暗(每扇窗一片,擺在窗洞後面 → 洞就是它的 overflow: hidden)──────────────
// 舊 .win-dim(整片 #04070c)+ .win-dim-band(掃過去的軟邊暗帶)合成一次輸出。
const DIM_FRAG = `
precision highp float;
uniform float uDim;
uniform float uBand; // 位移(%),-999 = 這一幀沒有暗帶
varying vec2 vUv;
void main() {
  float a = uDim;
  if (uBand > -900.0) {
    // 元素寬 70%,transform: translate3d(band%, 0, 0) 是相對它自己的寬 → 左緣 = band × 0.7
    float t = (vUv.x - uBand * 0.007) / 0.7;
    float g = 0.0;
    if (t > 0.0 && t < 1.0) {
      g = t < 0.35 ? mix(0.0, 0.85, t / 0.35)
        : t < 0.65 ? mix(0.85, 0.95, (t - 0.35) / 0.30)
                   : mix(0.95, 0.0, (t - 0.65) / 0.35);
    }
    a = 1.0 - (1.0 - a) * (1.0 - g);
  }
  gl_FragColor = vec4(vec3(4.0, 7.0, 12.0) / 255.0 * a, a); // premultiplied
}
`;

const QUAD = new PlaneGeometry(1, 1); // 所有層共用:尺寸與位置每幀由 scale/position 給

type Crop = { x: number; y: number; w: number; h: number };
type Slot = {
  mesh: Mesh;
  mat: MeshBasicMaterial;
  key: string;
  factor: number;
  layer?: SceneLayerKind;
};
type Win = {
  rect: (typeof WIN)[number];
  bg: boolean;
  posX: number;
  crop: Crop | null;
  /** 中央窗拆遠近兩層(A3);左右窗只有一層 —— 那道 7% 寬的窄縫讀不出差速 */
  plan: { layer?: SceneLayerKind; factor: number }[];
  a: Slot[];
  b: Slot[];
  platform: Slot;
  dim: Mesh;
  dimMat: ShaderMaterial;
};

export type Cabin = {
  /** 每幀:依 wall 層的 cover 幾何(scene.ts 算好)擺好所有層,再套上這一幀的連續量 */
  update(p: { camY: number; dist: number; ph: number; cy: number; frame: Frame; visible: boolean }): void;
};

const parsePos = (pos: string) => {
  const m = pos.match(/^([\d.]+)%/);
  return m ? Number(m[1]) / 100 : 0.5;
};

// rgba(...) → [r, g, b, a](0–1)。每幀一次,結果寫回同一個陣列不配置新物件。
const rgba = (s: string, out: number[]) => {
  const p = s.match(/[\d.]+/g);
  if (!p) return out;
  out[0] = Number(p[0]) / 255;
  out[1] = Number(p[1]) / 255;
  out[2] = Number(p[2]) / 255;
  out[3] = p.length > 3 ? Number(p[3]) : 1;
  return out;
};

export function createCabin(scene: Scene, onReady: () => void): Cabin {
  // 兩張車廂素材走**原生 Image 而不是 TextureLoader**:three 的 loader 預設帶
  // crossOrigin = "anonymous",而 layout.tsx 的 <link rel=preload as=image> 沒有
  // crossorigin —— 兩者的 credentials mode 對不上,瀏覽器會整張重下一次(實測 cabin-front
  // 被抓兩次)。cabin.jpg 是 LCP 候選,多下一次 150 KB 不能接受。
  const loadImg = (src: string, ok: (img: HTMLImageElement) => void) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.src = src; // onerror 刻意留空:載不到就維持沒有那一層(降級,不是錯誤)
  };

  // ── 牆(cabin.jpg,三個窗區挖成真的洞)──────────────────────────────────────
  const gradeMat = (map: Texture | null, lead: number) =>
    new ShaderMaterial({
      uniforms: {
        map: { value: map },
        uFil: { value: [1, 1, 1] },
        uTint: { value: [0, 0, 0, 0] },
        uTun: { value: [0, 0] },
        uLead: { value: lead },
      },
      vertexShader: GRADE_VERT,
      fragmentShader: GRADE_FRAG,
      transparent: true,
      depthWrite: false,
      fog: false,
    });

  const wallMat = gradeMat(null, 0);
  const wall = new Mesh(QUAD, wallMat);
  wall.position.z = Z.wall;
  wall.renderOrder = ORDER.wall;
  wall.visible = false; // 貼圖到貨前不要畫一片沒有 map 的黑
  scene.add(wall);

  // 立柱層:同一個 shader,uLead > 0 → 隧道掃光比車廂壁早一步到(近層先亮)
  const frontMat = gradeMat(null, 0.12);
  const front = new Mesh(QUAD, frontMat);
  front.position.z = Z.front;
  front.renderOrder = ORDER.front;
  front.visible = false;
  scene.add(front);

  // 出洞回光:蓋在窗之上(光是從窗外潑進來的),但在立柱之下 —— 與 DOM 的節點順序一致
  const flashMat = new MeshBasicMaterial({ color: 0xe2eeff, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const flash = new Mesh(QUAD, flashMat);
  flash.position.z = Z.flash;
  flash.renderOrder = ORDER.flash;
  flash.visible = false;
  scene.add(flash);

  // cabin.jpg → 挖洞 + LED 塗黑。LED 那塊照片裡烤死了一組跑馬燈文字,而 DOM 的即時
  // 跑馬燈就疊在同一個位置(CabinFrame):底色留在場景裡、只有會發光的字是 DOM,
  // 兩邊的深度關係才不會反過來(橫杆必須壓在跑馬燈面板前面,見 CabinComposite 的註解)。
  loadImg("/cabin.jpg", (img) => {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    g.fillStyle = LED_BLANK;
    g.fillRect(
      Math.round((LED_RECT.left / 100) * c.width),
      Math.round((LED_RECT.top / 100) * c.height),
      Math.round((LED_RECT.w / 100) * c.width),
      Math.round((LED_RECT.h / 100) * c.height),
    );
    // 窗區挖成 alpha 0(圓角吃 WIN 的 r,和 DOM 的 border-radius 同一組數字):
    // 窗景平面就擺在洞後面,圓角自然由牆自己切 —— 不需要另外做遮罩。
    g.globalCompositeOperation = "destination-out";
    for (const r of WIN) {
      const w = (r.w / 100) * c.width, h = (r.h / 100) * c.height;
      const [rx, ry] = r.r.split("/").map((s) => parseFloat(s) / 100);
      g.beginPath();
      g.roundRect((r.left / 100) * c.width, (r.top / 100) * c.height, w, h, [{ x: rx * w, y: ry * h }]);
      g.fill();
    }
    const t = new CanvasTexture(c);
    t.colorSpace = NoColorSpace; // shader 直接吃 sRGB 值(見檔頭)
    t.magFilter = LinearFilter;
    t.minFilter = LinearMipmapLinearFilter;
    wallMat.uniforms.map.value = t;
    wall.visible = true;
    onReady();
  });

  // 載不到就維持無立柱的車廂 —— 和 DOM 端 front 載入失敗(onError 收掉整個容器)同一種降級
  loadImg("/cabin/cabin-front.png", (img) => {
    const t = new Texture(img);
    t.colorSpace = NoColorSpace;
    t.magFilter = LinearFilter;
    t.minFilter = LinearMipmapLinearFilter;
    t.needsUpdate = true;
    frontMat.uniforms.map.value = t;
    front.visible = true;
    onReady();
  });

  // ── 窗景 ───────────────────────────────────────────────────────────────────
  // 長條(3× 寬的 [bg | full | bg])上傳一次,pan 走 texture.offset.x —— 每幀零上傳、
  // 零 2D 繪製(舊 DOM 版是每幀兩次 drawImage × 3 扇窗)。
  // clone() 共用同一個 source:同一站的長條只上傳一次 GPU,三扇窗各自帶自己的
  // offset/repeat(cover 裁切在不同窗是不同的取樣框)。
  const baseTex = new Map<string, Texture>();
  const slotTex = new Map<string, Texture>();
  let cellW = 0, cellH = 0, stripW = 0;

  const getBase = (s: SceneType, bg: boolean, layer?: SceneLayerKind) => {
    const key = `${s}|${bg}|${layer ?? "-"}`;
    let t = baseTex.get(key);
    if (!t) {
      const strip = buildStrip(s, bg, layer);
      if (!stripW) { stripW = strip.width; cellW = strip.width / 3; cellH = strip.height; }
      t = new CanvasTexture(strip);
      t.colorSpace = SRGBColorSpace;
      t.magFilter = NearestFilter; // 像素風景:放大不能內插(坑:抖色圖案會糊成灰)
      t.minFilter = NearestFilter;
      t.generateMipmaps = false;
      t.wrapS = RepeatWrapping;    // pan 繞一圈:長條兩端都是可無縫平鋪的 bg
      t.wrapT = ClampToEdgeWrapping;
      baseTex.set(key, t);
    }
    return t;
  };
  const getSlotTex = (wi: number, s: SceneType, bg: boolean, layer?: SceneLayerKind) => {
    const key = `${wi}|${s}|${bg}|${layer ?? "-"}`;
    let t = slotTex.get(key);
    if (!t) {
      t = getBase(s, bg, layer).clone(); // source 共用 = 只上傳一次
      slotTex.set(key, t);
    }
    return t;
  };

  const winMat = () =>
    new MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, opacity: 1, toneMapped: false });

  const mkSlot = (z: number, order: number, factor: number, layer?: SceneLayerKind): Slot => {
    const mat = winMat();
    const mesh = new Mesh(QUAD, mat);
    mesh.position.z = z;
    mesh.renderOrder = order;
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, mat, key: "", factor, layer };
  };

  const wins: Win[] = WIN.map((rect, i) => {
    const center = i === 0;
    const plan = center
      ? [{ layer: "far" as SceneLayerKind, factor: 0.35 }, { layer: "near" as SceneLayerKind, factor: 1 }]
      : [{ factor: 1 }];
    const mk = (p: { layer?: SceneLayerKind; factor: number }) =>
      mkSlot(p.layer === "far" ? Z.far : Z.near, p.layer === "far" ? ORDER.far : ORDER.near, p.factor, p.layer);
    const dimMat = new ShaderMaterial({
      uniforms: { uDim: { value: 0 }, uBand: { value: -999 } },
      vertexShader: GRADE_VERT,
      fragmentShader: DIM_FRAG,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      fog: false,
    });
    const dim = new Mesh(QUAD, dimMat);
    dim.position.z = Z.dim;
    dim.renderOrder = ORDER.dim;
    dim.visible = false;
    scene.add(dim);
    return {
      rect,
      bg: i !== 0,
      posX: parsePos(rect.pos),
      crop: null,
      plan,
      // A = 正在離開的站(永遠 opacity 1),B = 疊在上面淡入的新站 —— 和 DOM 版
      // SceneLayer 的兩層結構等價,只是驅動源從計時器換成 x。
      a: plan.map(mk),
      b: plan.map(mk),
      platform: mkSlot(Z.platform, ORDER.platform, 1),
      dim,
      dimMat,
    };
  });

  // objectFit: cover + objectPosition 在來源格子(cellW × cellH)裡的取樣框。
  // 窗框的螢幕比例 = (r.w / r.h) × CABIN_ASPECT,與視窗大小無關 → 這是常數,算一次就好。
  const cropOf = (w: Win): Crop => {
    if (w.crop) return w.crop;
    const a = (w.rect.w / w.rect.h) * CABIN_ASPECT;
    const cellA = cellW / cellH;
    const cw = a > cellA ? cellW : Math.round(cellH * a);
    const ch = a > cellA ? Math.round(cellW / a) : cellH;
    w.crop = { x: Math.round(w.posX * (cellW - cw)), y: Math.round(0.5 * (cellH - ch)), w: cw, h: ch };
    return w.crop;
  };

  const setUv = (t: Texture, crop: Crop, pan: number, factor: number) => {
    // 整數對齊:像素風景不能有次像素平移(抖色圖案會爬行閃爍)
    const off = Math.round(((((pan * factor * PAN_LOOPS) % 1) + 1) % 1) * stripW);
    t.repeat.set(crop.w / stripW, crop.h / cellH);
    t.offset.set((off + crop.x) / stripW, 1 - (crop.y + crop.h) / cellH);
  };

  const fill = (slot: Slot, w: Win, wi: number, s: SceneType, opacity: number, pan: number) => {
    if (opacity <= 0.001) { slot.mesh.visible = false; return; }
    const key = `${s}|${slot.layer ?? "-"}`;
    if (slot.key !== key) {
      slot.mat.map = getSlotTex(wi, s, w.bg, slot.layer);
      slot.mat.needsUpdate = true;
      slot.key = key;
    }
    setUv(slot.mat.map!, cropOf(w), pan, slot.factor);
    slot.mat.opacity = opacity;
    slot.mesh.visible = true;
  };

  const tintBuf = [0, 0, 0, 0];

  return {
    update({ camY, dist, ph, cy, frame, visible }) {
      wall.visible = visible && wallMat.uniforms.map.value !== null;
      front.visible = visible && frontMat.uniforms.map.value !== null;
      if (!visible) {
        for (const w of wins) {
          for (const s of [...w.a, ...w.b, w.platform]) s.mesh.visible = false;
          w.dim.visible = false;
        }
        flash.visible = false;
        return;
      }

      // ── 各層的 cover 幾何:wall 那一層由 scene.ts 給,其餘按距離比例縮放 ──────
      // 一個在 wall 平面上的點 (x, y) 投影到距離 dist2 的平面上就是 (x·k, camY + (y−camY)·k)。
      const pw = ph * CABIN_ASPECT;
      const place = (m: Mesh, sx: number, sy: number, cx: number, cyy: number) => {
        const k = (dist - (m.position.z - Z.wall)) / dist; // 該層距離 ÷ 牆距離
        m.position.set(cx * k, camY + (cyy - camY) * k, m.position.z);
        m.scale.set(sx * k, sy * k, 1);
      };
      place(wall, pw, ph, 0, cy);
      place(front, pw * FRONT_REL, ph * FRONT_REL, 0, cy);
      place(flash, pw, ph, 0, cy);

      // ── 燈光曲線 → shader uniform ─────────────────────────────────────────
      const g = frame.grade;
      const fil = wallMat.uniforms.uFil.value as number[];
      fil[0] = g.brightness; fil[1] = g.saturate; fil[2] = g.contrast ?? 1;
      const ft = frontMat.uniforms.uFil.value as number[];
      ft[0] = fil[0]; ft[1] = fil[1]; ft[2] = fil[2];
      rgba(g.tint, tintBuf);
      const wt = wallMat.uniforms.uTint.value as number[];
      const frt = frontMat.uniforms.uTint.value as number[];
      for (let i = 0; i < 4; i++) { wt[i] = tintBuf[i]; frt[i] = tintBuf[i]; }

      const tun = frame.tunnel;
      const wtun = wallMat.uniforms.uTun.value as number[];
      const ftun = frontMat.uniforms.uTun.value as number[];
      wtun[0] = tun ? tun.lift : 0; wtun[1] = tun ? tun.sweep : 0;
      ftun[0] = wtun[0]; ftun[1] = wtun[1];

      flashMat.opacity = tun ? tun.flash : 0;
      flash.visible = flashMat.opacity > 0.001;

      // ── 三扇窗 ────────────────────────────────────────────────────────────
      const pan = frame.x;
      for (let i = 0; i < wins.length; i++) {
        const w = wins[i];
        const r = w.rect;
        const cx = ((r.left + r.w / 2) / 100 - 0.5) * pw;
        const cyw = cy + (0.5 - (r.top + r.h / 2) / 100) * ph;
        const sw = (r.w / 100) * pw, sh = (r.h / 100) * ph;
        for (let j = 0; j < w.plan.length; j++) {
          // mix 到 1 之後 B 已經完全蓋住 A(遠層不透明的地方近層也是),A 收掉:
          // 少兩個 draw call,而且與 DOM 版一致 —— 那邊 crossfade 走完會把舊層卸載。
          fill(w.a[j], w, i, frame.sceneA, frame.mix >= 1 ? 0 : 1, pan);
          fill(w.b[j], w, i, frame.sceneB, frame.mix, pan);
          place(w.a[j].mesh, sw, sh, cx, cyw);
          place(w.b[j].mesh, sw, sh, cx, cyw);
        }
        // B2 月台層:pan 與主窗景同源,B1 的減速曲線因此免費繼承
        fill(w.platform, w, i, "platform", frame.platform, pan);
        place(w.platform.mesh, sw, sh, cx, cyw);
        // A5 壓暗 + 洞口暗帶(暗帶只給中央窗)
        const dimV = tun ? tun.dim : 0;
        const band = i === 0 && tun ? tun.band : null;
        w.dim.visible = dimV > 0.001 || band !== null;
        if (w.dim.visible) {
          w.dimMat.uniforms.uDim.value = dimV;
          w.dimMat.uniforms.uBand.value = band === null ? -999 : band;
          place(w.dim, sw, sh, cx, cyw);
        }
      }
    },
  };
}

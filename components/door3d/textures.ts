// 門過場用到的所有程序貼圖(全部畫在 canvas 上,不下載任何圖檔)。
//
// ⚠️ 這裡畫的東西**現在是 fallback,不是正式外觀**:門板 / 車體 / 月台地面的正式素材是
// public/door/*.jpg(見 scene.ts 的 `photo()`)。但這一整套沒有被刪掉,也不該被刪 ——
// 它是材質的預設值,照片是「載到才換上去」。圖檔 404、離線、解碼失敗,過場都只是留在
// 這個 painterly 版本上,不會少一塊、不會變白。所以改這裡的時候仍然要顧視覺品質。
//
// 為什麼是 painterly 而不是像素風:門一開,門後就是 cabin.jpg —— 一張半寫實的手繪
// 插畫(柔光、細膩漸層、暖白日光燈)。門板若維持 lib/scene.ts 那套像素語彙
// (80×92 網格 + NEAREST 放大),粗顆粒的門和細膩的車廂會在同一幀裡打架。
// 窗景的像素風是**刻意**的(那是「窗外」,另一個世界,而且會動);門板不是 ——
// 它是車廂的一部分,必須看起來像同一位插畫家畫的。
//
// 畫法一律是:多段柔和垂直漸層打底 → 低頻雲狀不勻 → 細節(拉絲、壓條、磨損)→
// 邊緣 vignette。不勻用 radial gradient 斑塊而不是 `ctx.filter = "blur()"`:
// radial gradient 天然柔邊、沒有相容性問題,而且不用付一次全畫布的模糊成本。
// 取樣端(scene.ts)配合改成 LinearFilter + mipmap,不再是 NEAREST。
//
// 亂數全部走固定種子:貼圖每次載入都要長得一模一樣,不然視覺回歸與截圖比對每次都不同。
//
// 每張貼圖都是 module scope 快取:倒著捲回門相位時不要重畫(門板那張 512×1024,
// 上千次漸層填色,重畫會在捲動中掉幀)。
//
// 要重生外部素材(換圖)的規格、prompt 與換上去之後要量的三個對位數字,
// 見 docs/ai-illustration-prompts.md 的「D. 車門過場素材」。

// ── 從 public/cabin.jpg 實際取樣的色票 ────────────────────────────────────────
// 取樣方式:sharp raw buffer + 區塊平均;括號內是原圖(1672×941)的取樣區塊。
// 這些是整個門場景配色的唯一依據 —— 不要憑感覺加色,加了就會和門後的車廂脫節。
//
//   #18201e  牆面最暗處,天花板下方       (x30-170,   y0-20)
//   #252e2b  牆面主調,暗綠灰             (x30-170,   y240-300)
//   #3e423c  被車頂燈條照到的牆           (x30-170,   y80-100)
//   #f7f3ea  車頂日光燈本體,暖白          (x167-268,  y127-146)   → CABIN.lamp
//   #ede5db  不鏽鋼扶手高光               (x800-1000, y186-188)
//   #adaa9b  立柱中間調,暖銀灰            (x363-372,  y400-500)   → CABIN.steel
//   #7d766e  車窗框受光面                 (x700-900,  y284-291)
//   #484742  金屬暗面                     (x348-351,  y400-500)
//   #2f2c27  車窗壓條本體                 (x700-900,  y292-296)
//   #050706  車窗玻璃                     (x669-836,  y423-517)
//   #718345  綠腰帶(EMU900 車身綠的夜間相) (x334-501,  y600-610)
//   #a77a2a  博愛座黃色地板,受光處         (x1250-1600,y904-916)
//   #543b0f  同上,暗處                    (x1250-1600,y886-890)   → CABIN.warnDark
//   #504d46  車廂地板,暖灰                (x200-900,  y912-928)
//
// 下面只留真的被引用的三個 —— 其餘是給後續改色時對照用的取樣記錄。
// ⚠️ 這張表是**色相與明暗關係**的依據,不是可以直接抄的絕對值:門場景的環境光是
// 冷藍的(0x37506b),Lambert 相乘之後亮度只剩三分之一,照抄會整片沉進黑裡。
const CABIN = {
  lamp: "#f7f3ea",
  steel: "#adaa9b",
  warnDark: "#543b0f",
} as const;

// 門板自己的色階:牆的暗綠灰家族(色相往 EMU900 車身綠的黃味偏一點點),
// 明度依上面那條規則整體抬高一階 —— 舊版用平色 #1f241f,結果門板在夜色裡等於隱形。
const DOOR = {
  top: "#454e45", // 上緣,車頂燈溢下來的受光
  upper: "#3c443c",
  mid: "#363e37",
  lower: "#2f372f",
  foot: "#232a24", // 下緣落影
  bright: "#525b50", // 不勻的亮斑
  shade: "#1e251f", // 不勻的暗斑
} as const;

// ── 小工具 ───────────────────────────────────────────────────────────────────

/** 固定種子的 PRNG(mulberry32)。用 Math.random 的話每次重整貼圖都不一樣。 */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "#rrggbb" + alpha → "rgba(...)"。色票統一寫 hex,畫的時候才決定濃度。 */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** 柔邊橢圓斑塊。painterly 質感的主力:低頻、低 alpha、大量疊加。 */
function blot(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, hex: string, a: number) {
  g.save();
  g.translate(x, y);
  g.scale(rx, ry);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, rgba(hex, a));
  grad.addColorStop(0.55, rgba(hex, a * 0.45));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, 1, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** 圓角矩形路徑。用 arcTo 而不是 ctx.roundRect:後者較新,而這裡沒必要挑瀏覽器。 */
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

/** 垂直多段漸層填滿一塊區域。stops 是 [位置, hex, alpha?] */
function vGrad(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  stops: Array<[number, string, number?]>,
) {
  const grad = g.createLinearGradient(0, y, 0, y + h);
  for (const [p, hex, a] of stops) grad.addColorStop(p, a === undefined ? hex : rgba(hex, a));
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
}

// ── 門板 ─────────────────────────────────────────────────────────────────────
// 單片門板,512×1024。貼在 1.01 × 2.5 的 mesh 上 —— 顯示縱橫比 0.404、貼圖 0.5,
// 所以貼圖上的一切在畫面上會被縱向拉長約 1.24 倍。橫向拉絲因此畫細一點,
// 圓角半徑則刻意畫大(cabin.jpg 的車窗本來就是大圓角,拉長後正好對得上)。
//
// 3D 版一片門就是一個 mesh,所以這裡只畫一片;右片在 scene.ts 用 repeat.x = -1
// 鏡射(UV 反轉後仍落在 [0,1],配 ClampToEdge 不會在邊緣 wrap 到另一側)。
const PW = 512, PH = 1024;
let panelCanvas: HTMLCanvasElement | null = null;

export function getPanelCanvas(): HTMLCanvasElement {
  if (panelCanvas) return panelCanvas;
  const c = document.createElement("canvas");
  c.width = PW;
  c.height = PH;
  const g = c.getContext("2d")!;
  const rnd = seeded(0x9d2c);

  // 1) 底:多段垂直漸層。上緣受車頂燈、往下逐段沉入夜色 —— 這條曲線抄的是
  //    cabin.jpg 左牆的垂直剖面(燈條下 #3e423c → 中段 #252e2b → 座椅下近黑)。
  vGrad(g, 0, 0, PW, PH, [
    [0, DOOR.top],
    [0.05, DOOR.upper],
    [0.3, DOOR.mid],
    [0.62, DOOR.mid],
    [0.86, DOOR.lower],
    [1, DOOR.foot],
  ]);

  // 2) 橫向:靠車體外側(左)吃到一點月台燈,靠門縫那側(右)整體壓暗 ——
  //    兩片門合起來時中線才會自然地沉下去,不需要畫一條硬邊暗線。
  const hx = g.createLinearGradient(0, 0, PW, 0);
  hx.addColorStop(0, "rgba(255,255,255,0.05)");
  hx.addColorStop(0.5, "rgba(255,255,255,0)");
  hx.addColorStop(1, "rgba(0,0,0,0.13)");
  g.fillStyle = hx;
  g.fillRect(0, 0, PW, PH);

  // 3) 低頻雲狀不勻。單獨看幾乎看不出來,少了就會變成一塊死平的塑膠。
  for (let i = 0; i < 30; i++) {
    const dark = rnd() < 0.55;
    blot(
      g,
      rnd() * PW,
      rnd() * PH,
      70 + rnd() * 130,
      110 + rnd() * 220,
      dark ? DOOR.shade : DOOR.bright,
      0.04 + rnd() * 0.08,
    );
  }

  // 4) 金屬直立拉絲。EMU900 門板是鋁擠型,紋路是縱向的;每條自己再帶一道
  //    上亮下暗的漸層,不然一堆等亮度的豎線會看起來像百葉窗。
  for (let i = 0; i < 150; i++) {
    const x = rnd() * PW;
    const w = 1 + rnd() * 2.4;
    const light = rnd() < 0.5;
    // 振幅要比「肉眼在貼圖上剛好看得見」再大一截:場景的環境光只有 0.3 上下,
    // 貼圖上 3% 的明暗差到了畫面上剩不到 1%,等於白畫。
    const a = 0.022 + rnd() * 0.055;
    const grad = g.createLinearGradient(0, 0, 0, PH);
    grad.addColorStop(0, light ? `rgba(232,226,212,${a})` : `rgba(8,11,9,${a})`);
    grad.addColorStop(0.55, light ? `rgba(232,226,212,${a * 0.5})` : `rgba(8,11,9,${a * 0.8})`);
    grad.addColorStop(1, light ? `rgba(232,226,212,${a * 0.15})` : `rgba(8,11,9,${a})`);
    g.fillStyle = grad;
    g.fillRect(x, 0, w, PH);
  }

  // 5) 上緣受光 / 下緣落影。門板頂端最靠近車頂燈,底部埋在腳下的陰影裡。
  vGrad(g, 0, 0, PW, 26, [
    [0, CABIN.lamp, 0.11],
    [1, CABIN.lamp, 0],
  ]);
  vGrad(g, 0, PH - 40, PW, 40, [
    [0, "#000000", 0],
    [1, "#000000", 0.32],
  ]);

  // 6) 直立長窗。圓角呼應 cabin.jpg 的車窗,外圈是金屬壓條 + 橡膠密封條。
  const wx = 90, wy = 122, ww = 333, wh = 534, R = 46;

  // 6a) 金屬壓條(外框):暗銀灰,上緣受光下緣落影,不是一圈平色
  rrect(g, wx - 17, wy - 17, ww + 34, wh + 34, R + 17);
  const frameGrad = g.createLinearGradient(0, wy - 17, 0, wy + wh + 17);
  frameGrad.addColorStop(0, "#968d81");
  frameGrad.addColorStop(0.12, "#3b3730");
  frameGrad.addColorStop(0.75, "#2a2d26");
  frameGrad.addColorStop(1, "#20231d");
  g.fillStyle = frameGrad;
  g.fill();
  // 壓條內側一圈細亮邊:金屬轉折面吃到的光
  rrect(g, wx - 9, wy - 9, ww + 18, wh + 18, R + 9);
  g.strokeStyle = rgba(CABIN.steel, 0.3);
  g.lineWidth = 2;
  g.stroke();

  // 6b) 橡膠密封條:比金屬更暗更啞,只有上緣有一絲反光
  rrect(g, wx - 7, wy - 7, ww + 14, wh + 14, R + 7);
  g.fillStyle = "#12160f";
  g.fill();
  g.strokeStyle = "rgba(210,204,190,0.10)";
  g.lineWidth = 1.6;
  g.stroke();

  // 6c) 玻璃。近黑但不是死黑 —— 車內燈還沒透出來,靠幾道柔光把它撐成一片玻璃
  g.save();
  rrect(g, wx, wy, ww, wh, R);
  g.clip();
  vGrad(g, wx, wy, ww, wh, [
    [0, "#111710"],
    [0.35, "#0a0e0b"],
    [0.8, "#080b09"],
    [1, "#0d120e"],
  ]);
  // 斜向柔光:玻璃的招牌。從左下往右上掃一道 —— 少了這道,窗只是一塊挖空的黑洞
  const sheen = g.createLinearGradient(wx, wy + wh * 0.85, wx + ww, wy - wh * 0.1);
  sheen.addColorStop(0, "rgba(226,232,228,0)");
  sheen.addColorStop(0.42, "rgba(226,232,228,0.10)");
  sheen.addColorStop(0.56, "rgba(226,232,228,0.19)");
  sheen.addColorStop(0.72, "rgba(226,232,228,0.04)");
  sheen.addColorStop(1, "rgba(226,232,228,0)");
  g.fillStyle = sheen;
  g.fillRect(wx, wy, ww, wh);
  // 靠門縫那側(右)映到的一點暖光:車內的燈就是從那條縫漏出來的
  blot(g, wx + ww, wy + wh * 0.45, ww * 0.5, wh * 0.34, "#ffb877", 0.1);
  // 左上一道細長高光,玻璃邊緣的全反射
  g.save();
  rrect(g, wx + 14, wy + 20, 9, wh * 0.42, 5);
  g.fillStyle = "rgba(232,236,232,0.11)";
  g.fill();
  g.restore();
  g.restore();

  // 6d) 玻璃最外緣的一圈極細亮線:金屬與玻璃的交界,少了這條窗會像一塊貼紙
  rrect(g, wx + 0.5, wy + 0.5, ww - 1, wh - 1, R);
  g.strokeStyle = "rgba(200,206,198,0.13)";
  g.lineWidth = 1;
  g.stroke();

  // 7) 小標示牌(呼應 cabin.jpg 門邊那兩張「請勿倚靠」貼紙)。刻意不畫文字 ——
  //    這個尺寸畫出來只會是雜訊,兩條淡線就足夠讓人讀成一張貼紙。
  const sx = 196, sy = 706, sw = 76, sh = 52;
  rrect(g, sx, sy, sw, sh, 6);
  g.fillStyle = "rgba(216,211,196,0.24)";
  g.fill();
  g.strokeStyle = "rgba(20,24,20,0.35)";
  g.lineWidth = 1.4;
  g.stroke();
  g.fillStyle = "rgba(24,28,24,0.30)";
  g.fillRect(sx + 12, sy + 16, sw - 24, 4);
  g.fillRect(sx + 12, sy + 28, sw - 34, 4);

  // 8) 下緣黃色警戒條(EMU900 車門的識別特徵,也是門板上唯一的暖色錨點)。
  //    色相從 cabin.jpg 的博愛座黃色地板取(#a77a2a:夜間曝光下的黃偏土,不是純黃),
  //    明度同樣要往上抬 —— 冷藍的環境光會把黃色的紅通道吃掉一大截,照抄取樣值
  //    在場景裡會變成一條橄欖綠的髒帶子。
  const by = 848, bh = 62;
  vGrad(g, 0, by, PW, bh, [
    [0, "#f2bd50"],
    [0.35, "#d69a30"],
    [1, "#a87a24"],
  ]);
  g.save();
  // 斜紋只鋪在中間,上下各留 6px 的實色邊 —— 斜紋若一路壓到邊界,深色斜條的末端會
  // 和收邊的暗線併在一起,整條黃帶的上下緣就變成一排規律的鋸齒(實測非常明顯)。
  g.beginPath();
  g.rect(0, by + 6, PW, bh - 12);
  g.clip();
  // 斜紋:每條自己帶柔邊漸層,硬邊斜線在這個解析度下會像貼了張向量圖。
  // 漸層必須沿斜紋的**法線**(1,1)/√2 走 —— 拉成水平的話,漸層只覆蓋到平行四邊形
  // 最左邊那一小段,每條斜紋就只剩左下角一塊三角形,整條黃帶會變成一排規律的尖齒。
  for (let x = -bh; x < PW + bh; x += 54) {
    const sg = g.createLinearGradient(x, by + bh, x + 13, by + bh + 13);
    sg.addColorStop(0, rgba(CABIN.warnDark, 0));
    sg.addColorStop(0.5, rgba(CABIN.warnDark, 0.42));
    sg.addColorStop(1, rgba(CABIN.warnDark, 0));
    g.fillStyle = sg;
    g.beginPath();
    g.moveTo(x, by + bh);
    g.lineTo(x + bh, by);
    g.lineTo(x + bh + 26, by);
    g.lineTo(x + 26, by + bh);
    g.closePath();
    g.fill();
  }
  // 磨損:低 alpha 的暗斑,踩久了的黃條不會是一塊均勻的漆
  for (let i = 0; i < 20; i++) {
    blot(g, rnd() * PW, by + rnd() * bh, 8 + rnd() * 34, 4 + rnd() * 14, "#2a1f08", 0.04 + rnd() * 0.08);
  }
  g.restore();
  // 上緣受光的一條亮邊(黃條的立體感全靠這一條)
  vGrad(g, 0, by, PW, 5, [
    [0, "#f7cd76", 0.55],
    [1, "#f7cd76", 0],
  ]);
  // 下緣一條乾淨的暗邊:斜紋的尾端斜切在下緣,少了這條收邊會變成一排鋸齒
  vGrad(g, 0, by + bh - 4, PW, 4, [
    [0, "#000000", 0],
    [1, "#000000", 0.45],
  ]);
  // 邊緣不規則:沿上緣蓋回門板底色的小缺口 = 漆掉了。canvas 不能挖成透明
  // (挖了貼在 mesh 上就是一個洞),所以是「用底色蓋回去」而不是 destination-out。
  // 只做上緣:下緣要留給上面那條收邊,兩件事一起做會互相打架。
  for (let i = 0; i < 12; i++) {
    blot(g, rnd() * PW, by + rnd() * 3, 10 + rnd() * 22, 1.5 + rnd() * 3.5, DOOR.lower, 0.3 + rnd() * 0.3);
  }

  // 9) 內側(靠門縫那一邊)的橡膠邊:兩片門合起來時中線是一道柔和的暗溝,
  //    不是一條 1px 的黑線 —— 這片門的最右緣在畫面上會被拉到近 10px 寬。
  const seamGrad = g.createLinearGradient(PW - 16, 0, PW, 0);
  seamGrad.addColorStop(0, "rgba(0,0,0,0)");
  seamGrad.addColorStop(0.55, "rgba(0,0,0,0.35)");
  seamGrad.addColorStop(1, "rgba(0,0,0,0.86)");
  g.fillStyle = seamGrad;
  g.fillRect(PW - 16, 0, 16, PH);
  // 橡膠條轉折的一絲高光,免得門縫那側整片糊掉
  g.fillStyle = "rgba(190,196,186,0.07)";
  g.fillRect(PW - 13, 0, 1.6, PH);

  // 10) 整片 vignette。四邊各壓一道,讓門板讀起來是「一片有厚度的板」而不是貼圖。
  vGrad(g, 0, 0, PW, PH * 0.12, [
    [0, "#000000", 0.09],
    [1, "#000000", 0],
  ]);
  const vl = g.createLinearGradient(0, 0, 34, 0);
  vl.addColorStop(0, "rgba(0,0,0,0.12)");
  vl.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = vl;
  g.fillRect(0, 0, 34, PH);

  panelCanvas = c;
  return c;
}

// ── 月台警戒條 ───────────────────────────────────────────────────────────────
// 月台邊緣的黃警示帶。橫向 repeat 用,所以左右必須無縫:斜紋週期 64px、
// 貼圖寬 256 = 剛好 4 個週期;磨損斑塊跨界的部分在 x±256 補畫一次。
let stripCanvas: HTMLCanvasElement | null = null;
export function getStripCanvas(): HTMLCanvasElement {
  if (stripCanvas) return stripCanvas;
  const W = 256, H = 64;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const rnd = seeded(0x51ac);

  // 底:上緣受月台燈、下緣沉進地面的暗。整條的曝光比門板上那條再暗一點 ——
  // 它在門外,吃的是冷月台燈不是車內暖燈。
  vGrad(g, 0, 0, W, H, [
    [0, "#cd9a3c"],
    [0.3, "#ac7f2b"],
    [1, "#78591b"],
  ]);
  // 斜紋(45°,週期 64px)。漸層同樣要沿法線走,理由見門板上那條黃帶
  for (let x = -H; x < W + H; x += 64) {
    const sg = g.createLinearGradient(x, H, x + 15, H + 15);
    sg.addColorStop(0, "rgba(38,28,8,0)");
    sg.addColorStop(0.5, "rgba(38,28,8,0.45)");
    sg.addColorStop(1, "rgba(38,28,8,0)");
    g.fillStyle = sg;
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x + H, 0);
    g.lineTo(x + H + 30, 0);
    g.lineTo(x + 30, H);
    g.closePath();
    g.fill();
  }
  // 磨損 / 髒污。x 方向補畫一次,tile 接縫處才不會出現一條乾淨的直線
  for (let i = 0; i < 16; i++) {
    const x = rnd() * W, y = rnd() * H, rx = 6 + rnd() * 26, ry = 3 + rnd() * 10;
    const a = 0.06 + rnd() * 0.12;
    for (const ox of [-W, 0, W]) blot(g, x + ox, y, rx, ry, "#241a06", a);
  }
  // 上緣受光的亮邊:黃帶不是一塊平的色,靠這條分出「站在地上」的厚度
  vGrad(g, 0, 0, W, 7, [
    [0, "#f0c063", 0.6],
    [1, "#f0c063", 0],
  ]);

  stripCanvas = c;
  return c;
}

// ── 月台地面 ─────────────────────────────────────────────────────────────────
// 平均亮度刻意做成接近白:貼上去之後 MeshLambertMaterial 的 color 相乘不變,
// 所以地面整體曝光完全不受影響,貼圖只負責 ±8% 的明暗與磚縫。
// 上下左右都要無縫(RepeatWrapping),所以斑塊一律 3×3 補畫。
let floorCanvas: HTMLCanvasElement | null = null;
export function getFloorCanvas(): HTMLCanvasElement {
  if (floorCanvas) return floorCanvas;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  const rnd = seeded(0x3f19);

  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, S, S);

  // 低頻髒污 / 濕氣。月台地面在夜裡最怕的是「一塊完全平的深灰」
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S, y = rnd() * S, rx = 40 + rnd() * 140, ry = 40 + rnd() * 140;
    const a = 0.03 + rnd() * 0.08;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) blot(g, x + ox, y + oy, rx, ry, "#000000", a);
  }
  // 磁磚縫:128px 一格。x=0 那條要拆成左右兩半畫,tile 接起來才是完整一條
  g.fillStyle = "rgba(0,0,0,0.07)";
  for (const p of [128, 256, 384]) {
    g.fillRect(p - 0.8, 0, 1.6, S);
    g.fillRect(0, p - 0.8, S, 1.6);
  }
  g.fillRect(0, 0, 0.8, S);
  g.fillRect(S - 0.8, 0, 0.8, S);
  g.fillRect(0, 0, S, 0.8);
  g.fillRect(0, S - 0.8, S, 0.8);
  // 濕地板的縱向反光(相機看向 -z,拉長的高光才讀得出「地是濕的」)
  for (let i = 0; i < 10; i++) {
    const x = rnd() * S, y = rnd() * S;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      blot(g, x + ox, y + oy, 8 + rnd() * 16, 60 + rnd() * 110, "#ffffff", 0.05 + rnd() * 0.05);
    }
  }

  floorCanvas = c;
  return c;
}

// ── 車體外側牆面 ─────────────────────────────────────────────────────────────
// 同樣是「平均接近白」的明暗貼圖:三塊牆共用一個材質,color 不變。
// 車體是鋁擠型,紋路縱向;夜裡幾乎全黑,只要讓它別是一塊死平的色就好。
let wallCanvas: HTMLCanvasElement | null = null;
export function getWallCanvas(): HTMLCanvasElement {
  if (wallCanvas) return wallCanvas;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  const rnd = seeded(0x7b03);

  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 18; i++) {
    const x = rnd() * S, y = rnd() * S, rx = 60 + rnd() * 160, ry = 60 + rnd() * 160;
    const dark = rnd() < 0.6;
    const a = 0.03 + rnd() * 0.06;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) blot(g, x + ox, y + oy, rx, ry, dark ? "#000000" : "#ffffff", a);
  }
  for (let i = 0; i < 90; i++) {
    const x = rnd() * S;
    const light = rnd() < 0.45;
    g.fillStyle = light ? `rgba(255,255,255,${0.02 + rnd() * 0.03})` : `rgba(0,0,0,${0.02 + rnd() * 0.04})`;
    g.fillRect(x, 0, 1 + rnd() * 2, S);
  }

  wallCanvas = c;
  return c;
}

// ── 暖光灑地的光楔 ───────────────────────────────────────────────────────────
// v=1(貼圖上緣)= 門口那側:窄而亮;v=0 = 遠離門的那側:寬而淡。
// 這是 additive 平面,alpha 靠亮度表現(黑 = 完全不加光),所以直接畫灰階。
// 解析度從 128×96 拉到 256×192 並疊上柔和不勻:數學上完美對稱的光斑會讓人
// 一眼看出是程式畫的,門後的 cabin.jpg 沒有任何一塊光是這樣的。
let wedgeCanvas: HTMLCanvasElement | null = null;
export function getWedgeCanvas(): HTMLCanvasElement {
  if (wedgeCanvas) return wedgeCanvas;
  const W = 256, N = 192;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = N;
  const g = c.getContext("2d")!;
  const rnd = seeded(0x2ce7);
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, N);
  for (let row = 0; row < N; row++) {
    const v = 1 - row / (N - 1); // row 0 = 貼圖上緣 = v=1 = 門口
    const half = (0.34 + (1 - v) * 0.16) * W; // 離門越遠越寬(光是從門口這個開口打出去的)
    const a = Math.pow(v, 1.6) * 0.95; // 離門越遠越淡
    const grad = g.createLinearGradient(W / 2 - half, 0, W / 2 + half, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.28, `rgba(255,255,255,${(a * 0.45).toFixed(3)})`);
    grad.addColorStop(0.5, `rgba(255,255,255,${a.toFixed(3)})`);
    grad.addColorStop(0.72, `rgba(255,255,255,${(a * 0.45).toFixed(3)})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, row, W, 1);
  }
  // 光斑的不勻:亮的地方更亮、暗的地方吃掉一點。additive 貼圖上黑就是不加光,
  // 所以「畫黑」= 挖出一塊沒被照到的地(磁磚的凹凸、地上的水痕)。
  for (let i = 0; i < 14; i++) {
    const y = rnd() * N * 0.8;
    blot(g, W / 2 + (rnd() - 0.5) * W * 0.5, y, 20 + rnd() * 50, 14 + rnd() * 40, rnd() < 0.5 ? "#ffffff" : "#000000", 0.06 + rnd() * 0.1);
  }
  wedgeCanvas = c;
  return c;
}

// ── 門縫漏光 ─────────────────────────────────────────────────────────────────
// 一條中央最亮、往兩側指數衰減的直光柱(additive)。垂直方向從「完全均勻」改成
// 中段稍亮:一條上下等亮的光柱看起來像一根日光燈管,而這是門縫 —— 光是從
// 車內某處漏出來的,強度本來就不勻。
let slitCanvas: HTMLCanvasElement | null = null;
export function getSlitCanvas(): HTMLCanvasElement {
  if (slitCanvas) return slitCanvas;
  const W = 64, H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  // 逐列畫,把垂直起伏直接乘進 alpha。不能改用 globalCompositeOperation="multiply"
  // 疊一層灰:multiply 的 alpha 走的是 source-over,填一塊不透明灰會把整張貼圖的
  // alpha 推成 1 —— 水平衰減整個消失,光柱變成一塊白板。
  for (let row = 0; row < H; row++) {
    const t = row / (H - 1);
    // 中上段最亮(光是從車內某處漏出來的,不是一根上下等亮的日光燈管)
    const k = 0.55 + 0.45 * Math.sin(Math.PI * Math.pow(t, 0.85));
    const grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.3, `rgba(255,255,255,${(0.12 * k).toFixed(3)})`);
    grad.addColorStop(0.42, `rgba(255,255,255,${(0.4 * k).toFixed(3)})`);
    grad.addColorStop(0.5, `rgba(255,255,255,${k.toFixed(3)})`);
    grad.addColorStop(0.58, `rgba(255,255,255,${(0.4 * k).toFixed(3)})`);
    grad.addColorStop(0.7, `rgba(255,255,255,${(0.12 * k).toFixed(3)})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, row, W, 1);
  }
  slitCanvas = c;
  return c;
}

import type { SceneType } from "@/content/stations";

// 像素窗景渲染(重新設計:多層次視差 + 大氣細節)。
// 背景元素先畫(bg/full 皆有,tile 無縫);單一地標放在 if(!bg) 末段(只在中段出現一次)。
const bay = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function drawScene(canvas: HTMLCanvasElement, type: SceneType, opts: { bg?: boolean } = {}) {
  const bg = !!opts.bg;
  const K = 2, W = 208, H = 130, DW = W * K, DH = H * K;
  canvas.width = DW;
  canvas.height = DH;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const dith = (dx: number, dy: number, t: number) => bay[dy & 3][dx & 3] / 16 < t;
  const PX = (dx: number, dy: number, c: string) => { g.fillStyle = c; g.fillRect(dx, dy, 1, 1); };
  const R = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x * K), Math.round(y * K), Math.max(1, Math.round(w * K)), Math.max(1, Math.round(h * K)));
  };
  const rnd = ((s: number) => () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff))(type.length * 97 + 7);
  // 垂直漸層 + 抖色
  function grad(y0: number, y1: number, stops: [number, string][]) {
    for (let dy = y0 * K; dy < y1 * K; dy++) {
      const f = (dy / K - y0) / (y1 - y0);
      let i = 0;
      while (i < stops.length - 1 && f > stops[i + 1][0]) i++;
      const j = Math.min(i + 1, stops.length - 1);
      const a = stops[i][1], b = stops[j][1], seg = (f - stops[i][0]) / ((stops[j][0] - stops[i][0]) || 1);
      for (let dx = 0; dx < DW; dx++) PX(dx, dy, dith(dx, dy, seg) ? b : a);
    }
  }
  function disc(cx: number, cy: number, r: number, c: string, glow: number) {
    for (let dy = (cy - r - glow) * K; dy < (cy + r + glow) * K; dy++)
      for (let dx = (cx - r - glow) * K; dx < (cx + r + glow) * K; dx++) {
        const d = Math.hypot(dx / K - cx, dy / K - cy);
        if (d < r) PX(dx, dy, c);
        else if (d < r + glow && dith(dx, dy, 1 - (d - r) / glow)) PX(dx, dy, c);
      }
  }
  // 遠山/剪影稜線:crest 到 bottom 填色
  function ridge(crest: number, bottom: number, color: string, a1: number, a2: number, ph: number, freq = 0.05) {
    for (let x = 0; x < W; x++) {
      const h = (crest + Math.sin(x * freq + ph) * a1 + Math.sin(x * freq * 2.7 + ph * 1.6) * a2) | 0;
      for (let dy = h * K; dy < bottom * K; dy++) { PX(x * K, dy, color); PX(x * K + 1, dy, color); }
    }
  }
  function stars(n: number, maxY: number) {
    for (let i = 0; i < n; i++) { const sx = (rnd() * W) | 0, sy = (rnd() * maxY) | 0; PX(sx * K, sy * K, rnd() > 0.6 ? "#eaf2ff" : "#9fb6e0"); }
  }
  // 一排建築(含亮窗),tile 用
  function skyline(baseY: number, minH: number, maxH: number, color: string, lit: boolean, roof = false) {
    let x = 0;
    while (x < W) {
      const w = 4 + ((rnd() * 14) | 0), h = minH + ((rnd() * (maxH - minH)) | 0);
      R(x, baseY - h, w, h, color);
      if (roof) {
        if (rnd() > 0.6) R(x + (w >> 1), baseY - h - 4, 1, 4, color); // 天線
        if (rnd() > 0.72) R(x + 1, baseY - h - 2, 3, 2, color); // 水塔
        if (rnd() > 0.85) R(x + (w >> 1), baseY - h - 4, 1, 1, "#ff5a4a"); // 航警紅燈
      }
      if (lit) for (let ly = baseY - h + 2; ly < baseY - 1; ly += 3) for (let lx = x + 1; lx < x + w - 1; lx += 3) if (rnd() > 0.5) R(lx, ly, 1, 1, rnd() > 0.78 ? "#bfe0ff" : "#ffcf7a");
      x += w + 1 + ((rnd() * 3) | 0);
    }
  }
  function waves(y0: number, color: string, amp: number) {
    for (let wy = y0; wy < H; wy += 3) for (let dx = 0; dx < DW; dx++) { const t = (1 - (wy - y0) / (H - y0)) * amp; if (dith(dx, wy * K, t)) PX(dx, wy * K, color); }
  }
  function reflectCol(cx: number, y0: number, color: string, alpha: number) {
    for (let dy = y0 * K; dy < DH; dy++) { const t = (1 - (dy / K - y0) / (H - y0)) * alpha; for (let dx = (cx - 3) * K; dx < (cx + 3) * K; dx++) if (dith(dx, dy + cx * 5, t)) PX(dx, dy, color); }
  }
  function cloud(cx: number, cy: number, color: string) {
    ([[0, 0, 11, 3], [3, -2, 6, 2], [-3, 1, 5, 2], [7, 1, 4, 2]] as number[][]).forEach(([ox, oy, w, h]) => R(cx + ox, cy + oy, w, h, color));
  }

  if (type === "platform") {
    // 夜間月台:暗、暖燈光池、黃色警戒線、綠色站名燈牌
    grad(0, 20, [[0, "#0a1120"], [1, "#151f30"]]);
    R(0, 0, W, 9, "#080d15"); // 頂棚
    R(0, 3, W, 1, "#2a3546"); for (let x = 5; x < W; x += 24) R(x, 2, 15, 2, "#fff2cf"); // 頂棚日光燈條
    R(0, 20, W, H, "#0e1622"); // 對向牆
    for (let x = 18; x < W; x += 46) { // 對向牆廣告海報(可重複)
      R(x, 26, 13, 22, "#1a2740");
      R(x + 1, 27, 11, 14, ["#3a5a8a", "#7a5238", "#39674f", "#6a3a58"][(x / 46 | 0) % 4]);
      R(x + 2, 42, 9, 1, "#8792a8"); R(x + 2, 44, 6, 1, "#5a6376");
    }
    for (let i = 0; i < 6; i++) { // 立柱 + 頂燈 + 光池 + 長椅
      const px = 6 + i * 40;
      R(px, 9, 6, 60, "#0a0f18"); R(px, 9, 1, 60, "#141c2a"); // 柱身+高光
      R(px - 1, 7, 8, 2, "#fff2cf");
      for (let dy = 9 * K; dy < 46 * K; dy++) for (let dx = (px - 4) * K; dx < (px + 10) * K; dx++) {
        const t = (1 - Math.abs(dx / K - (px + 3)) / 8) * (1 - (dy / K - 9) / 37) * 0.5;
        if (t > 0.05 && dith(dx, dy, t)) PX(dx, dy, "rgba(255,236,190,0.32)");
      }
      R(px - 6, 52, 18, 6, "#101826"); R(px - 6, 51, 18, 1, "#1c2a40"); // 長椅+椅背高光
    }
    for (let x = 30; x < W; x += 80) { R(x, 11, 20, 7, "#071a10"); for (let sx = x + 2; sx < x + 18; sx += 3) R(sx, 13, 2, 3, "#06ff31"); } // 吊掛方向牌(可重複)
    R(0, 92, W, 4, "#f2c230"); for (let x = 0; x < W; x += 8) R(x, 92, 4, 4, "#c99a1a"); // 警戒線
    R(0, 96, W, H, "#0c121b"); // 月台地面
    for (let dy = 96 * K; dy < DH; dy++) for (let dx = 0; dx < DW; dx++) { const t = (1 - (dy / K - 96) / 34) * 0.3; if (dith(dx, dy, t)) PX(dx, dy, "rgba(255,220,150,0.10)"); }
    for (let x = 0; x < W; x += 12) R(x, 104, 7, 1, "rgba(255,230,170,0.10)"); // 地磚反光線
    if (!bg) {
      // 站名燈牌:台北
      R(70, 27, 68, 23, "#04120a"); R(72, 29, 64, 19, "#0a2413"); R(72, 29, 64, 1, "#12401f");
      g.fillStyle = "#2bff66"; g.font = "bold 22px 'PingFang TC','Noto Sans TC',sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("台北", 104 * K, 39 * K);
      g.textAlign = "left"; g.textBaseline = "alphabetic";
      // 壁掛時鐘
      disc(28, 20, 5, "#0d2438", 0); disc(28, 20, 4, "#e6edf4", 0);
      R(28, 17, 1, 3, "#1a2836"); R(28, 20, 3, 1, "#1a2836");
    }
  } else if (type === "city") {
    // 電商推薦系統:黃昏城市(紫→橘→琥珀,三層天際線)
    grad(0, 80, [[0, "#3a2350"], [0.32, "#a83a2e"], [0.58, "#e8792a"], [0.78, "#f4b45c"], [0.8, "#120e18"]]);
    for (const [cx, cy] of [[34, 14], [96, 10], [176, 20]] as number[][]) cloud(cx, cy, "rgba(74,44,66,0.72)"); // 黃昏雲帶
    ridge(66, 82, "#241a2e", 3, 2, 0.4); // 遠山/霧帶
    skyline(74, 8, 22, "#1a1420", false); // 遠景剪影
    skyline(82, 16, 42, "#0d0a12", true, true);  // 中景亮窗+屋頂
    R(0, 82, W, H, "#0a0810");
    skyline(96, 10, 30, "#080609", true, true);  // 近景(較高、較暗)+屋頂
    if (!bg) {
      disc(150, 30, 8, "#ffdca0", 10); // 夕陽
      for (const [bx, by] of [[46, 22], [128, 16]] as number[][]) { R(bx, by, 3, 1, "#241a2e"); R(bx + 2, by, 3, 1, "#241a2e"); } // 歸鳥
    }
  } else if (type === "river") {
    // LINE LIFF:夜間跨河大橋 + 月光倒影
    grad(0, 84, [[0, "#060a18"], [0.5, "#0d1c38"], [0.78, "#183a60"], [0.8, "#0a1526"]]);
    stars(34, 50);
    for (const [cx, cy] of [[28, 12], [132, 8]] as number[][]) cloud(cx, cy, "rgba(14,26,48,0.85)"); // 夜雲
    ridge(58, 66, "#0a1424", 3, 2, 1.2); // 遠岸城市剪影帶
    for (let x = 2; x < W; x += 5) if (rnd() > 0.5) R(x, 60 + ((rnd() * 4) | 0), 1, 1, "#ffb26a"); // 遠岸燈火
    for (let x = 3; x < W; x += 7) R(x, 65, 1, 1, "#7fd0ff"); // 河濱步道燈(可重複)
    // 全寬連續斜張橋(等距橋塔 + 斜張索 + 橋面),塔距=52 可無縫平移
    for (let tx = 26; tx < W; tx += 52) {
      for (let d = -22; d <= 22; d += 5) for (let t = 0; t <= 12; t++) { const px = (tx + 1 + (d * t) / 12) | 0, py = (44 + ((82 - 44) * t) / 12) | 0; R(px, py, 1, 1, "#22334a"); } // 斜張索
      R(tx, 40, 2, 44, "#283a52"); R(tx - 1, 38, 4, 3, "#324663"); // 橋塔
    }
    R(0, 82, W, 2, "#3a5876"); // 橋面
    for (let x = 4; x < W; x += 7) R(x, 80, 2, 2, "#ffd27a"); // 橋面燈串(滿屏)
    R(0, 84, W, H, "#08111f"); // 水面
    waves(86, "rgba(90,140,200,0.4)", 0.3);
    for (let x = 4; x < W; x += 7) for (let dy = 85 * K; dy < 95 * K; dy++) { const t = (1 - (dy / K - 85) / 10) * 0.5; for (let dx = x * K; dx < (x + 2) * K; dx++) if (dith(dx, dy, t)) PX(dx, dy, "rgba(255,210,120,0.42)"); } // 橋燈倒影(滿屏)
    for (let x = 24; x < W; x += 58) { R(x, 92 + ((rnd() * 12) | 0), 4, 1, "#0a1420"); } // 河上小船(可重複)
    if (!bg) {
      disc(150, 26, 9, "#eaf0d8", 6); // 月亮
      reflectCol(150, 86, "rgba(234,240,216,0.5)", 0.6); // 月光柱
    }
  } else if (type === "taipei") {
    // AI 工具整合:深夜台北(城市光害的橙灰天幕、遠山剪影、101 點燈、密集亮窗)
    // 一輛夜間區間車在深夜經過台北,看到 101 亮著燈 —— 這才是「夜車」該有的第 4 站。
    grad(0, 66, [[0, "#050a16"], [0.42, "#0a1122"], [0.72, "#152036"], [0.9, "#2b2f44"], [1, "#463a44"]]); // 地平線被光害染成暖灰
    stars(26, 30); // 只有高處看得到星,低空全被城市光洗掉
    for (const [cx, cy] of [[54, 12], [128, 20], [176, 9], [92, 6]] as number[][]) cloud(cx, cy, "rgba(38,44,66,0.85)"); // 夜雲(下緣被地面光染)
    ridge(42, 68, "#131b2c", 6, 4, 2.2); // 最遠山(離光害最近,最亮)
    ridge(50, 68, "#0d1422", 5, 3, 0.2); // 遠山
    ridge(58, 68, "#080d18", 4, 2, 1.4); // 近山
    skyline(78, 10, 26, "#0e1420", true, true); // 遠樓+屋頂(零星亮窗)
    skyline(106, 16, 44, "#080c14", true, true); // 密集城市+屋頂(亮窗暖白)
    R(0, 106, W, H, "#0d1018"); R(0, 106, W, 2, "#161b26"); for (let x = 0; x < W; x += 14) R(x, 114, 7, 2, "#3a3c34"); // 街道(車道線在夜裡只剩微反光)
    for (let x = 4; x < W; x += 9) R(x, 108, 2, 1, ["#fff0c8", "#ff3a2a"][(x / 9 | 0) % 2]); // 車流燈:頭燈白 / 尾燈紅(可重複)
    for (let x = 6; x < W; x += 18) { R(x, 100, 1, 7, "#141a24"); R(x - 1, 99, 3, 1, "#ffd9a0"); } // 路燈桿+燈頭(可重複)
    if (!bg) {
      const tx = 128; // 台北 101(夜間點燈)
      R(tx - 1, 12, 2, 12, "#1c2740"); R(tx, 11, 1, 1, "#ff5a4a"); // 尖塔 + 塔頂航警紅燈
      R(tx - 6, 24, 12, 4, "#16203a");
      for (let s = 0; s < 8; s++) {
        const y = 28 + s * 8;
        R(tx - 8, y, 16, 8, "#111a2c"); R(tx - 9, y, 18, 2, "#1b2740"); R(tx - 8, y + 7, 16, 1, "#0a1120"); // 斗身 + 斗簷 + 分層陰影
        R(tx - 9, y + 1, 18, 1, "rgba(90,150,220,0.55)"); // 斗簷泛光(101 夜間的藍色輪廓燈)
        for (let lx = tx - 7; lx < tx + 7; lx += 2) if (rnd() > 0.32) R(lx, y + 3, 1, 3, rnd() > 0.72 ? "#bfe0ff" : "#ffcf7a"); // 逐層亮窗 = 點燈
      }
      R(tx - 13, 92, 26, 14, "#0c1320"); R(tx - 13, 92, 26, 1, "#1b2740"); // 裙樓
      for (let lx = tx - 11; lx < tx + 12; lx += 3) R(lx, 96, 2, 2, "#ffcf7a"); // 裙樓臨街亮窗
      for (let dy = 30 * K; dy < 91 * K; dy += 2) for (let dx = (tx - 6) * K; dx < (tx + 6) * K; dx += 3) if ((dx + dy) % 4 < 2) PX(dx, dy, "rgba(140,190,240,0.14)"); // 玻璃幕牆微反光
    }
  } else if (type === "field") {
    // 技能:凌晨田野(blue hour,黎明前最暗的一段:稻田映著微光、電線桿剪影、零星農舍燈火)
    // 曲線上這是最後的谷底,下一站就天亮 —— 黎明前的準備。
    grad(0, 78, [[0, "#070d1e"], [0.28, "#101c38"], [0.5, "#22355c"], [0.62, "#4a5e80"], [0.66, "#2a3446"], [0.68, "#141c22"], [1, "#0a1014"]]);
    stars(18, 24); // 天頂殘星(離天亮還有一會兒)
    for (let i = 0; i < 3; i++) { const bx = 20 + ((rnd() * 170) | 0); R(bx, 14 + ((rnd() * 8) | 0), 3, 1, "#0e1626"); R(bx + 2, 14, 3, 1, "#0e1626"); } // 遠鳥(早班)
    ridge(52, 66, "#121c2c", 6, 3, 0.3); // 遠山
    ridge(62, 78, "#0b1220", 4, 2, 1.1); // 近山
    for (let x = 8; x < W; x += 46) { R(x, 73, 4, 5, "#0a1018"); R(x + 5, 75, 3, 3, "#0a1018"); R(x + 6, 76, 1, 1, "#ffcf7a"); } // 遠方村落(山腳,可重複)
    R(0, 78, W, H, "#0e1620"); // 稻田
    // 田水映天光(冷)。alpha 是這一站的可讀性關鍵:blue hour 的地面幾乎沒有自體亮度,
    // 全靠水面反射天空 —— 反射太弱,下半窗就會塌成一塊死黑,像素語彙整個消失。
    for (let ry = 82; ry < H; ry += 5) for (let dx = 0; dx < DW; dx++) { const t = (1 - (ry - 82) / (H - 82)) * 0.5; if (dith(dx, ry * K, t)) PX(dx, ry * K, "rgba(130,172,225,0.5)"); }
    for (let ry = 84; ry < H; ry += 6) R(0, ry, W, 1, "rgba(6,12,18,0.5)"); // 田埂線
    for (let x = 26; x < W; x += 54) { R(x, 68, 1, 20, "#060b12"); R(x - 3, 70, 7, 1, "#060b12"); } // 電線桿+橫擔(可重複)
    for (let x = 26; x < W; x += 54) for (let sx = x; sx < x + 54 && sx < W; sx++) { const y = (71 + (1 - Math.cos((sx - x) / 54 * Math.PI * 2)) * 2) | 0; R(sx, y, 1, 1, "#060b12"); } // 電線
    for (let i = 0; i < 6; i++) R((rnd() * W) | 0, 90 + ((rnd() * 22) | 0), 1, 1, "#8fa8c0"); // 稻田白鷺(可重複,只剩剪影的亮邊)
    for (let i = 0; i < 7; i++) R(14 + i * 27 + ((rnd() * 8) | 0), 56 + ((rnd() * 4) | 0), 1, 1, "#ffd27a"); // 零星燈火
    if (!bg) {
      PX(150 * K, 30 * K, "#ffffff"); PX(150 * K + 1, 30 * K, "#dbe6ff"); // 晨星(金星):凌晨天空唯一的亮點,不是太陽
      R(96, 66, 3, 12, "#060b12"); R(93, 60, 9, 8, "#050910"); // 孤樹
      R(150, 66, 12, 8, "#060b12"); R(151, 62, 10, 4, "#050910"); R(154, 64, 2, 2, "#ffcf7a"); // 農舍(亮窗:唯一的暖色)
      R(60, 80, 1, 10, "#141a20"); R(56, 82, 9, 1, "#141a20"); disc(60, 78, 2, "#2a3140", 0); R(58, 79, 1, 1, "#080a0e"); R(61, 79, 1, 1, "#080a0e"); // 稻草人
    }
  } else if (type === "sea") {
    // 終點:南迴海景・破曉(靛→桃→橘,日出、倒影柱、海浪、岬角、小船)
    grad(0, 72, [[0, "#141f3e"], [0.3, "#7a3450"], [0.48, "#d2603e"], [0.6, "#f0985a"], [0.66, "#f6cf94"], [0.7, "#0c2338"], [1, "#06121f"]]);
    stars(14, 22);
    for (const [cx, cy] of [[36, 24], [128, 18]] as number[][]) { cloud(cx, cy, "rgba(88,52,58,0.8)"); R(cx - 2, cy + 3, 12, 1, "rgba(240,152,90,0.5)"); } // 破曉雲(暖底光)
    ridge(58, 72, "#0e2436", 3, 2, 0.8); // 遠方海岸線
    R(0, 72, W, H, "#0a1c2e"); // 海面
    waves(74, "rgba(130,175,215,0.34)", 0.32);
    for (let x = 30; x < W; x += 62) { const sy = 78 + ((rnd() * 8) | 0); R(x, sy - 5, 1, 5, "#0a1620"); R(x - 3, sy - 5, 4, 4, "#12283a"); } // 帆船(可重複)
    for (let x = 4; x < W; x += 6) R(x, 120 + ((rnd() * 6) | 0), 3, 1, "rgba(200,224,240,0.35)"); // 近岸浪花(可重複)
    if (!bg) {
      disc(96, 46, 9, "#ffe9c2", 11); // 破曉的太陽
      reflectCol(96, 72, "rgba(255,214,140,0.6)", 0.7); // 陽光倒影柱
      for (let x = 158; x < 200; x++) { const c = (58 - (x - 158) * 0.28) | 0; R(x, c, 1, 72 - c, "#08161f"); } // 岬角
      R(178, 40, 3, 12, "#e6ddc8"); R(177, 38, 5, 2, "#c94a3a"); R(178, 38, 3, 1, "#fff0cc"); R(178, 44, 3, 1, "#b8402f"); // 岬角燈塔
      R(60, 68, 10, 4, "#0a1620"); R(64, 64, 1, 5, "#0a1620"); // 小船
      for (const [bx, by] of [[40, 30], [120, 24], [150, 34]] as number[][]) { R(bx, by, 3, 1, "#1a2a3a"); R(bx + 2, by, 3, 1, "#1a2a3a"); } // 海鳥
    }
  }
}

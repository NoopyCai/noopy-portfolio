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
  function skyline(baseY: number, minH: number, maxH: number, color: string, lit: boolean) {
    let x = 0;
    while (x < W) {
      const w = 4 + ((rnd() * 14) | 0), h = minH + ((rnd() * (maxH - minH)) | 0);
      R(x, baseY - h, w, h, color);
      if (lit) for (let ly = baseY - h + 2; ly < baseY - 1; ly += 3) for (let lx = x + 1; lx < x + w - 1; lx += 3) if (rnd() > 0.5) R(lx, ly, 1, 1, "#ffcf7a");
      x += w + 1 + ((rnd() * 3) | 0);
    }
  }
  function waves(y0: number, color: string, amp: number) {
    for (let wy = y0; wy < H; wy += 3) for (let dx = 0; dx < DW; dx++) { const t = (1 - (wy - y0) / (H - y0)) * amp; if (dith(dx, wy * K, t)) PX(dx, wy * K, color); }
  }
  function reflectCol(cx: number, y0: number, color: string, alpha: number) {
    for (let dy = y0 * K; dy < DH; dy++) { const t = (1 - (dy / K - y0) / (H - y0)) * alpha; for (let dx = (cx - 3) * K; dx < (cx + 3) * K; dx++) if (dith(dx, dy + cx * 5, t)) PX(dx, dy, color); }
  }

  if (type === "platform") {
    // 夜間月台:暗、暖燈光池、黃色警戒線、綠色站名燈牌
    grad(0, 20, [[0, "#0a1120"], [1, "#151f30"]]);
    R(0, 0, W, 9, "#080d15"); // 頂棚
    R(0, 20, W, H, "#0e1622"); // 對向牆
    for (let i = 0; i < 6; i++) { // 立柱 + 頂燈 + 光池
      const px = 6 + i * 40;
      R(px, 9, 6, 60, "#0a0f18");
      R(px - 1, 7, 8, 2, "#fff2cf");
      for (let dy = 9 * K; dy < 46 * K; dy++) for (let dx = (px - 4) * K; dx < (px + 10) * K; dx++) {
        const t = (1 - Math.abs(dx / K - (px + 3)) / 8) * (1 - (dy / K - 9) / 37) * 0.5;
        if (t > 0.05 && dith(dx, dy, t)) PX(dx, dy, "rgba(255,236,190,0.32)");
      }
      R(px - 6, 52, 18, 6, "#101826"); // 長椅
    }
    R(0, 92, W, 4, "#f2c230"); for (let x = 0; x < W; x += 8) R(x, 92, 4, 4, "#c99a1a"); // 警戒線
    R(0, 96, W, H, "#0c121b"); // 月台地面
    for (let dy = 96 * K; dy < DH; dy++) for (let dx = 0; dx < DW; dx++) { const t = (1 - (dy / K - 96) / 34) * 0.3; if (dith(dx, dy, t)) PX(dx, dy, "rgba(255,220,150,0.10)"); }
    if (!bg) { R(74, 30, 60, 20, "#05110a"); R(76, 32, 56, 16, "#0a1f10"); for (let x = 82; x < 126; x += 4) R(x, 38, 2, 6, "#06ff31"); } // 站名燈牌
  } else if (type === "city") {
    // 電商推薦系統:黃昏城市(紫→橘→琥珀,三層天際線)
    grad(0, 80, [[0, "#3a2350"], [0.32, "#a83a2e"], [0.58, "#e8792a"], [0.78, "#f4b45c"], [0.8, "#120e18"]]);
    ridge(66, 82, "#241a2e", 3, 2, 0.4); // 遠山/霧帶
    skyline(74, 8, 22, "#1a1420", false); // 遠景剪影
    skyline(82, 16, 42, "#0d0a12", true);  // 中景亮窗
    R(0, 82, W, H, "#0a0810");
    skyline(96, 10, 30, "#080609", true);  // 近景(較高、較暗)
    if (!bg) disc(150, 30, 8, "#ffdca0", 10); // 夕陽
  } else if (type === "river") {
    // LINE LIFF:夜間跨河大橋 + 月光倒影
    grad(0, 84, [[0, "#060a18"], [0.5, "#0d1c38"], [0.78, "#183a60"], [0.8, "#0a1526"]]);
    stars(26, 46);
    ridge(58, 66, "#0a1424", 3, 2, 1.2); // 遠岸城市剪影帶
    for (let x = 2; x < W; x += 5) if (rnd() > 0.5) R(x, 60 + ((rnd() * 4) | 0), 1, 1, "#ffb26a"); // 遠岸燈火
    R(0, 84, W, H, "#08111f"); // 水面
    waves(86, "rgba(90,140,200,0.4)", 0.3);
    if (!bg) {
      disc(150, 26, 9, "#eaf0d8", 6); // 月亮
      // 懸索橋:塔 + 主纜 + 吊索 + 橋面 + 燈串
      R(52, 40, 3, 46, "#26374f"); R(150, 40, 3, 46, "#26374f");
      for (let x = 55; x < 150; x++) { const y = (52 + Math.cosh((x - 101) / 40) * 6) | 0; R(x, y, 1, 1, "#4a6580"); if (x % 8 === 0) R(x, y, 1, 84 - y, "#1c2a3c"); }
      R(0, 84, W, 2, "#33506e"); for (let x = 6; x < W; x += 12) R(x, 82, 2, 2, "#ffd27a");
      reflectCol(150, 86, "rgba(234,240,216,0.5)", 0.6); // 月光柱
      [60, 110, 168].forEach((cx) => reflectCol(cx, 88, "rgba(255,210,120,0.4)", 0.4)); // 橋燈倒影
    }
  } else if (type === "taipei") {
    // AI 工具整合:白晝台北(藍天雲、遠山、101、密集城市)
    grad(0, 66, [[0, "#4f9fe0"], [0.55, "#95c8ee"], [0.9, "#d6ebf7"], [1, "#eef5fb"]]);
    for (const [cx, cy] of [[54, 12], [128, 20], [176, 10]] as number[][]) ([[0, 0, 10, 3], [3, -2, 6, 2], [-3, 1, 5, 2]] as number[][]).forEach(([ox, oy, w, h]) => R(cx + ox, cy + oy, w, h, "#f6fafd"));
    ridge(50, 68, "#7fa890", 5, 3, 0.2); // 遠山(較亮)
    ridge(58, 68, "#5f8a72", 4, 2, 1.4); // 近山
    skyline(78, 10, 26, "#8a94a0", false); // 遠樓
    skyline(106, 16, 44, "#7d8791", true); // 密集城市(亮窗改暖白)
    R(0, 106, W, H, "#3a3f45"); R(0, 106, W, 2, "#4a4f55"); for (let x = 0; x < W; x += 14) R(x, 114, 7, 2, "#d8d2b8"); // 街道
    if (!bg) {
      disc(30, 16, 6, "#fff6d8", 9); // 太陽
      const tx = 128; // 台北 101
      R(tx - 1, 12, 2, 12, "#9fb8b2"); R(tx - 6, 24, 12, 4, "#7fa199");
      for (let s = 0; s < 8; s++) { const y = 28 + s * 8; R(tx - 8, y, 16, 8, "#6f9e94"); R(tx - 9, y, 18, 2, "#8fbcb1"); R(tx - 8, y + 7, 16, 1, "#4d7168"); }
      R(tx - 13, 92, 26, 14, "#5c7f77"); R(tx - 13, 92, 26, 1, "#7fa199");
      for (let dy = 30 * K; dy < 91 * K; dy += 2) for (let dx = (tx - 6) * K; dx < (tx + 6) * K; dx += 3) if ((dx + dy) % 4 < 2) PX(dx, dy, "rgba(232,246,243,0.25)");
    }
  } else if (type === "field") {
    // 技能:田野黃昏(golden hour,遠山、稻田倒影、農舍、孤樹)
    grad(0, 78, [[0, "#3a5c8c"], [0.3, "#e88a3a"], [0.55, "#f4c66a"], [0.66, "#5a4a26"], [0.68, "#2c3c1e"], [1, "#16240f"]]);
    for (let i = 0; i < 3; i++) { const bx = 20 + ((rnd() * 170) | 0); R(bx, 14 + ((rnd() * 8) | 0), 3, 1, "#1a2416"); R(bx + 2, 14, 3, 1, "#1a2416"); } // 遠鳥
    ridge(52, 66, "#3a4a2c", 6, 3, 0.3); // 遠山
    ridge(62, 78, "#243018", 4, 2, 1.1); // 近山
    R(0, 78, W, H, "#16210f"); // 稻田
    for (let ry = 82; ry < H; ry += 5) for (let dx = 0; dx < DW; dx++) { const t = (1 - (ry - 82) / (H - 82)) * 0.42; if (dith(dx, ry * K, t)) PX(dx, ry * K, "rgba(244,180,96,0.45)"); } // 田水映天光
    for (let ry = 84; ry < H; ry += 6) R(0, ry, W, 1, "rgba(20,30,12,0.5)"); // 田埂線
    for (let i = 0; i < 7; i++) R(14 + i * 27 + ((rnd() * 8) | 0), 56 + ((rnd() * 4) | 0), 1, 1, "#ffd27a"); // 零星燈火
    if (!bg) {
      disc(150, 42, 9, "#ffe6b0", 8); // 低空夕陽
      R(96, 66, 3, 12, "#0e160a"); R(93, 60, 9, 8, "#0c1408"); // 孤樹
      R(150, 66, 12, 8, "#0e160a"); R(151, 62, 10, 4, "#0c1408"); R(154, 64, 2, 2, "#ffcf7a"); // 農舍(亮窗)
    }
  } else if (type === "sea") {
    // 終點:南迴海景・破曉(靛→桃→橘,日出、倒影柱、海浪、岬角、小船)
    grad(0, 72, [[0, "#141f3e"], [0.3, "#7a3450"], [0.48, "#d2603e"], [0.6, "#f0985a"], [0.66, "#f6cf94"], [0.7, "#0c2338"], [1, "#06121f"]]);
    stars(14, 22);
    ridge(58, 72, "#0e2436", 3, 2, 0.8); // 遠方海岸線
    R(0, 72, W, H, "#0a1c2e"); // 海面
    waves(74, "rgba(130,175,215,0.34)", 0.32);
    if (!bg) {
      disc(96, 46, 9, "#ffe9c2", 11); // 破曉的太陽
      reflectCol(96, 72, "rgba(255,214,140,0.6)", 0.7); // 陽光倒影柱
      for (let x = 158; x < 200; x++) { const c = (58 - (x - 158) * 0.28) | 0; R(x, c, 1, 72 - c, "#08161f"); } // 岬角
      R(60, 68, 10, 4, "#0a1620"); R(64, 64, 1, 5, "#0a1620"); // 小船
      for (const [bx, by] of [[40, 30], [120, 24], [150, 34]] as number[][]) { R(bx, by, 3, 1, "#1a2a3a"); R(bx + 2, by, 3, 1, "#1a2a3a"); } // 海鳥
    }
  }
}

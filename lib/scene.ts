import type { SceneType } from "@/content/stations";

// 像素窗景渲染 — 移植自 design-system/car-ride.html(已驗證的原型),演算法不變。
// bg:true 時略過單一地標(月亮/太陽/101/漁舍/船/岬角),供側窗使用。
const bay = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function drawScene(
  canvas: HTMLCanvasElement,
  type: SceneType,
  opts: { bg?: boolean } = {}
) {
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

  if (type === "city") {
    grad(0, H, [[0, "#b2380c"], [0.4, "#ea8330"], [0.62, "#f2ac57"], [0.66, "#141810"], [1, "#0a0d0a"]]);
    let x = 0;
    while (x < W) {
      const w = 4 + ((rnd() * 16) | 0), h = 10 + ((rnd() * 46) | 0);
      R(x, 86 - h, w, h, "#0b0f0b");
      for (let ly = 88 - h; ly < 86; ly += 3) for (let lx = x + 1; lx < x + w - 1; lx += 3) if (rnd() > 0.5) R(lx, ly, 1, 1, "#ffb24d");
      x += w + 2 + ((rnd() * 5) | 0);
    }
    R(0, 86, W, H, "#0a0d0a");
  } else if (type === "platform") {
    grad(0, 64, [[0, "#141d33"], [1, "#241a14"]]); R(0, 64, W, H, "#0c110e");
    for (let i = 0; i < 5; i++) {
      const px = 12 + i * 46; R(px, 20, 7, 50, "#0a0f0c"); R(px, 18, 7, 2, "#fff2cf");
      for (let dy = 20 * K; dy < 40 * K; dy++) for (let dx = (px - 3) * K; dx < (px + 10) * K; dx++) {
        const t = (1 - Math.abs(dx / K - (px + 3.5)) / 7) * (1 - (dy / K - 20) / 20) * 0.5;
        if (t > 0.05 && dith(dx, dy, t)) PX(dx, dy, "rgba(255,238,195,0.3)");
      }
    }
    R(0, 96, W, 4, "#f2c230"); for (let x = 0; x < W; x += 8) R(x, 96, 4, 4, "#c99a1a"); R(0, 100, W, H, "#11161a");
    for (let dy = 100 * K; dy < DH; dy++) for (let dx = 0; dx < DW; dx++) { const t = (1 - (dy / K - 100) / 30) * 0.35; if (dith(dx, dy, t)) PX(dx, dy, "rgba(255,220,150,0.10)"); }
    if (!bg) { R(70, 30, 68, 22, "#06110a"); R(72, 32, 64, 18, "#0a1f10"); for (let x = 78; x < 130; x += 4) R(x, 38, 2, 6, "#06ff31"); }
  } else if (type === "river") {
    grad(0, 84, [[0, "#0a1730"], [0.55, "#12294a"], [0.8, "#1c3a5e"], [1, "#12233b"]]); if (!bg) disc(150, 26, 9, "#e9edd6", 6);
    R(0, 60, W, 4, "#0c1a2c"); for (let i = 0; i < 4; i++) R(20 + i * 46, 52, 3, 10, "#0d1f33");
    R(0, 58, W, 2, "#33506e"); for (let x = 0; x < W; x += 6) R(x, 55, 1, 4, "#5a7ea0"); for (let x = 8; x < W; x += 14) R(x, 54, 2, 2, "#ffd27a");
    R(0, 84, W, H, "#0a1626");
    [30, 150, 70, 110, 180].forEach((cx) => { for (let dy = 84 * K; dy < DH; dy++) { const t = (1 - (dy / K - 84) / 44) * 0.55; for (let dx = (cx - 2) * K; dx < (cx + 2) * K; dx++) if (dith(dx, dy + cx * 7, t)) PX(dx, dy, "rgba(255,210,120,0.5)"); } });
  } else if (type === "taipei") {
    grad(0, 62, [[0, "#4f9fe0"], [0.55, "#93c6ec"], [0.9, "#d4e9f6"], [1, "#eaf4fb"]]); if (!bg) disc(24, 18, 6, "#fff6d8", 9);
    const cloud = (cx: number, cy: number) => ([[0, 0, 10, 3], [3, -2, 6, 2], [-3, 1, 5, 2]] as number[][]).forEach(([ox, oy, w, h]) => R(cx + ox, cy + oy, w, h, "#f4f9fd"));
    cloud(60, 13); cloud(158, 22);
    for (let x = 0; x < W; x++) { const h = (50 + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.14) * 3) | 0; for (let dy = h * K; dy < 64 * K; dy++) { PX(x * K, dy, "#5f8a72"); PX(x * K + 1, dy, "#5f8a72"); } }
    function bldg(x: number, w: number, top: number, c: string) { R(x, top, w, 106 - top, c); R(x, top, w, 1, "rgba(255,255,255,0.28)"); for (let wy = top + 3; wy < 104; wy += 4) for (let wx = x + 2; wx < x + w - 1; wx += 3) if ((wx + wy) % 5 < 3) R(wx, wy, 1, 2, "rgba(255,255,255,0.34)"); }
    bldg(2, 16, 74, "#8a94a0"); bldg(20, 14, 66, "#9aa2ad"); bldg(36, 18, 80, "#7f8893"); bldg(56, 15, 72, "#93a0ac"); bldg(73, 18, 82, "#88919d"); bldg(94, 13, 76, "#9ba6b2"); bldg(150, 20, 70, "#8a94a0"); bldg(172, 15, 78, "#95a0ac"); bldg(189, 17, 72, "#828c98");
    if (!bg) {
      const tx = 128; R(tx - 1, 14, 2, 12, "#9fb8b2"); R(tx, 10, 1, 4, "#c8d8d4"); R(tx - 6, 26, 12, 4, "#7fa199");
      for (let s = 0; s < 8; s++) { const y = 30 + s * 8; R(tx - 8, y, 16, 8, "#6f9e94"); R(tx - 9, y, 18, 2, "#8fbcb1"); R(tx - 8, y + 7, 16, 1, "#4d7168"); }
      R(tx - 13, 94, 26, 12, "#5c7f77"); R(tx - 13, 94, 26, 1, "#7fa199");
      for (let dy = 32 * K; dy < 93 * K; dy += 2) for (let dx = (tx - 6) * K; dx < (tx + 6) * K; dx += 3) if ((dx + dy) % 4 < 2) PX(dx, dy, "rgba(232,246,243,0.25)");
    }
    const Sg = ["#d64b3f", "#e0a53f", "#2f8f4f", "#3f6fd6", "#c23f8f", "#e8542f"];
    const hs = (x: number, y: number, w: number, c: string) => { R(x, y, w, 7, c); R(x, y, w, 1, "rgba(255,255,255,0.5)"); for (let a = x + 1; a < x + w - 1; a += 4) R(a, y + 2, 3, 3, "rgba(255,255,255,0.92)"); };
    const vs = (x: number, y: number, h: number, c: string) => { R(x, y, 4, h, c); R(x, y, 4, 1, "rgba(255,255,255,0.5)"); for (let a = y + 1; a < y + h - 1; a += 4) R(x + 1, a, 2, 3, "rgba(255,255,255,0.92)"); };
    hs(3, 86, 14, Sg[0]); hs(22, 80, 11, Sg[1]); hs(38, 92, 16, Sg[2]); hs(57, 84, 13, Sg[3]); hs(74, 94, 16, Sg[4]); hs(151, 84, 17, Sg[5]); hs(190, 88, 15, Sg[0]);
    vs(17, 80, 22, Sg[1]); vs(70, 84, 24, Sg[2]); vs(147, 74, 30, Sg[3]); vs(187, 78, 22, Sg[5]);
    R(0, 104, W, H, "#3a3f45"); R(0, 104, W, 2, "#4a4f55"); for (let x = 0; x < W; x += 14) R(x, 113, 7, 2, "#d8d2b8");
    R(20, 110, 20, 7, "#d64b3f"); R(22, 107, 15, 4, "#d64b3f"); R(24, 108, 10, 2, "#bfe6f4"); R(120, 111, 16, 6, "#eef2f5"); R(122, 108, 11, 4, "#eef2f5"); R(123, 109, 8, 2, "#bfe6f4");
  } else if (type === "field") {
    grad(0, 80, [[0, "#c2531a"], [0.4, "#ea8330"], [0.6, "#f2c07a"], [0.66, "#3a4a2c"], [1, "#1a2416"]]);
    for (let x = 0; x < W; x++) { const m = (54 + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.13) * 4) | 0; for (let dy = m * K; dy < 80 * K; dy++) { PX(x * K, dy, "#243018"); PX(x * K + 1, dy, "#243018"); } }
    R(0, 80, W, H, "#16210f"); for (let ry = 84; ry < H; ry += 6) for (let dx = 0; dx < DW; dx++) { const t = (1 - (ry - 84) / 46) * 0.4; if (dith(dx, ry * K, t)) PX(dx, ry * K, "rgba(242,170,90,0.4)"); }
    for (let i = 0; i < 6; i++) R(16 + i * 32 + ((rnd() * 10) | 0), 56 + ((rnd() * 4) | 0), 1, 1, "#ffd27a"); if (!bg) { R(150, 48, 10, 8, "#0e160a"); R(151, 45, 8, 3, "#0e160a"); }
  } else if (type === "sea") {
    grad(0, 74, [[0, "#182a4a"], [0.34, "#b8492a"], [0.5, "#f2a25a"], [0.6, "#f6c98a"], [1, "#0d2438"]]); if (!bg) disc(70, 52, 8, "#ffe9c2", 7);
    R(0, 74, W, H, "#0a1c2c"); for (let wy = 76; wy < H; wy += 5) for (let dx = 0; dx < DW; dx++) { const t = (1 - (wy - 76) / 48) * 0.3; if (dith(dx, wy * K, t)) PX(dx, wy * K, "rgba(120,170,210,0.35)"); }
    if (!bg) {
      for (let dy = 74 * K; dy < DH; dy++) { const t = (1 - (dy / K - 74) / 50) * 0.7; for (let dx = 64 * K; dx < 76 * K; dx++) if (dith(dx, dy, t)) PX(dx, dy, "rgba(255,215,140,0.55)"); }
      R(120, 70, 10, 4, "#0c1a12"); R(124, 66, 1, 5, "#0c1a12"); for (let x = 150; x < 200; x++) { const c = (64 - (x - 150) * 0.2) | 0; R(x, c, 1, 72 - c, "#0a1a10"); }
    }
  }
}

import type { Grade } from "@/content/stations";

// gate(開始乘車)→ door(車門開啟過場,車廂已掛載在門後)→ ride(六站)→ exit(起身轉身)
// door 不是獨立 phase:gateEnd 起車廂就掛載(phaseOf 回 "ride"),doorProgress 驅動
// 上層的 shader 過場;rideProgress 從 doorEnd 才開始走,門開完剛好停在第一站。
export const PHASE = { gateEnd: 0.13, doorEnd: 0.22, rideEnd: 0.8 } as const;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);

export function phaseOf(p: number): "gate" | "ride" | "exit" {
  return p < PHASE.gateEnd ? "gate" : p < PHASE.rideEnd ? "ride" : "exit";
}
// 車門過場進度 0→1(gateEnd → doorEnd)
export function doorProgress(p: number) {
  return clamp((p - PHASE.gateEnd) / (PHASE.doorEnd - PHASE.gateEnd));
}
export function rideProgress(p: number) {
  return clamp((p - PHASE.doorEnd) / (PHASE.rideEnd - PHASE.doorEnd));
}
// exit 段進度 0→1(到站相機動畫:起身 + 轉身)
export function exitProgress(p: number) {
  return clamp((p - PHASE.rideEnd) / (1 - PHASE.rideEnd));
}
// 到站減速曲線:把「等速掠過六站」改成「起步 → 巡航 → 減速 → 停住」。
// 每段(相鄰兩站之間)的前後各 DWELL 完全靜止 —— 靜止不是視覺裝飾,而是讓資訊卡的
// 可讀期間 = 停站期間;中段用 smoothstep,兩端導數為 0,所以起步與煞停都沒有硬轉折。
// 整數點恆等(stationEase(i) === i)是關鍵性質:jumpTo 的線性目標剛好落在停站窗口正中。
export const DWELL = 0.15;
export function stationEase(x: number) {
  const i = Math.floor(x);
  return i + smooth(clamp((x - i - DWELL) / (1 - 2 * DWELL)));
}
export function stationAt(rp: number, n: number) {
  const x = clamp(rp) * (n - 1);
  return { index: Math.round(x), local: x - Math.floor(x) };
}
export function panoramaOffset(rp: number, span: number) {
  return clamp(rp) * span;
}

// 車窗座標(% of public/cabin.jpg,1672×941,實測值)
export const WIN = [
  { left: 31.2, top: 32.7, w: 37.6, h: 32.9, r: "4% / 8%", pos: "center" }, // 中央窗
  { left: 3.2, top: 34.5, w: 6.9, h: 29.6, r: "26% / 8%", pos: "22% center" }, // 左窗
  { left: 89.9, top: 34.5, w: 7.3, h: 29.6, r: "26% / 8%", pos: "78% center" }, // 右窗
] as const;
export const LED_RECT = { left: 22.4, top: 4.1, w: 55.8, h: 6.2 } as const;

function mixRgba(a: string, b: string, t: number) {
  const p = (s: string) => s.match(/[\d.]+/g)!.map(Number);
  const [ar, ag, ab, aa = 1] = p(a);
  const [br, bg, bb, ba = 1] = p(b);
  const l = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgba(${l(ar, br)},${l(ag, bg)},${l(ab, bb)},${(aa + (ba - aa) * t).toFixed(3)})`;
}
export function lerpGrade(a: Grade, b: Grade, t: number): Grade {
  return {
    filter: t < 0.5 ? a.filter : b.filter,
    grade: mixRgba(a.grade, b.grade, t),
    blend: t < 0.5 ? a.blend : b.blend,
  };
}

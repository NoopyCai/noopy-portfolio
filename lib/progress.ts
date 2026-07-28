import type { Grade } from "@/content/stations";

// gate(開始乘車)→ ride(六站)→ exit(到站起身轉身,交棒給出站大廳)
export const PHASE = { gateEnd: 0.13, rideEnd: 0.8 } as const;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);

export function phaseOf(p: number): "gate" | "ride" | "exit" {
  return p < PHASE.gateEnd ? "gate" : p < PHASE.rideEnd ? "ride" : "exit";
}
export function rideProgress(p: number) {
  return clamp((p - PHASE.gateEnd) / (PHASE.rideEnd - PHASE.gateEnd));
}
// exit 段進度 0→1(到站相機動畫:起身 + 轉身)
export function exitProgress(p: number) {
  return clamp((p - PHASE.rideEnd) / (1 - PHASE.rideEnd));
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

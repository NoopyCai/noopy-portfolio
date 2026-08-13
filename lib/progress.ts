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
// 出站的門(E1):轉身完成後,車門在**身後**關上 —— 進站那扇門的反放。
// e 0.62 起淡入(此時 .camera 正好淡出),0.95 完全閉合;0.80–1.0 大廳 hero 疊上來,
// 「門關 = 簾幕落下」。這段刻意早於 e=1 結束:最後 5% 留給 hero 獨自佔滿畫面。
export const EXIT_DOOR = { start: 0.62, end: 0.95 } as const;
export function exitDoorProgress(p: number) {
  return clamp((exitProgress(p) - EXIT_DOOR.start) / (EXIT_DOOR.end - EXIT_DOOR.start));
}

// A5 隧道段:LIFF(x=2)→ AI(x=3) 的巡航段正中央,以 **eased x** 定義(唯一座標)。
// 上界由資訊卡決定:卡片的隱藏區間是 dist > 0.34 ⇒ x ∈ [2.34, 2.66],隧道必須完全落在
// 其內,讀卡片的時候才不會突然變暗。所以 [2.36, 2.64] 已經是「不撞到卡片」的極限,
// 兩端各留 0.02 的餘裕。
// 下界由「讀得出來是隧道」決定:這段在 eased x 空間只有 0.28,但它落在減速曲線最快的
// 巡航段(dx/dscroll ≈ 2.14),換算成實際捲動只有 **~126px**。spec 原本的 [2.42, 2.58]
// 更只有 71px —— 不到一個滾輪格,整段隧道會變成一次閃光。真機驗手感若還是太短,
// 問題在 TOTAL_LEN 寫死(audit §8.4),不是這兩個數字還能再擠。
export const TUNNEL = { from: 2.36, to: 2.64 } as const;
// 回傳 0→1 的洞內進度。區間外回 0 / 1,而分段曲線在兩端都收斂成「什麼都沒發生」,
// 所以呼叫端不需要另外判斷在不在洞裡(仍然會 gate 掉 DOM,見 ScrollJourney)。
export function tunnelProgress(x: number) {
  return clamp((x - TUNNEL.from) / (TUNNEL.to - TUNNEL.from));
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
const lerp = (x: number, y: number, t: number) => x + (y - x) * t;
// 三個數字全部線性插值 —— 「車內燈光隨窗外光線改變」是這個專案的招牌機制,階梯狀跳變
// 會讓機制露餡。舊版只有顏色是真插值,filter / blend 在 t=0.5 硬切,靠 CSS transition
// 追趕 0.8s(而且跟 scrub 打架)。blend 已統一成 GRADE_BLEND,不再需要插值。
export function lerpGrade(a: Grade, b: Grade, t: number): Grade {
  return {
    brightness: lerp(a.brightness, b.brightness, t),
    saturate: lerp(a.saturate, b.saturate, t),
    contrast: lerp(a.contrast ?? 1, b.contrast ?? 1, t),
    tint: mixRgba(a.tint, b.tint, t),
  };
}
// 數值 → CSS filter 字串。contrast 等於 1 就不輸出(少一個 filter function 少一次合成)。
export function gradeFilter(g: Grade): string {
  const c = g.contrast ?? 1;
  return `brightness(${g.brightness.toFixed(3)}) saturate(${g.saturate.toFixed(3)})${c === 1 ? "" : ` contrast(${c.toFixed(3)})`}`;
}

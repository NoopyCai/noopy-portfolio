import { PHASE, clamp } from "@/lib/progress";

// 捲動旅程的「距離」層:pin 的總長度、平滑捲動、以及跳站的落點計算。
//
// 為什麼獨立成一個檔案:時刻表(Concourse)要能跳回車廂裡的某一站,而 ScrollJourney
// 已經 import 了 ConcourseHero —— 反向再 import 就是 circular。相位常數(PHASE)則是
// 純數學,留在 lib/progress.ts 由這裡唯讀取用。

export const TOTAL_LEN = 8200; // pin 捲動總距離(px):gate → door(車門過場) → ride(六站) → exit(起身轉身)

/** 捲動曲線:時間比例 t(0→1)→ 已走完的距離比例 s(0→1)。必須單調、s(0)=0、s(1)=1。 */
export type ScrollEase = (t: number) => number;

const easeInOutQuad: ScrollEase = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// 逐幀 window.scrollTo 的平滑捲動:每幀觸發真實 scroll 事件驅動 ScrollTrigger。
// (不用 gsap ScrollToPlugin —— 它與 pinned scrub ScrollTrigger 會回饋成死迴圈而凍結)
// ease 可換:預設的 easeInOutQuad 對「跳到某一站」這種等值移動剛好,但「開始乘車」那一顆
// 走過的是兩段密度完全不同的內容(見下方 gateRideEase),需要自己的曲線。
export function smoothScrollTo(target: number, duration = 1300, ease: ScrollEase = easeInOutQuad) {
  const start = window.scrollY;
  const dist = target - start;
  if (Math.abs(dist) < 1) return;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, Math.round(start + dist * ease(t)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── 「開始乘車」那一顆的代捲參數 ────────────────────────────────────────────────
// 落點刻意越過 doorEnd 一點點:門要「開完」而不是停在最後一格。
export const GATE_RIDE_P = PHASE.doorEnd + 0.005;
/** 代捲總時長(ms)。想要更慢/更快就改這一個數字,分配曲線會自己跟著縮放。 */
export const GATE_RIDE_MS = 3600;
/** 時間分配:前 GATE_SPLIT_T 的**時間**走完 gate 區間,剩下的全給門。 */
export const GATE_SPLIT_T = 0.40;
// 交界(門開始開的那一刻)的速度,單位是「距離比例 / 時間比例」。
// 1 = 等速;現在的 0.75 表示過了交界之後就一路減速到停 —— 門是在減速中打開的。
const GATE_JOIN_V = 0.75;
// gate 區間佔整段代捲**距離**的比例。0.13 / 0.225 ≈ 0.578:距離上超過一半,
// 時間上卻只給 40% —— 這就是「前段衝過去、後段留給門」。
const GATE_SPLIT_S = PHASE.gateEnd / GATE_RIDE_P;

// 標準 cubic Hermite(u ∈ [0,1],v 是該段的局部速度 ds/du)
function hermite(u: number, s0: number, s1: number, v0: number, v1: number) {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * s0 + (u3 - 2 * u2 + u) * v0 + (3 * u2 - 2 * u3) * s1 + (u3 - u2) * v1;
}

// 「開始乘車」的捲動曲線。**為什麼不用單一 easeInOut**:這段代捲橫跨兩段密度完全不同的
// 內容 —— 前面 0→0.13 只是按鈕淡出(沒東西可看),後面 0.13→0.22 是門真的在開(整段的
// 主角)。用單一曲線的話門段會落在速度最快的中段,一眨眼就開完了,正是使用者說的「太快」。
//
// 所以曲線是兩段velocity 接得起來的 Hermite:
//   · t 0 → 0.40   s 0 → 0.578   起步從靜止加速,把 gate 那段沒有內容的距離衝掉
//   · t 0.40 → 1   s 0.578 → 1   交界速度 0.75 進場,一路減速到 0 —— 門在減速中開完
// 兩段在交界的速度相同(GATE_JOIN_V),所以中途不會頓一下;兩端速度都是 0,起步與收尾
// 都不會有硬切。整條曲線嚴格遞增(兩段的 s'(u) 在 [0,1] 上都 ≥ 0),倒退不會發生。
export const gateRideEase: ScrollEase = (t) => {
  if (t <= GATE_SPLIT_T) {
    return hermite(t / GATE_SPLIT_T, 0, GATE_SPLIT_S, 0, GATE_JOIN_V * GATE_SPLIT_T);
  }
  const w = 1 - GATE_SPLIT_T;
  return hermite((t - GATE_SPLIT_T) / w, GATE_SPLIT_S, 1, GATE_JOIN_V * w, 0);
};

// pin 容器在文件裡的位置。Concourse 拿不到 ScrollJourney 的 ref,所以靠 `.stage` 反推
// (`.stage` 的 parent 就是被 pin 的 wrap)。回 null = 這一頁根本沒有旅程
// (prefers-reduced-motion 走 StaticFallback),呼叫端要據此關掉跳站互動。
export function journeyTop(): number | null {
  if (typeof document === "undefined") return null;
  const wrap = document.querySelector(".stage")?.parentElement as HTMLElement | null;
  return wrap ? wrap.offsetTop : null;
}

// 跳到第 i 站(共 n 站)。公式與 ScrollJourney 的 jumpTo 完全相同:線性目標
// i/(n-1) 對應到 rp*(n-1) = i(整數),而 stationEase(整數) === 整數,所以落點
// 正是停站窗口的正中間。下限 doorEnd:跳站不要落在半開的車門裡。
export function jumpToStation(i: number, n: number, duration = 1200): boolean {
  const top = journeyTop();
  if (top === null) return false;
  const r = n > 1 ? i / (n - 1) : 0;
  const pTarget = clamp(
    PHASE.doorEnd + r * (PHASE.rideEnd - PHASE.doorEnd),
    PHASE.doorEnd + 0.005,
    PHASE.rideEnd - 0.01,
  );
  smoothScrollTo(top + TOTAL_LEN * pTarget, duration);
  return true;
}

import { PHASE, clamp } from "@/lib/progress";

// 捲動旅程的「距離」層:pin 的總長度、平滑捲動、以及跳站的落點計算。
//
// 為什麼獨立成一個檔案:時刻表(Concourse)要能跳回車廂裡的某一站,而 ScrollJourney
// 已經 import 了 ConcourseHero —— 反向再 import 就是 circular。相位常數(PHASE)則是
// 純數學,留在 lib/progress.ts 由這裡唯讀取用。

export const TOTAL_LEN = 8200; // pin 捲動總距離(px):gate → door(車門過場) → ride(六站) → exit(起身轉身)

// 逐幀 window.scrollTo 的平滑捲動:每幀觸發真實 scroll 事件驅動 ScrollTrigger。
// (不用 gsap ScrollToPlugin —— 它與 pinned scrub ScrollTrigger 會回饋成死迴圈而凍結)
export function smoothScrollTo(target: number, duration = 1300) {
  const start = window.scrollY;
  const dist = target - start;
  if (Math.abs(dist) < 1) return;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
    window.scrollTo(0, Math.round(start + dist * e));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

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

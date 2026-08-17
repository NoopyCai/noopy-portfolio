"use client";
import { useLayoutEffect, useEffect, useRef } from "react";
import type { Grade, SceneType } from "@/content/stations";

// 階段 0(audit §4.3):捲動的**連續量**不再經過 React。
//
// 為什麼要有這個檔案:ScrollTrigger 的 onUpdate 每幀都會被叫,舊寫法是 `setP(progress)`
// —— 一幀一次 state 更新,整棵樹(CabinComposite → 3×Window → SceneLayer/PlatformLayer →
// StationPanel → RouteMap)重算一次,而其中真正會變的只有幾個 style 字串與一次 canvas blit。
// reconciliation 在這頁是純浪費,而 exit 相位的每一毫秒都要省下來給 3D 化用。
//
// 現在的分工:
//   - 連續量(每幀都在變)→ 這條 bus:ScrollJourney 的 applyFrame 就地改寫 `frame`,
//     emit() 同步叫所有訂閱者,訂閱者直接寫自己的 DOM。**零 re-render**。
//   - 離散量(換站 / 換相位 / 卡片門檻)→ 照舊 setState,那才是 React 該做的事。
//
// `frame` 是**單一可變物件**,不是每幀 new 一個:訂閱者是同步讀的,沒有跨幀持有的問題,
// 而 4× CPU throttle 的手機上每幀配置一組物件就是白給 GC 的壓力。

// A5 隧道段的所有覆蓋層參數。全部由 eased x 插值(見 ScrollJourney 的 applyFrame),
// 不由時間 —— 所以倒著捲就是倒著出洞。null = 不在隧道區間(該層整組收起來)。
export type TunnelFx = {
  dim: number;          // 三扇窗的壓暗(窗外近黑)
  band: number | null;  // 中央窗那道垂直暗帶的 X 位移(%),null = 已經掃完
  lift: number;         // 車廂內壁的暖色提亮(隧道裡「車內比車外亮」是對的)
  sweep: number;        // 暖色光帶橫掃的位移(%)
  flash: number;        // 出洞回光(白)
};

export type Frame = {
  /** eased 列車座標(= 舊的 pan / x):index、dist、窗景平移全部吃它 */
  x: number;
  /** 逐幀插值後的燈光分級(filter 三數值 + tint) */
  grade: Grade;
  /** B2:月台層不透明度(0 = 不疊,巡航段零 blit) */
  platform: number;
  /** A5:隧道覆蓋層,null = 區間外 */
  tunnel: TunnelFx | null;
  /** L2a 站切換 crossfade:由 x 驅動(不是計時器),所以倒著捲就是倒著溶。
   *  sceneA = 正在離開的站、sceneB = 正在進入的站、mix = B 疊在 A 之上的不透明度。
   *  DOM 車廂(降級路徑)不吃這三個 —— 它照舊用 React 掛新層 + CSS transition。 */
  sceneA: SceneType;
  sceneB: SceneType;
  mix: number;
};

export type FrameBus = {
  /** 就地改寫這個物件,再 emit() */
  readonly frame: Frame;
  emit(): void;
  /** 訂閱時**立刻**叫一次:剛掛載的元件(例如門開完才出現的車廂)不能等到下一次捲動才有樣式 */
  subscribe(fn: () => void): () => void;
};

export function createFrameBus(initial: Grade, initialScene: SceneType): FrameBus {
  const frame: Frame = { x: 0, grade: initial, platform: 0, tunnel: null, sceneA: initialScene, sceneB: initialScene, mix: 0 };
  const subs = new Set<() => void>();
  return {
    frame,
    emit() {
      subs.forEach((fn) => fn());
    },
    subscribe(fn) {
      subs.add(fn);
      fn();
      return () => {
        subs.delete(fn);
      };
    },
  };
}

// useLayoutEffect 而不是 useEffect:訂閱時的那一次立即套用必須落在 paint **之前**。
// 用 useEffect 的話,車廂剛掛載的那一幀會先畫一張沒有 grade / 沒有 blit 的原圖再修正 —— 閃一下。
// SSR 沒有 layout 這回事,退回 useEffect 只是為了消掉警告(用到的元件在 SSR 都不掛載)。
export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** 訂閱每幀的連續量。回呼裡直接寫 DOM,不要 setState。 */
export function useFrame(bus: FrameBus, fn: () => void) {
  // 回呼會閉包住 props(bg / center / pos …),每次 render 換新的一份;訂閱本身只做一次,
  // 所以固定叫 ref 裡最新的那份,避免拿到過期的 props。
  const latest = useRef(fn);
  latest.current = fn;
  useIsoLayoutEffect(() => bus.subscribe(() => latest.current()), [bus]);
}

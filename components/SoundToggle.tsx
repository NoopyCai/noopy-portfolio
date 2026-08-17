"use client";
import { useState } from "react";
import { Icon } from "./Icon";

let sfx: HTMLAudioElement | null = null; // 進站音效 train_sounds.mp3
let music: HTMLAudioElement | null = null; // 背景音樂 music.mp3(無縫 loop,原生循環)
let started = false; // 是否已啟動聲軌(點過開始乘車)
let muted = false;

const VOL = { sfx: 0.5, music: 0.35 }; // 上限音量
const FADE = 1.6; // 音樂淡入/淡出秒數
const SFX_FADE = 1.0; // 進站音效淡入秒數

const rafs = new WeakMap<HTMLAudioElement, number>();
// onDone 只在這一輪 ramp 自然跑完才呼叫 —— 中途被新的 fadeTo 取消就不會觸發(靠這個避免
// 「淡出中被取消靜音,結果稍後那個 pause 才姍姍來遲」)
function fadeTo(el: HTMLAudioElement, target: number, dur: number, onDone?: () => void) {
  cancelAnimationFrame(rafs.get(el) ?? 0);
  const start = el.volume;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = dur <= 0 ? 1 : Math.min(1, (now - t0) / (dur * 1000));
    el.volume = Math.max(0, Math.min(1, start + (target - start) * t));
    if (t < 1) rafs.set(el, requestAnimationFrame(step));
    else onDone?.();
  };
  rafs.set(el, requestAnimationFrame(step));
}
function playFromStart(el: HTMLAudioElement, vol: number, dur: number) {
  try { el.currentTime = 0; } catch { /* 還沒 seekable(媒體未載入)—— 不能讓它中斷整個 onClick */ }
  el.volume = 0;
  el.play().then(() => fadeTo(el, vol, dur)).catch(() => { /* autoplay 被擋:等使用者手勢 */ });
}
function ensure(): boolean {
  if (typeof Audio === "undefined") return false;
  if (!sfx) { sfx = new Audio("/train_sounds.mp3"); sfx.preload = "auto"; sfx.volume = 0; }
  if (!music) {
    music = new Audio("/music.mp3");
    music.preload = "auto";
    music.volume = 0;
    // music.mp3 是剪過的 16 小節無縫 loop(43.64s,首尾已烤進 60ms 等功率交叉淡化),所以交給
    // 原生 loop 直接接回去。舊版是「timeupdate 監看尾端 → 淡出 → ended → 從頭再淡入」的手動
    // 循環,那是為 4 分半的完整曲子寫的:整首播完再從頭來會露出樂曲的起承轉合,只好用淡出遮掉。
    // 換成 loop 素材後那套反而有害 —— 每 43 秒就把音樂抹掉再拉回來,節奏會被硬生生打斷一次。
    music.loop = true;
  }
  return true;
}

// 啟動聲軌:進站音效淡入 → 結束後淡入背景音樂(只有這第一次進場需要淡入,之後由原生 loop 續著跑)
export function startSoundtrack() {
  if (muted || !ensure()) return;
  started = true;
  music!.pause();
  sfx!.onended = () => { if (started && !muted) playFromStart(music!, VOL.music, FADE); };
  playFromStart(sfx!, VOL.sfx, SFX_FADE);
}

// 靜音切換:淡出後才暫停(直接 pause 會在波形中途硬切成無聲);取消靜音則從原處續播並淡入
export function setMuted(v: boolean) {
  muted = v;
  if (!ensure()) return;
  if (v) {
    sfx!.pause();
    fadeTo(music!, 0, FADE, () => { if (muted) music!.pause(); });
  } else if (started) {
    music!.play().then(() => fadeTo(music!, VOL.music, FADE)).catch(() => {});
  }
}

// 靜音鍵:圖示化、左上角低調擺放(WCAG 1.4.2 — 會持續播放的聲音必須給停止的方法)
export function SoundToggle() {
  const [on, setOn] = useState(true);
  return (
    <button
      className="ctrl sound-dot"
      aria-pressed={!on}
      aria-label="靜音切換 / Mute"
      title="靜音切換 / Mute"
      onClick={() => { setMuted(on); setOn(!on); }}
    >
      <Icon name={on ? "sound" : "mute"} size={15} />
    </button>
  );
}

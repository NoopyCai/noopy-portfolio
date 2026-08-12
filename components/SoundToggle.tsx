"use client";
import { useState } from "react";
import { Icon } from "./Icon";

let sfx: HTMLAudioElement | null = null; // 進站音效 train_sounds.mp3
let music: HTMLAudioElement | null = null; // 背景音樂 music.mp3(淡入/淡出循環)
let started = false; // 是否已啟動聲軌(點過開始乘車)
let muted = false;
let fadedOut = false; // 本輪是否已在尾端啟動淡出

const VOL = { sfx: 0.5, music: 0.35 }; // 上限音量
const FADE = 1.6; // 音樂淡入/淡出秒數
const SFX_FADE = 1.0; // 進站音效淡入秒數

const rafs = new WeakMap<HTMLAudioElement, number>();
function fadeTo(el: HTMLAudioElement, target: number, dur: number) {
  cancelAnimationFrame(rafs.get(el) ?? 0);
  const start = el.volume;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = dur <= 0 ? 1 : Math.min(1, (now - t0) / (dur * 1000));
    el.volume = Math.max(0, Math.min(1, start + (target - start) * t));
    if (t < 1) rafs.set(el, requestAnimationFrame(step));
  };
  rafs.set(el, requestAnimationFrame(step));
}
function playFromStart(el: HTMLAudioElement, vol: number, dur: number) {
  try { el.currentTime = 0; } catch { /* 還沒 seekable(媒體未載入)—— 不能讓它中斷整個 onClick */ }
  el.volume = 0;
  el.play().then(() => fadeTo(el, vol, dur)).catch(() => { /* autoplay 被擋:等使用者手勢 */ });
}
function onTime() {
  if (!music || !music.duration || fadedOut) return;
  const left = music.duration - music.currentTime;
  if (left <= FADE) { fadedOut = true; fadeTo(music, 0, left); } // 循環尾端淡出
}
function onEnded() {
  if (started && !muted) { fadedOut = false; playFromStart(music!, VOL.music, FADE); } // 手動循環 + 重新淡入
}

function ensure(): boolean {
  if (typeof Audio === "undefined") return false;
  if (!sfx) { sfx = new Audio("/train_sounds.mp3"); sfx.preload = "auto"; sfx.volume = 0; }
  if (!music) {
    music = new Audio("/music.mp3");
    music.preload = "auto";
    music.volume = 0;
    music.addEventListener("timeupdate", onTime);
    music.addEventListener("ended", onEnded); // loop=false,自行循環以套用淡入
  }
  return true;
}

// 啟動聲軌:進站音效淡入 → 結束後淡入背景音樂;每輪循環尾端淡出、頭段淡入
export function startSoundtrack() {
  if (muted || !ensure()) return;
  started = true;
  music!.pause();
  sfx!.onended = () => { if (started && !muted) { fadedOut = false; playFromStart(music!, VOL.music, FADE); } };
  playFromStart(sfx!, VOL.sfx, SFX_FADE);
}

// 靜音切換:靜音時暫停;取消靜音且已啟動則淡入恢復背景音樂
export function setMuted(v: boolean) {
  muted = v;
  if (!ensure()) return;
  if (v) { sfx!.pause(); music!.pause(); }
  else if (started) { music!.play().then(() => fadeTo(music!, VOL.music, FADE)).catch(() => {}); }
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

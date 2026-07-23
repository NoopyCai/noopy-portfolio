"use client";

let sfx: HTMLAudioElement | null = null; // 進站音效 train_sounds.mp3
let music: HTMLAudioElement | null = null; // 背景音樂 music.mp3(淡入/淡出循環)
let started = false; // 是否已啟動聲軌(點過開始乘車)
let fadeRAF = 0;
let fadedOut = false; // 本輪是否已在尾端啟動淡出
const MUSIC_VOL = 0.7;
const FADE = 1.6; // 淡入/淡出秒數

function fadeTo(target: number, dur: number) {
  if (!music) return;
  cancelAnimationFrame(fadeRAF);
  const start = music.volume;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = dur <= 0 ? 1 : Math.min(1, (now - t0) / (dur * 1000));
    music!.volume = Math.max(0, Math.min(1, start + (target - start) * t));
    if (t < 1) fadeRAF = requestAnimationFrame(step);
  };
  fadeRAF = requestAnimationFrame(step);
}
function playMusicFromStart() {
  if (!music) return;
  fadedOut = false;
  music.currentTime = 0;
  music.volume = 0;
  music.play().then(() => fadeTo(MUSIC_VOL, FADE)).catch(() => {});
}
function onTime() {
  if (!music || !music.duration || fadedOut) return;
  const left = music.duration - music.currentTime;
  if (left <= FADE) { fadedOut = true; fadeTo(0, left); } // 循環尾端淡出
}
function onEnded() {
  if (started) playMusicFromStart(); // 手動循環 + 重新淡入
}

function ensure(): boolean {
  if (typeof Audio === "undefined") return false;
  if (!sfx) { sfx = new Audio("/train_sounds.mp3"); sfx.preload = "auto"; }
  if (!music) {
    music = new Audio("/music.mp3");
    music.preload = "auto";
    music.volume = 0;
    music.addEventListener("timeupdate", onTime);
    music.addEventListener("ended", onEnded); // loop=false,自行循環以套用淡入
  }
  return true;
}

// 啟動聲軌:先播 train_sounds.mp3,結束後淡入 music.mp3;每輪循環尾端淡出、頭段淡入
export function startSoundtrack() {
  if (!ensure()) return;
  started = true;
  music!.pause();
  sfx!.onended = () => { if (started) playMusicFromStart(); };
  try { sfx!.currentTime = 0; } catch { /* not seekable yet */ }
  sfx!.play().catch(() => { /* autoplay blocked until user gesture */ });
}

// 靜音切換:靜音時暫停;取消靜音且已啟動則淡入恢復背景音樂
export function setMuted(muted: boolean) {
  if (!ensure()) return;
  if (muted) { sfx!.pause(); music!.pause(); }
  else if (started) { music!.play().then(() => fadeTo(MUSIC_VOL, FADE)).catch(() => {}); }
}

export function SoundToggle({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      className="ctrl"
      aria-pressed={enabled}
      onClick={() => {
        const v = !enabled;
        onToggle(v);
        setMuted(!v);
      }}
    >
      {enabled ? "🔊" : "🔇"} 報站 / Sound
    </button>
  );
}

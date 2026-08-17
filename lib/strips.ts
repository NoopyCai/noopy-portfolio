import { drawScene, type SceneLayerKind } from "@/lib/scene";
import type { SceneType } from "@/content/stations";

// 窗景長條(3× 寬的 [bg | full | bg])的建置與快取。
//
// 為什麼從 Window.tsx 搬出來:L2a 之後有**兩個**消費端 —— WebGL 場景(把長條當
// CanvasTexture 上傳,pan 走 texture.offset.x)與 no-WebGL 的 DOM 車廂(照舊 blit)。
// drawScene 是逐像素迴圈(單張約 108k 次 fillRect),快取必須是同一份;兩邊各留一份
// module-scope Map 就是同一站畫兩次。坑 8 的內容原樣搬過來,語意不變。

export const PAN_LOOPS = 1; // 每站約平移一圈(地標經過一次)

// key 是 `scene|bg|layer`:一個戶外站最多 4 張(左右窗的完整版、中央窗的 far / near-bg /
// near-full),月台 2 張,全程走完六站 = 22 張 ≈ 9 MB。far 沒有 `full` 變體 —— 它不畫地標,
// bg 與 full 是同一張圖,所以下面直接把 bg 釘成 true。**不要繞過這個快取直接呼叫 drawScene**。
const sceneCache = new Map<string, HTMLCanvasElement>();

export function getScene(scene: SceneType, bg: boolean, layer?: SceneLayerKind) {
  const b = layer === "far" ? true : bg;
  const key = `${scene}|${b}|${layer ?? "-"}`;
  let c = sceneCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    drawScene(c, scene, { bg: b, layer });
    sceneCache.set(key, c);
  }
  return c;
}

// 3× 長條的組裝(bg | full | bg):地標只在中段出現一次,而兩端是可無縫平鋪的背景,
// 所以「捲到底再繞回開頭」在接縫上看不出來(WebGL 端就是靠這個性質直接用 RepeatWrapping)。
// 這一層**沒有**快取:貴的是 drawScene(上面那層已經擋掉了),長條本身只是三次 drawImage。
// WebGL 端的 CanvasTexture 會自己抓著長條不放,DOM 端則是用完就交給 GC —— 兩邊都不需要
// 再多一份 3× 尺寸(單張 1.2 MB)的常駐副本。
export function buildStrip(scene: SceneType, bg: boolean, layer?: SceneLayerKind) {
  const full = getScene(scene, bg, layer);
  const W = full.width, H = full.height;
  const bgc = bg || layer === "far" ? full : getScene(scene, true, layer); // 背景層(無地標)
  const strip = document.createElement("canvas");
  strip.width = W * 3;
  strip.height = H;
  const sg = strip.getContext("2d")!;
  sg.imageSmoothingEnabled = false;
  sg.drawImage(bgc, 0, 0);
  sg.drawImage(full, W, 0);
  sg.drawImage(bgc, W * 2, 0);
  return strip;
}

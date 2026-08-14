"use client";
import { useEffect, useRef, useState } from "react";
import { drawScene } from "@/lib/scene";
import { useFrame, setShown, type FrameBus } from "@/lib/frame";
import type { SceneType } from "@/content/stations";

type Rect = { left: number; top: number; w: number; h: number; r: string; pos: string };

const PAN_LOOPS = 1; // 每站約平移一圈(地標經過一次)

let uid = 0;

// drawScene 是逐像素迴圈(單張 ~108k 次 fillRect)。六站 × {bg,full} 最多 12 張,
// 快取起來:換站從 4 次重繪降到 0,來回捲動也不再重畫。約 5MB。
const sceneCache = new Map<string, HTMLCanvasElement>();
function getScene(scene: SceneType, bg: boolean) {
  const key = `${scene}|${bg}`;
  let c = sceneCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    drawScene(c, scene, { bg });
    sceneCache.set(key, c);
  }
  return c;
}

// 從 3×寬長條 [bg | full(含地標) | bg] 取一個 window 寬的切片,隨 pan 環繞平移 → 行駛感,且地標不重複。
function blit(c: HTMLCanvasElement | null, strip: HTMLCanvasElement | null, pan: number) {
  if (!c || !strip) return;
  const SW = strip.width, H = strip.height, W = Math.round(SW / 3);
  if (c.width !== W) c.width = W;
  if (c.height !== H) c.height = H;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const off = Math.round(((((pan * PAN_LOOPS) % 1) + 1) % 1) * SW); // 整數對齊,避免抖色爬行閃爍
  g.clearRect(0, 0, W, H);
  g.drawImage(strip, -off, 0);
  g.drawImage(strip, SW - off, 0);
}

// 3× 長條的組裝(bg | full | bg)。抽出來給 SceneLayer 與 PlatformLayer 共用 ——
// 兩者都走 getScene 的 Map 快取(坑 8),長條本身只是三次 drawImage,建一次就放著。
function buildStrip(scene: SceneType, bg: boolean) {
  const full = getScene(scene, bg);
  const W = full.width, H = full.height;
  const bgc = bg ? full : getScene(scene, true); // 背景層(無地標):讓地標只在中段出現一次
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

// 單一車窗:換站 crossfade(離散,走 React)+ 窗景隨捲動水平流動(連續,走 frame bus)。
export function Window({
  bus,
  scene,
  rect,
  bg,
  center = false,
}: {
  bus: FrameBus;
  scene: SceneType;
  rect: Rect;
  bg: boolean;
  /** 中央窗:只有它吃 A5 進洞的那道垂直暗帶 */
  center?: boolean;
}) {
  const [layers, setLayers] = useState<{ id: number; scene: SceneType; on: boolean }[]>(() => [
    { id: uid++, scene, on: true },
  ]);
  const dimRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top.scene === scene) return prev;
      return [...prev, { id: uid++, scene, on: false }];
    });
  }, [scene]);

  useEffect(() => {
    const pending = layers.find((l) => !l.on);
    if (!pending) return;
    const raf = requestAnimationFrame(() =>
      setLayers((prev) => prev.map((l) => (l.id === pending.id ? { ...l, on: true } : l)))
    );
    const timer = setTimeout(() => setLayers((prev) => prev.slice(-1)), 700);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [layers]);

  // A5:壓暗與暗帶。兩層都是**常駐掛載 + display 切換** —— 舊寫法是條件式掛載,
  // 但掛不掛載是離散事件(會逼出 re-render);display:none 的元素同樣不進 paint、
  // 不產生合成層,「巡航段零合成層」的成立條件沒有改變。
  useFrame(bus, () => {
    const tunnel = bus.frame.tunnel;
    const dim = tunnel ? tunnel.dim : 0;
    setShown(dimRef.current, dim > 0);
    if (dim > 0 && dimRef.current) dimRef.current.style.opacity = String(dim);
    const band = center && tunnel ? tunnel.band : null;
    setShown(bandRef.current, band !== null);
    if (band !== null && bandRef.current) bandRef.current.style.transform = `translate3d(${band.toFixed(1)}%, 0, 0)`;
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${rect.left}%`,
        top: `${rect.top}%`,
        width: `${rect.w}%`,
        height: `${rect.h}%`,
        overflow: "hidden",
        borderRadius: rect.r,
      }}
    >
      {layers.map((l) => (
        <SceneLayer key={l.id} bus={bus} scene={l.scene} bg={bg} pos={rect.pos} on={l.on} />
      ))}
      {/* B2:月台層。pan 與主窗景同源,B1 的減速曲線因此免費繼承 —— 月台滑進來、隨停站定格。
          三扇窗都疊:只給中央窗的話,進站時會變成「中央窗是夜間月台、左右窗還是白天藍天」
          —— 同一節車廂裡兩個世界(使用者實測回報)。bg 沿用各窗原本的設定(左右窗吃無地標
          的 bg 變體),objectPosition 也沿用各自的 pos,所以三扇是同一座月台的不同切片。 */}
      <PlatformLayer bus={bus} pos={rect.pos} bg={bg} />
      {/* A5:隧道壓暗。擺在玻璃**之下** —— 窗外一黑,玻璃反而更該反光(那是物理,不是裝飾)。 */}
      <div ref={dimRef} className="win-dim" style={{ display: "none" }} />
      <div ref={bandRef} className="win-dim-band" style={{ display: "none" }} />
      {/* A6:窗上那層玻璃。少了它,窗景看起來像挖了個洞直接看出去,而不是隔著車窗看。
          極淡是刻意的 —— 疊在窗景之上的任何亮度都會吃掉夜景的層次(見 audit §1.2)。 */}
      <div className="win-glass" />
    </div>
  );
}

// B2:窗外真的有站。進站時月台從無到有滑入、停站時定格、離站退出 ——
// opacity 由 eased dist 驅動(見 ScrollJourney),所以它就是 B1 減速曲線的視覺證據。
// blit 只在 opacity > 0(dist < 0.12)時執行:巡航段這一層完全不畫,零成本。
function PlatformLayer({ bus, pos, bg }: { bus: FrameBus; pos: string; bg: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef<HTMLCanvasElement | null>(null);
  useFrame(bus, () => {
    const op = bus.frame.platform;
    const c = ref.current;
    if (c) c.style.opacity = String(op);
    if (op <= 0) return; // 巡航段:不 blit
    if (!buf.current) buf.current = buildStrip("platform", bg); // 第一次真的要用到才建(第 0 站永遠不會走到這裡)
    blit(c, buf.current, bus.frame.x);
  });
  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: pos,
        imageRendering: "pixelated",
        opacity: 0,
        display: "block",
      }}
      aria-hidden
    />
  );
}

function SceneLayer({ bus, scene, bg, pos, on }: { bus: FrameBus; scene: SceneType; bg: boolean; pos: string; on: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const strip = buildStrip(scene, bg);
    buf.current = strip;
    blit(ref.current, strip, bus.frame.x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, bg]);
  // 每幀重畫的只有這一句 drawImage ×2;訂閱時的立即套用讓新掛上來的那層(換站 crossfade
  // 的上層)不必等下一次捲動就有正確的切片。
  useFrame(bus, () => {
    if (buf.current) blit(ref.current, buf.current, bus.frame.x);
  });
  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: pos,
        imageRendering: "pixelated",
        opacity: on ? 1 : 0,
        transition: "opacity .6s ease",
        display: "block",
      }}
    />
  );
}

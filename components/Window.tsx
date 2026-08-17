"use client";
import { useEffect, useRef, useState } from "react";
import { PAN_LOOPS, buildStrip } from "@/lib/strips";
import { useFrame, type FrameBus } from "@/lib/frame";
import type { SceneType } from "@/content/stations";

type Rect = { left: number; top: number; w: number; h: number; r: string; pos: string };

let uid = 0;

// ⚠️ 這個檔案是 **no-WebGL 的降級路徑**(Q3a:降規格凍結)。WebGL 可用時整個車廂在
// three 場景裡(door3d/cabin.ts),這裡一行都不會跑。
// 降級版刻意只保留「內容還讀得到」的那一半:單層窗景 + 換站 crossfade + 玻璃。
// 沒有窗景深度層(A3)、沒有月台層(B2)、沒有隧道(A5)—— 那些是 3D 場景的內容,
// 在這裡維護第二套只會讓兩邊各自漂移。

// 從 3×寬長條 [bg | full(含地標) | bg] 取一個 window 寬的切片,隨 pan 環繞平移 → 行駛感,且地標不重複。
function blit(c: HTMLCanvasElement | null, layers: { strip: HTMLCanvasElement; factor: number }[], pan: number) {
  if (!c || !layers.length) return;
  const SW = layers[0].strip.width, H = layers[0].strip.height, W = Math.round(SW / 3);
  if (c.width !== W) c.width = W;
  if (c.height !== H) c.height = H;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, W, H);
  for (const { strip, factor } of layers) {
    const off = Math.round(((((pan * factor * PAN_LOOPS) % 1) + 1) % 1) * SW); // 整數對齊,避免抖色爬行閃爍
    g.drawImage(strip, -off, 0);
    g.drawImage(strip, SW - off, 0);
  }
}

// 單一車窗:換站 crossfade(離散,走 React)+ 窗景隨捲動水平流動(連續,走 frame bus)。
export function Window({
  bus,
  scene,
  rect,
  bg,
}: {
  bus: FrameBus;
  scene: SceneType;
  rect: Rect;
  bg: boolean;
}) {
  const [layers, setLayers] = useState<{ id: number; scene: SceneType; on: boolean }[]>(() => [
    { id: uid++, scene, on: true },
  ]);

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
    return () => cancelAnimationFrame(raf);
  }, [layers]);

  // 舊層在 crossfade 走完後移除。**計時器要掛在 layers.length 上,不能掛在 layers 上**:
  // 上面那個 raf 一把 on 改成 true,layers 就換了新陣列 → effect 重跑 → cleanup 會把
  // 計時器清掉,而重跑時 pending 已經沒有了就直接 return —— 舊層於是永遠留在 DOM。
  // 實測(L1 版,這條路徑當時還是主路徑):走完六站累積 17 張 canvas,而且每一張的
  // useFrame 每幀都還在 blit。length 不會被 on 的翻面改動,所以計時器活得下來。
  useEffect(() => {
    if (layers.length < 2) return;
    const timer = setTimeout(() => setLayers((prev) => prev.slice(-1)), 700);
    return () => clearTimeout(timer);
  }, [layers.length]);

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
      {/* A6:窗上那層玻璃。少了它,窗景看起來像挖了個洞直接看出去,而不是隔著車窗看。
          極淡是刻意的 —— 疊在窗景之上的任何亮度都會吃掉夜景的層次(見 audit §1.2)。 */}
      <div className="win-glass" />
    </div>
  );
}

function SceneLayer({ bus, scene, bg, pos, on }: { bus: FrameBus; scene: SceneType; bg: boolean; pos: string; on: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef<{ strip: HTMLCanvasElement; factor: number }[] | null>(null);
  useEffect(() => {
    const strips = [{ strip: buildStrip(scene, bg), factor: 1 }];
    buf.current = strips;
    blit(ref.current, strips, bus.frame.x);
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

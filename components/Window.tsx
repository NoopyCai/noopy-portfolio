"use client";
import { useEffect, useRef, useState } from "react";
import { drawScene } from "@/lib/scene";
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

// 單一車窗:換站 crossfade + 窗景隨捲動水平流動。
export function Window({ scene, rect, bg, pan }: { scene: SceneType; rect: Rect; bg: boolean; pan: number }) {
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
    const timer = setTimeout(() => setLayers((prev) => prev.slice(-1)), 700);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [layers]);

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
        <SceneLayer key={l.id} scene={l.scene} bg={bg} pos={rect.pos} on={l.on} pan={pan} />
      ))}
    </div>
  );
}

function SceneLayer({ scene, bg, pos, on, pan }: { scene: SceneType; bg: boolean; pos: string; on: boolean; pan: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const full = getScene(scene, bg);
    const W = full.width, H = full.height;
    // 背景層(無地標):中央窗用它當左右兩段,讓地標只在中段出現一次
    const bgc: HTMLCanvasElement = bg ? full : getScene(scene, true);
    const strip = document.createElement("canvas");
    strip.width = W * 3;
    strip.height = H;
    const sg = strip.getContext("2d")!;
    sg.imageSmoothingEnabled = false;
    sg.drawImage(bgc, 0, 0);
    sg.drawImage(full, W, 0);
    sg.drawImage(bgc, W * 2, 0);
    buf.current = strip;
    blit(ref.current, strip, pan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, bg]);
  useEffect(() => {
    blit(ref.current, buf.current, pan);
  }, [pan]);
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

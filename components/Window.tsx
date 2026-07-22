"use client";
import { useEffect, useRef, useState } from "react";
import { drawScene } from "@/lib/scene";
import type { SceneType } from "@/content/stations";

type Rect = { left: number; top: number; w: number; h: number; r: string; pos: string };

let uid = 0;

// 單一車窗:換站時新場景 crossfade 淡入、舊場景淡出(平滑過渡)。
export function Window({ scene, rect, bg }: { scene: SceneType; rect: Rect; bg: boolean }) {
  const [layers, setLayers] = useState<{ id: number; scene: SceneType; on: boolean }[]>(() => [
    { id: uid++, scene, on: true },
  ]);

  // 場景改變 → 疊一層新場景(初始 opacity 0)
  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top.scene === scene) return prev;
      return [...prev, { id: uid++, scene, on: false }];
    });
  }, [scene]);

  // 新層掛載後下一幀翻成 on(觸發淡入),過渡結束移除舊層
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
        <SceneLayer key={l.id} scene={l.scene} bg={bg} pos={rect.pos} on={l.on} />
      ))}
    </div>
  );
}

function SceneLayer({ scene, bg, pos, on }: { scene: SceneType; bg: boolean; pos: string; on: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawScene(ref.current, scene, { bg });
  }, [scene, bg]);
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

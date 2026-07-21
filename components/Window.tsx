"use client";
import { useEffect, useRef } from "react";
import { drawScene } from "@/lib/scene";
import type { SceneType } from "@/content/stations";

type Rect = { left: number; top: number; w: number; h: number; r: string; pos: string };

// 單一車窗:依 rect(% of 車廂圖)絕對定位,canvas 用 drawScene 繪製,object-fit cover 顯示對應片段。
export function Window({ scene, rect, bg }: { scene: SceneType; rect: Rect; bg: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawScene(ref.current, scene, { bg });
  }, [scene, bg]);
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
      <canvas
        ref={ref}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: rect.pos, imageRendering: "pixelated", display: "block" }}
      />
    </div>
  );
}

"use client";
import { Play, ChevronDown, ArrowUpRight, X, Volume2, VolumeX } from "lucide-react";

// lucide-react 的薄包裝:統一尺寸(預設跟著字級)、方切端點與 miter 轉角 ——
// lucide 預設是圓端點,和像素字型 / LED 的硬邊不搭,這裡覆寫掉。
// 語意固定:play=前進/出發、chevron=展開、external=離站外連、close=關閉、sound/mute=音效。
const SET = { play: Play, chevron: ChevronDown, external: ArrowUpRight, close: X, sound: Volume2, mute: VolumeX };

export type IconName = keyof typeof SET;

export function Icon({
  name,
  size = "1em",
  flip,
}: {
  name: IconName;
  size?: number | string;
  flip?: boolean;
}) {
  const Glyph = SET[name];
  return (
    <Glyph
      className="icon"
      size={size as number}
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      fill={name === "play" ? "currentColor" : "none"}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden
      focusable="false"
    />
  );
}

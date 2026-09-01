"use client";
import React from "react";

// 出處:使用者提供的 liquid-glass 元件(原為 shadcn / Tailwind 專案用)。移植原則:
// · 玻璃層疊(折射 → 提亮 → 雙鏡面內光)與 #glass-distortion 濾鏡參數**逐字保留**。
// · Tailwind 工具類轉譯為等值 inline style(rounded-3xl = 24px、duration-700 = 700ms)
//   —— 不裝 Tailwind:preflight 會重置全站既有元素樣式,而玻璃本體與類名無關,
//   轉譯後的渲染結果與原元件相同。
// · 原檔的 GlassDock / GlassButton / 示範 Component(dock 圖示、unsplash 背景、
//   moveBackground 動畫)是 demo 專用,不搬。
// · 文字色(text-black)與字重(font-semibold)刻意不帶:黑字壓在 25% 白玻璃 + 夜景
//   上不可讀,卡片內容維持站內字體系統。cursor 只在有 href 時才是 pointer(原元件
//   恆為 pointer,非互動卡片不該誤導)。
// · Chrome:backdrop-filter + filter: url(#glass-distortion) = 正統液態折射;
//   Safari 的 SVG 濾鏡吃不到 backdrop(層本身是透明像素),自動退回 blur ——
//   與 globals.css 舊 .glasscard 註解描述的瀏覽器差異一致。
// · 層的 class(lg-*)是 globals.css 無障礙降級的掛鉤:inline style 只有 !important
//   蓋得過,詳見該處註解。

const R = 24; // rounded-3xl

interface GlassEffectProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  target?: string;
}

export const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = "",
  style = {},
  href,
  target = "_blank",
}) => {
  const glassStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: "column", // 原元件是 flex 橫排(dock 用);卡片內容是縱向流
    overflow: "hidden",
    borderRadius: R,
    cursor: href ? "pointer" : undefined,
    boxShadow: "0 6px 6px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1)",
    // transition: all 在這裡是安全的:淡入的 opacity/transform 寫在外層
    // .station-panel(坑 5),這個殼上沒有逐幀直寫的屬性
    transition: "all 0.7s",
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
    ...style,
  };

  const content = (
    <div className={className ? `glass-fx ${className}` : "glass-fx"} style={glassStyle}>
      {/* 層 0:折射(Chrome)/ blur(Safari) */}
      <div
        className="lg-distort"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          borderRadius: R,
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          filter: "url(#glass-distortion)",
          isolation: "isolate",
        }}
      />
      {/* 層 10:白玻璃提亮 */}
      <div
        className="lg-veil"
        style={{ position: "absolute", inset: 0, zIndex: 10, borderRadius: R, background: "rgba(255, 255, 255, 0.25)" }}
      />
      {/* 層 20:雙鏡面內光(左上入光、右下回光) */}
      <div
        className="lg-shine"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          overflow: "hidden",
          borderRadius: R,
          boxShadow:
            "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.5)",
        }}
      />
      {/* 內容層 */}
      <div style={{ position: "relative", zIndex: 30 }}>{children}</div>
    </div>
  );

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" style={{ display: "block" }}>
      {content}
    </a>
  ) : (
    content
  );
};

// SVG 濾鏡:參數逐字照抄原元件。display:none 的 SVG 只是濾鏡定義的宿主,
// 必須常駐 DOM(掛在 ScrollJourney 的 stage 裡),被引用的層才折射得到。
export const GlassFilter: React.FC = () => (
  <svg style={{ display: "none" }} aria-hidden>
    <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
      <feTurbulence type="fractalNoise" baseFrequency="0.001 0.005" numOctaves="1" seed="17" result="turbulence" />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />
      <feDisplacementMap in="SourceGraphic" in2="softMap" scale="200" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>
);

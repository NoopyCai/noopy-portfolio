"use client";
import { useRef } from "react";
import { WIN, LED_RECT, gradeFilter } from "@/lib/progress";
import { useFrame, setShown, type FrameBus } from "@/lib/frame";
import { Window } from "./Window";
import { LedSign } from "./LedSign";
import { GRADE_BLEND, type SceneType } from "@/content/stations";

// TunnelFx 的定義搬到 lib/frame.ts —— 它現在是 frame bus 的一個欄位,不再是這裡的 prop。

// 靜態車廂圖 + 三扇 live 車窗(idx0 中央=完整,其餘 bg)+ LED 覆蓋 + 燈光分級 overlay。
//
// 這個元件只吃**離散**的 props(scene / ledText,換站才變)。grade、pan、月台層、隧道層
// 全部是連續量,走 frame bus 直接寫 DOM(階段 0,audit §4.3)—— 捲動時這裡零 re-render。
export function CabinComposite({
  bus,
  scene,
  ledText,
  frontRef,
}: {
  bus: FrameBus;
  scene: SceneType;
  ledText: string;
  /** L1 立柱層的**容器**。ScrollJourney 的 sway 迴圈每幀直接寫它的 transform(見那裡的
   *  推導)。容器裡是 img + 它自己的 tint 層,兩者共用同一組位移,所以只寫一次 */
  frontRef: React.RefObject<HTMLDivElement | null>;
}) {
  const img = useRef<HTMLImageElement>(null);
  const frontImg = useRef<HTMLImageElement>(null);
  const frontTint = useRef<HTMLDivElement>(null);
  const tint = useRef<HTMLDivElement>(null);
  const lift = useRef<HTMLDivElement>(null);
  const sweep = useRef<HTMLDivElement>(null);
  const sweepBand = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);

  useFrame(bus, () => {
    const { grade, tunnel } = bus.frame;
    // 立柱層吃**同一組** grade:少了這行,傍晚出發、天亮到站的燈光曲線會整趟繞過立柱,
    // 車廂由暖轉冷而立柱定色不動 —— 那比沒有立柱還糟。
    // 兩張圖各套一次,而不是包一層 div 套一次:filter 會讓那一層先光柵化成一張圖再交給
    // 上層的 sway scale(1.035)縮放 —— 等於多一次重取樣。實測(1440×900 逐點截圖)車廂
    // 圖上的小字會軟掉:博愛座海報區的橫向梯度能量 11.12 → 9.44(−15%),告示區 −6%。
    // cabin.jpg 在 1920 寬的桌機本來就要放大 1.19×(CLAUDE.md 坑 9),禁不起再軟一次。
    const f = gradeFilter(grade);
    if (img.current) img.current.style.filter = f;
    // filter 寫在**裡面那張 img** 上而不是容器上 —— 同一個坑:容器套 filter 會讓
    // 「img + tint」整組先光柵化成一張圖,再交給 sway 的 scale(1.035),多一次重取樣。
    if (frontImg.current) frontImg.current.style.filter = f;
    if (tint.current) tint.current.style.background = grade.tint;
    // 立柱層的 tint 與底圖那層同色同 blend,差別只有遮罩(見 globals.css)
    if (frontTint.current) frontTint.current.style.background = grade.tint;
    // 隧道三層:區間外收成 display:none(等價於舊的條件式掛載 —— 不進 paint、不產生
    // 合成層,只是不再需要一次 re-render 才能掛上來)。
    const on = tunnel !== null;
    setShown(lift.current, on);
    setShown(sweep.current, on);
    if (tunnel) {
      if (lift.current) lift.current.style.opacity = String(tunnel.lift);
      if (sweepBand.current) {
        sweepBand.current.style.transform = `translate3d(${-tunnel.sweep.toFixed(2)}%, 0, 0)`;
        sweepBand.current.style.opacity = tunnel.lift > 0 ? "1" : "0";
      }
    }
    const flashOn = tunnel !== null && tunnel.flash > 0;
    setShown(flash.current, flashOn);
    if (flashOn && flash.current) flash.current.style.opacity = String(tunnel!.flash);
  });

  return (
    // cover:任何比例都填滿畫面(寬螢幕吃 100vw、直式吃 177.68vh)。不要加上限 —— 加了直式就會出現上下留邊。
    <div style={{ position: "relative", width: "max(100vw, 177.68vh)", lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src="/cabin.jpg"
        alt="EMU900 車廂內裝 · EMU900 train interior"
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      {/* 沒有 transition:grade 已經是逐幀連續插值(lerpGrade),再加 .8s 追趕只會跟 scrub
          打架 —— 捲動停下後燈光還要自己再飄 0.8 秒,那正是「燈光跟不上窗景」的來源。 */}
      <div
        ref={tint}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: GRADE_BLEND as React.CSSProperties["mixBlendMode"] }}
      />
      {/* 隧道的兩層「車內光」擺在窗**之前**:光帶掃的是車廂內壁,不該把壓暗的窗景又提亮。
          用 % / inset 定位,直式 cover 裁切下位置自然跟著對(不寫死 px)。 */}
      <div ref={lift} className="tunnel-lift" style={{ display: "none" }} />
      <div ref={sweep} className="tunnel-sweep" style={{ display: "none" }}>
        <div ref={sweepBand} className="tunnel-sweep-band" />
      </div>
      {WIN.map((r, i) => (
        <Window key={i} bus={bus} scene={scene} rect={r} bg={i !== 0} center={i === 0} />
      ))}
      {/* 出洞回光:蓋在窗之上(光是從窗外潑進來的),但擺在 LED 之前,跑馬燈不該被洗白 */}
      <div ref={flash} className="tunnel-flash" style={{ display: "none" }} />
      <div style={{ position: "absolute", left: `${LED_RECT.left}%`, top: `${LED_RECT.top}%`, width: `${LED_RECT.w}%`, height: `${LED_RECT.h}%` }}>
        <LedSign text={ledText} />
      </div>
      {/* L1 前景層:立柱 ×2 + 頂端橫杆的去背圖,與 back 同一組 cover 幾何疊上去,
          位移由 sway 迴圈每幀寫進 style.transform(係數 1.7 + 自帶 scale 1.06,推導見
          ScrollJourney);靜態樣式在 globals.css 的 .cabin-front。
          **必須是這一塊的最後一個節點**,也就是連 LED 都畫在它底下:橫杆(圖上 y
          10.5–12.6%,再被 front 自己的 1.024 過掃描往上推)與 LED 顯示區(LED_RECT 到
          y 10.4%)在螢幕上本來就擦邊,而視差讓 front 垂直多走到 ±23px —— 滑鼠推到右下角
          時橫杆上緣會切進 LED 面板 17px。橫杆在物理上比牆面顯示器更靠近觀者,所以那 17px
          必須是橫杆蓋住跑馬燈,不是反過來(舊順序:LED 最後畫 → 實測那 17px 讀到的是
          LED 的 #050805 底色,深度反了)。跑馬燈的文字是垂直居中的,被遮的是面板下緣的
          空白帶,文字不受影響。
          代價是前景移出了 tint / 隧道兩層 inset:0 覆蓋的範圍(它們現在只作用在底圖上):
            · tint:補回來了 —— 容器裡自帶一層(下面那個 .cabin-front-tint)。不補的話
              立柱的色相會定住(實測 river 站 R 偏 +10/255、city 站 −9,ΔE ≈ 6),而
              「車廂由暖轉冷而立柱定色不動」正是這一層最不該有的樣子。
            · 隧道的 lift/sweep 掃不到立柱(實測差 ≤ 1.7/255):L2 才有真正的深度掃光,
              現在接受。
          立柱與三扇窗在構圖上零重疊(立柱 x 20.2–21.6 / 78.3–79.7%,窗在 3.2–10.1 /
          31.2–68.8 / 90–97.2%),所以「立柱畫在窗之上」也看不出來。
          門場景的背板是同樣的順序合成(cabin → LED 塗黑 → front,見 door3d/scene.ts),
          交棒那一幀兩邊仍然對得上(實測欄剖面互相關 lag −0.40 / −0.50 px)。
          載入失敗 = 只剩無立柱的 back,整頁仍完整可用(onError 把整個容器收掉 —— 連 tint
          那層一起,不然遮罩用的同一張圖也載不下來,soft-light 會塗成一片色紗)。 */}
      <div className="cabin-front" ref={frontRef}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={frontImg}
          src="/cabin/cabin-front.png"
          alt=""
          aria-hidden
          onError={(e) => { const w = e.currentTarget.parentElement; if (w) w.style.display = "none"; }}
        />
        {/* 立柱層自己的 tint(遮罩與定位在 globals.css)。blend 吃 GRADE_BLEND 與底圖那層
            同源;顏色由上面的 useFrame 每幀寫成同一個 grade.tint,所以立柱與車廂壁永遠
            是同一道光 —— 這一層在的理由:前景排到 LED 之後就吃不到底圖那片 inset:0 的
            tint 了,而少了它立柱的色相會定住(實測 river 站 R 偏 +10/255、city 站 −9,
            ΔE ≈ 6,1× 下讀得出來是「另一種金屬」)。 */}
        <div
          ref={frontTint}
          className="cabin-front-tint"
          style={{ mixBlendMode: GRADE_BLEND as React.CSSProperties["mixBlendMode"] }}
        />
      </div>
    </div>
  );
}

"use client";

function Seat({ x, pri }: { x: number; pri?: boolean }) {
  return (
    <g>
      <rect x={x + 8} y={500} width={104} height={104} rx={18} />
      <line x1={x + 8} y1={540} x2={x + 112} y2={540} strokeWidth={1.5} opacity={0.7} />
      <rect x={x} y={598} width={120} height={74} rx={16} />
      <path d={`M${x + 22} 672 v34 M${x + 98} 672 v34`} />
      {pri && <rect x={x + 40} y={512} width={40} height={34} rx={6} strokeWidth={1.5} />}
    </g>
  );
}

// 綠色線稿車廂(Boot 階段)。fill 0→1 控制三扇車窗由左至右填滿綠色。
export function WireCar({ fill }: { fill: number }) {
  const win = (x: number, y: number, w: number, h: number, rx: number) => (
    <rect className="winfill" x={x} y={y} width={w} height={h} rx={rx} style={{ transform: `scaleX(${fill})` }} />
  );
  return (
    <svg className="wirecar" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet" aria-label="EMU900 車廂線稿藍圖">
      {/* 車窗填滿層(在框線之下) */}
      {win(70, 212, 182, 288, 16)}
      {win(1348, 212, 182, 288, 16)}
      {win(486, 212, 628, 378, 38)}
      {/* LED 顯示器 */}
      <rect className="led-p" x={300} y={16} width={1000} height={52} rx={8} />
      <text className="led-t" x={800} y={52} textAnchor="middle" style={{ fontSize: 30, letterSpacing: 6, fontWeight: 700 }}>
        區間車 · 往 記憶 FOR MEMORY ▸
      </text>
      {/* 行李架 / 廣告帶 + 綠腰帶 */}
      <rect className="draw" x={120} y={82} width={1360} height={46} rx={6} />
      <rect className="draw" x={360} y={92} width={160} height={26} rx={4} />
      <rect className="draw" x={1080} y={92} width={160} height={26} rx={4} />
      <rect className="accent" x={120} y={138} width={1360} height={7} rx={3.5} />
      {/* 拉桿 + 吊環 */}
      <line className="draw" x1={260} y1={168} x2={1340} y2={168} />
      <g className="draw">
        <line x1={380} y1={168} x2={380} y2={200} /><circle cx={380} cy={216} r={16} />
        <line x1={560} y1={168} x2={560} y2={200} /><circle cx={560} cy={216} r={16} />
        <line x1={740} y1={168} x2={740} y2={200} /><circle cx={740} cy={216} r={16} />
        <line x1={900} y1={168} x2={900} y2={200} /><circle cx={900} cy={216} r={16} />
      </g>
      <g className="strapp-s">
        <line x1={1080} y1={168} x2={1080} y2={200} /><circle cx={1080} cy={216} r={16} />
        <line x1={1220} y1={168} x2={1220} y2={200} /><circle cx={1220} cy={216} r={16} />
      </g>
      {/* 側窗 + 中央門窗 */}
      <rect className="draw" x={70} y={212} width={182} height={288} rx={16} />
      <rect className="draw" x={1348} y={212} width={182} height={288} rx={16} />
      <rect className="draw" x={456} y={184} width={688} height={612} rx={14} />
      <rect className="draw" x={486} y={212} width={628} height={378} rx={38} />
      <line className="draw thin" x1={800} y1={212} x2={800} y2={590} />
      <line className="draw thin" x1={800} y1={620} x2={800} y2={792} />
      {/* 三叉立柱 */}
      <g className="draw">
        <path d="M300 168 V612" /><path d="M300 168 l-22 -26 M300 168 l22 -26 M300 168 v-30" />
        <path d="M1300 168 V612" /><path d="M1300 168 l-22 -26 M1300 168 l22 -26 M1300 168 v-30" />
      </g>
      {/* 座椅 */}
      <g className="draw">
        <Seat x={180} /><Seat x={320} /><Seat x={460} /><Seat x={1000} /><Seat x={1140} /><Seat x={1280} pri />
      </g>
      <line className="draw thin" x1={120} y1={792} x2={1480} y2={792} />
      {/* 博愛座標示 */}
      <g>
        <circle className="sign" cx={1300} cy={470} r={18} />
        <circle className="sign" cx={1300} cy={463} r={6} />
        <path className="sign" d="M1289 480 q11 -13 22 0" />
      </g>
    </svg>
  );
}

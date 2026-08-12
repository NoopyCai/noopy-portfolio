import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "NoopyCai · The Night Local portfolio";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 90,
          background: "#1f241f",
          color: "#e9eff8",
          fontFamily: "monospace",
        }}
      >
        <div style={{ color: "#06ff31", fontSize: 30, letterSpacing: 10 }}>◄ THE NIGHT LOCAL ►</div>
        <div style={{ fontSize: 104, fontWeight: 800, marginTop: 18 }}>NoopyCai</div>
        <div style={{ fontSize: 42, color: "#6eb43f", marginTop: 6 }}>Frontend / Full-stack Engineer</div>
        <div style={{ fontSize: 26, color: "#8b98ad", marginTop: 28 }}>
          Taiwan night-train themed portfolio · scroll to ride
        </div>
      </div>
    ),
    { ...size }
  );
}

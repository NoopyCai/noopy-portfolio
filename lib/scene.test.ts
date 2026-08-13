import { describe, it, expect } from "vitest";
import { drawScene } from "./scene";

function fakeCanvas() {
  const calls: string[] = [];
  // platform 站的站名燈牌走 fillText(唯一用到 2D 文字 API 的地方),所以 stub 要有它
  const ctx: any = {
    imageSmoothingEnabled: false, fillStyle: "", font: "", textAlign: "", textBaseline: "",
    fillRect: () => { calls.push("fillRect"); },
    fillText: () => { calls.push("fillText"); },
  };
  const canvas: any = { width: 0, height: 0, getContext: () => ctx };
  return { canvas, calls };
}

describe("drawScene", () => {
  it("draws without throwing and issues many fill calls", () => {
    const { canvas, calls } = fakeCanvas();
    expect(() => drawScene(canvas, "city")).not.toThrow();
    expect(calls.filter((c) => c === "fillRect").length).toBeGreaterThan(50);
  });
  it("draws every scene type without throwing", () => {
    for (const t of ["platform", "city", "river", "taipei", "field", "sea"] as const) {
      const { canvas, calls } = fakeCanvas();
      expect(() => drawScene(canvas, t)).not.toThrow();
      expect(calls.filter((c) => c === "fillRect").length).toBeGreaterThan(50);
    }
  });
  it("bg mode issues fewer fills than full for 'sea' (skips sun/boat/headland)", () => {
    const a = fakeCanvas(); drawScene(a.canvas, "sea", { bg: false });
    const b = fakeCanvas(); drawScene(b.canvas, "sea", { bg: true });
    const cnt = (c: string[]) => c.filter((x) => x === "fillRect").length;
    expect(cnt(b.calls)).toBeLessThan(cnt(a.calls));
  });
});

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
  // A3 深度層(階段 1)。三件事要守住:向後相容、far 不含地標、月台不拆。
  const fills = (c: string[]) => c.filter((x) => x === "fillRect").length;
  it("layer 不傳 = 完整版:far 與 near 各自都比它少", () => {
    for (const t of ["city", "river", "taipei", "field", "sea"] as const) {
      const all = fakeCanvas(); drawScene(all.canvas, t);
      const far = fakeCanvas(); drawScene(far.canvas, t, { layer: "far" });
      const near = fakeCanvas(); drawScene(near.canvas, t, { layer: "near" });
      expect(fills(far.calls), t).toBeGreaterThan(0);
      expect(fills(near.calls), t).toBeGreaterThan(0);
      expect(fills(far.calls), t).toBeLessThan(fills(all.calls));
      expect(fills(near.calls), t).toBeLessThan(fills(all.calls));
    }
  });
  it("far 層不畫地標(bg 與 full 是同一張圖 —— 快取因此每站只有 3 張)", () => {
    for (const t of ["city", "river", "taipei", "field", "sea"] as const) {
      const a = fakeCanvas(); drawScene(a.canvas, t, { bg: false, layer: "far" });
      const b = fakeCanvas(); drawScene(b.canvas, t, { bg: true, layer: "far" });
      expect(a.calls, t).toEqual(b.calls);
    }
  });
  it("月台不拆層:整組留在 far,near 是空的", () => {
    const far = fakeCanvas(); drawScene(far.canvas, "platform", { layer: "far" });
    const near = fakeCanvas(); drawScene(near.canvas, "platform", { layer: "near" });
    const all = fakeCanvas(); drawScene(all.canvas, "platform");
    expect(fills(far.calls)).toBe(fills(all.calls));
    expect(near.calls.length).toBe(0);
  });
  it("bg mode issues fewer fills than full for 'sea' (skips sun/boat/headland)", () => {
    const a = fakeCanvas(); drawScene(a.canvas, "sea", { bg: false });
    const b = fakeCanvas(); drawScene(b.canvas, "sea", { bg: true });
    const cnt = (c: string[]) => c.filter((x) => x === "fillRect").length;
    expect(cnt(b.calls)).toBeLessThan(cnt(a.calls));
  });
});

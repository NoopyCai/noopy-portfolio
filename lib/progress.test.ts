import { describe, it, expect } from "vitest";
import { phaseOf, doorProgress, rideProgress, exitProgress, stationAt, lerpGrade, stationEase, DWELL } from "./progress";
import type { Grade } from "@/content/stations";

describe("progress", () => {
  it("phaseOf: gate / ride / exit", () => {
    expect(phaseOf(0)).toBe("gate");
    expect(phaseOf(0.5)).toBe("ride");
    expect(phaseOf(0.9)).toBe("exit");
  });
  it("doorProgress 0 at gateEnd, 1 at doorEnd", () => {
    expect(doorProgress(0.13)).toBeCloseTo(0, 5);
    expect(doorProgress(0.22)).toBeCloseTo(1, 5);
    expect(doorProgress(0.5)).toBe(1); // 之後恆為 1
  });
  it("rideProgress 0 at doorEnd(門開完才起步), 1 at rideEnd", () => {
    expect(rideProgress(0.13)).toBe(0); // door 期間車還停在第一站
    expect(rideProgress(0.22)).toBeCloseTo(0, 5);
    expect(rideProgress(0.8)).toBeCloseTo(1, 5);
  });
  it("exitProgress 0 at rideEnd, 1 at end", () => {
    expect(exitProgress(0.8)).toBeCloseTo(0, 5);
    expect(exitProgress(1)).toBeCloseTo(1, 5);
  });
  // ── B1 到站減速曲線 ──
  it("stationEase: 整數點恆等(jumpTo 的線性目標才會落在停站窗口正中)", () => {
    for (let i = 0; i <= 5; i++) expect(stationEase(i)).toBeCloseTo(i, 10);
  });
  it("stationEase: 單調不減(倒著捲就是倒著開,不能有折返)", () => {
    let prev = -Infinity;
    for (let k = 0; k <= 500; k++) {
      const v = stationEase(k / 100);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });
  it("stationEase: 整數點兩側導數趨近 0(停站窗口內完全靜止)", () => {
    const h = DWELL / 2; // 取樣點仍在停站窗口內
    for (let i = 1; i <= 4; i++) {
      expect(Math.abs(stationEase(i + h) - stationEase(i)) / h).toBeLessThan(0.01);
      expect(Math.abs(stationEase(i) - stationEase(i - h)) / h).toBeLessThan(0.01);
    }
  });
  it("stationEase: 中點對稱(巡航段的正中央不偏移)", () => {
    for (let i = 0; i <= 4; i++) expect(stationEase(i + 0.5)).toBeCloseTo(i + 0.5, 10);
  });

  it("stationAt maps ride progress to station index", () => {
    expect(stationAt(0, 6).index).toBe(0);
    expect(stationAt(0.99, 6).index).toBe(5);
  });
  it("lerpGrade blends grade colour and switches filter at midpoint", () => {
    const a: Grade = { filter: "brightness(1)", grade: "rgba(0,0,0,0)", blend: "soft-light" };
    const b: Grade = { filter: "brightness(2)", grade: "rgba(100,100,100,1)", blend: "screen" };
    expect(lerpGrade(a, b, 0).filter).toBe("brightness(1)");
    expect(lerpGrade(a, b, 1).filter).toBe("brightness(2)");
    expect(lerpGrade(a, b, 0.5).grade).toBe("rgba(50,50,50,0.500)");
  });
});

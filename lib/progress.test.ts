import { describe, it, expect } from "vitest";
import { phaseOf, doorProgress, rideProgress, exitProgress, stationAt, lerpGrade } from "./progress";
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

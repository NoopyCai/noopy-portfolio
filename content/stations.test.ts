import { describe, it, expect } from "vitest";
import { STATIONS } from "./stations";

describe("STATIONS", () => {
  it("has 6 stations in fixed order", () => {
    expect(STATIONS.map((s) => s.id)).toEqual([
      "platform",
      "recommendation",
      "liff",
      "ai",
      "skills",
      "terminal",
    ]);
  });

  it("every station is bilingual and has a grade + scene", () => {
    for (const s of STATIONS) {
      expect(s.name.zh).toBeTruthy();
      expect(s.name.en).toBeTruthy();
      expect(s.led.zh).toBeTruthy();
      expect(s.led.en).toBeTruthy();
      expect(s.grade.filter).toMatch(/brightness/);
      expect(["platform", "city", "river", "taipei", "field", "sea"]).toContain(s.scene);
    }
  });

  it("never exposes phone or address", () => {
    const blob = JSON.stringify(STATIONS);
    expect(blob).not.toMatch(/0900|四維路|五股/);
  });
});

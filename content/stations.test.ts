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
      expect(s.grade.brightness).toBeGreaterThan(0);
      expect(s.grade.saturate).toBeGreaterThan(0);
      expect(s.grade.tint).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
      expect(["platform", "city", "river", "taipei", "field", "sea"]).toContain(s.scene);
    }
  });

  // 燈光曲線是這個作品集唯一無法被複製的資產,所以它的形狀要被測試釘住(audit §3.1)。
  it("燈光曲線講得成一句話:傍晚出發、深夜谷底、天亮到站", () => {
    const b = Object.fromEntries(STATIONS.map((s) => [s.id, s.grade.brightness]));
    // 主題是「夜車」:除了黃昏(city)與破曉(terminal)兩個端點,沒有一站可以亮過白天
    for (const s of STATIONS) expect(s.grade.brightness).toBeLessThanOrEqual(1.05);
    expect(b.recommendation).toBeGreaterThan(b.platform); // 出發後最後一段黃昏
    expect(b.liff).toBeLessThan(b.platform);              // 入夜,跌進谷底
    expect(b.ai).toBeLessThan(b.platform);                // 深夜台北仍然是夜(舊版這裡是 1.5 的正午)
    expect(b.skills).toBeLessThan(b.platform);            // 凌晨田野
    expect(b.terminal).toBeGreaterThan(b.skills);         // 破曉:唯一的亮結尾
    expect(b.terminal).toBeGreaterThan(b.ai);
  });

  it("never exposes phone or address", () => {
    const blob = JSON.stringify(STATIONS);
    expect(blob).not.toMatch(/0900|四維路|五股/);
  });
});

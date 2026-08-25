import { describe, it, expect } from "vitest";
import { ABOUT, STATIONS } from "./stations";

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

  // 時刻表看板(Concourse)直接讀這兩個欄位,少一個就是表格開天窗
  it("每一站都有月台代號,而且不等於站序(不然那一欄只是把第一欄再寫一次)", () => {
    const plats = STATIONS.map((s) => s.platform);
    for (const p of plats) expect(p).toMatch(/^\d[A-Z]?$/);
    expect(plats).not.toEqual(STATIONS.map((_, i) => String(i + 1)));
  });

  it("三個作品站有截圖佐證(雙語 alt),其餘站沒有", () => {
    const withShot = STATIONS.filter((s) => s.panel.screenshot);
    expect(withShot.map((s) => s.id)).toEqual(["recommendation", "liff", "ai"]);
    for (const s of withShot) {
      expect(s.panel.screenshot!.src).toMatch(/^\/imgs\/.+\.jpg$/);
      expect(s.panel.screenshot!.alt.zh.length).toBeGreaterThan(10);
      expect(s.panel.screenshot!.alt.en.length).toBeGreaterThan(10);
    }
    expect(STATIONS.filter((s) => s.panel.kind !== "project").some((s) => s.panel.screenshot)).toBe(false);
  });

  // h1 只顯示 NoopyCai,中文全名的可搜尋性靠「關於我」內文 + JSON-LD + metadata 三處保全
  it("關於我三段:雙語、不重抄站 1、第一段含中文全名、第三段含 GitHub", () => {
    expect(ABOUT).toHaveLength(3);
    for (const p of ABOUT) {
      expect(p.zh.length).toBeGreaterThan(20);
      expect(p.en.length).toBeGreaterThan(20);
    }
    expect(ABOUT[0].zh).toContain("蔡守傑");
    expect(ABOUT[2].zh).toContain("GitHub");
    expect(ABOUT[2].en).toContain("GitHub");
    expect(ABOUT.some((p) => p.zh === STATIONS[0].panel.body?.zh)).toBe(false);
  });

  // 終點站車廂內不再渲染聯絡資訊,但資料要留著:StaticFallback 與 Concourse 都靠它
  it("終點站仍持有 contacts 與履歷連結(降級版與大廳的唯一來源)", () => {
    const p = STATIONS[STATIONS.length - 1].panel;
    expect(p.contacts?.length).toBeGreaterThanOrEqual(3);
    expect(p.link).toBeTruthy();
  });

  it("每一站都有雙語狀態(時刻表狀態欄)", () => {
    for (const s of STATIONS) {
      expect(s.status.zh.length, s.id).toBeGreaterThan(0);
      expect(s.status.en.length, s.id).toBeGreaterThan(0);
    }
  });

  it("never exposes phone or address", () => {
    const blob = JSON.stringify(STATIONS);
    expect(blob).not.toMatch(/0900|四維路|五股/);
  });
});

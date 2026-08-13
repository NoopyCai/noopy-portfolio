import { describe, it, expect } from "vitest";
import { phaseOf, doorProgress, rideProgress, exitProgress, exitDoorProgress, tunnelProgress, stationAt, lerpGrade, gradeFilter, stationEase, DWELL, PHASE, EXIT_DOOR, TUNNEL } from "./progress";
import { STATIONS, type Grade } from "@/content/stations";

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
  // ── E1 出站的門 ──
  const pOf = (e: number) => PHASE.rideEnd + e * (1 - PHASE.rideEnd); // e → 全域 progress
  it("exitDoorProgress: ride 期間恆 0(門只在出站才存在)", () => {
    expect(exitDoorProgress(0.5)).toBe(0);
    expect(exitDoorProgress(PHASE.rideEnd)).toBe(0);
    expect(exitDoorProgress(pOf(0.5))).toBe(0); // 起身/半拍/轉身期間門還沒淡入
  });
  it("exitDoorProgress: e 0.62 → 0、0.95 → 1、之後恆 1(門關上就不再動)", () => {
    expect(exitDoorProgress(pOf(EXIT_DOOR.start))).toBeCloseTo(0, 10);
    expect(exitDoorProgress(pOf((EXIT_DOOR.start + EXIT_DOOR.end) / 2))).toBeCloseTo(0.5, 10);
    expect(exitDoorProgress(pOf(EXIT_DOOR.end))).toBeCloseTo(1, 10);
    expect(exitDoorProgress(1)).toBe(1);
  });
  it("exitDoorProgress: 單調不減(倒著捲門就重新打開,不能有折返)", () => {
    let prev = -Infinity;
    for (let k = 0; k <= 200; k++) {
      const v = exitDoorProgress(k / 200);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });

  // ── A5 隧道段 ──
  it("tunnelProgress: 區間端點 0/1,且完全落在資訊卡的隱藏區間(dist > 0.34)內", () => {
    expect(tunnelProgress(TUNNEL.from)).toBeCloseTo(0, 10);
    expect(tunnelProgress(TUNNEL.to)).toBeCloseTo(1, 10);
    expect(tunnelProgress(2.0)).toBe(0); // 站上不在洞裡
    expect(tunnelProgress(3.0)).toBe(1); // 出洞後仍是 1(曲線兩端都收斂成「沒事發生」)
    // 卡片在 dist > 0.34 才隱藏 ⇒ 可讀區間是 x ∈ [2, 2.34] ∪ [2.66, 3]
    expect(TUNNEL.from).toBeGreaterThan(2.34);
    expect(TUNNEL.to).toBeLessThan(2.66);
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
  // ── 燈光 grade 的連續插值(audit §3.2)──
  const gA: Grade = { brightness: 1, saturate: 1, tint: "rgba(0,0,0,0)" };
  const gB: Grade = { brightness: 2, saturate: 1.5, contrast: 1.2, tint: "rgba(100,100,100,1)" };
  it("lerpGrade:三個數字與 tint 全部線性插值(不再有中點硬切)", () => {
    const m = lerpGrade(gA, gB, 0.5);
    expect(m.brightness).toBeCloseTo(1.5, 10);
    expect(m.saturate).toBeCloseTo(1.25, 10);
    expect(m.contrast).toBeCloseTo(1.1, 10); // 缺省的 contrast 當作 1
    expect(m.tint).toBe("rgba(50,50,50,0.500)");
  });
  it("lerpGrade:端點恆等,且 brightness 沿 t 單調連續(掃 200 格不得有跳階)", () => {
    expect(lerpGrade(gA, gB, 0).brightness).toBeCloseTo(gA.brightness, 10);
    expect(lerpGrade(gA, gB, 1).brightness).toBeCloseTo(gB.brightness, 10);
    let prev = lerpGrade(gA, gB, 0).brightness;
    for (let k = 1; k <= 200; k++) {
      const v = lerpGrade(gA, gB, k / 200).brightness;
      expect(v - prev).toBeGreaterThan(0);            // 嚴格遞增
      expect(v - prev).toBeLessThan(0.02);            // 每格的變化都很小 = 沒有硬切
      prev = v;
    }
  });
  it("gradeFilter:contrast 等於 1 就不輸出", () => {
    expect(gradeFilter(gA)).toBe("brightness(1.000) saturate(1.000)");
    expect(gradeFilter(gB)).toBe("brightness(2.000) saturate(1.500) contrast(1.200)");
  });
  it("六站的實際 grade 在轉場中都不會產生負值或爆亮", () => {
    for (let i = 0; i < STATIONS.length - 1; i++)
      for (let k = 0; k <= 20; k++) {
        const g = lerpGrade(STATIONS[i].grade, STATIONS[i + 1].grade, k / 20);
        expect(g.brightness).toBeGreaterThan(0.5);
        expect(g.brightness).toBeLessThanOrEqual(1.06);
      }
  });
});

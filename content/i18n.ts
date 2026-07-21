export type Lang = "zh" | "en";
export type Bi = { zh: string; en: string };

export const UI = {
  board: { zh: "上車", en: "Board" },
  scroll: { zh: "向下捲動,車廂通電亮起", en: "Scroll to begin the ride" },
  startRide: { zh: "開始乘車", en: "Start ride" },
  sound: { zh: "報站", en: "Announce" },
  contact: { zh: "聯絡我", en: "Contact" },
  resume: { zh: "下載履歷 PDF", en: "Download résumé (PDF)" },
} satisfies Record<string, Bi>;

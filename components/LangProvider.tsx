"use client";
import { createContext, useContext, useState, useCallback } from "react";
import type { Lang, Bi } from "@/content/i18n";

const Ctx = createContext<{ lang: Lang; t: (b: Bi) => string; toggle: () => void }>({
  lang: "zh",
  t: (b) => b.zh,
  toggle: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");
  const t = useCallback((b: Bi) => b[lang], [lang]);
  const toggle = useCallback(() => setLang((l) => (l === "zh" ? "en" : "zh")), []);
  return <Ctx.Provider value={{ lang, t, toggle }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

"use client";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
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
  // 沒有這行,螢幕閱讀器會用中文語音引擎念英文版
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  }, [lang]);
  return <Ctx.Provider value={{ lang, t, toggle }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

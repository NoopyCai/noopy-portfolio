"use client";
import { useEffect, useState } from "react";
import { LangProvider } from "@/components/LangProvider";
import { ScrollJourney } from "@/components/ScrollJourney";
import { StaticFallback } from "@/components/StaticFallback";
import { TopBar } from "@/components/TopBar";

export default function Home() {
  const [reduce, setReduce] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => {
    setReduce(matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return (
    <LangProvider>
      <TopBar soundOn={soundOn} onSound={setSoundOn} />
      {reduce ? <StaticFallback /> : <ScrollJourney soundOn={soundOn} />}
    </LangProvider>
  );
}

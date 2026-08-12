"use client";
import { useEffect, useState } from "react";
import { LangProvider } from "@/components/LangProvider";
import { ScrollJourney } from "@/components/ScrollJourney";
import { Concourse } from "@/components/Concourse";
import { StaticFallback } from "@/components/StaticFallback";
import { TopBar } from "@/components/TopBar";
import { SoundToggle } from "@/components/SoundToggle";

export default function Home() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return (
    <LangProvider>
      <TopBar />
      {reduce ? (
        <StaticFallback />
      ) : (
        <>
          <SoundToggle />
          <ScrollJourney />
        </>
      )}
      {/* 出站大廳是一般捲動區塊,reduced-motion 使用者也需要它(關於我 / 聯絡 / footer) */}
      <Concourse />
    </LangProvider>
  );
}

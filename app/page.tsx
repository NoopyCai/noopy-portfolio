"use client";
import { useEffect, useState } from "react";
import { LangProvider } from "@/components/LangProvider";
import { ScrollJourney } from "@/components/ScrollJourney";
import { StaticFallback } from "@/components/StaticFallback";

export default function Home() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return <LangProvider>{reduce ? <StaticFallback /> : <ScrollJourney />}</LangProvider>;
}

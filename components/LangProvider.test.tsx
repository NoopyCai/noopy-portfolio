import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LangProvider, useLang } from "./LangProvider";

function Probe() {
  const { t, toggle, lang } = useLang();
  return <button onClick={toggle}>{lang}:{t({ zh: "你好", en: "hi" })}</button>;
}

describe("LangProvider", () => {
  it("defaults zh and toggles to en", () => {
    render(
      <LangProvider>
        <Probe />
      </LangProvider>
    );
    const b = screen.getByRole("button");
    expect(b.textContent).toBe("zh:你好");
    fireEvent.click(b);
    expect(b.textContent).toBe("en:hi");
  });
});

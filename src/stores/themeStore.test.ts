import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore, THEMES, type Theme } from "./themeStore";

describe("useThemeStore", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "terracota" });
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  it("defaults to terracota", () => {
    expect(useThemeStore.getState().theme).toBe("terracota");
  });

  it("exposes all four themes in picker order", () => {
    expect(THEMES).toEqual([
      "terracota",
      "rosa-quente",
      "rosa-vibrante",
      "rosa-suave",
    ]);
  });

  it("setTheme updates state and reflects data-theme on <html>", () => {
    useThemeStore.getState().setTheme("rosa-vibrante");
    expect(useThemeStore.getState().theme).toBe("rosa-vibrante");
    expect(document.documentElement.getAttribute("data-theme")).toBe("rosa-vibrante");
  });

  it("persists the chosen theme to localStorage", () => {
    useThemeStore.getState().setTheme("rosa-suave");
    const raw = localStorage.getItem("amendoim-theme");
    expect(raw).toBeTruthy();
    expect(raw).toContain("rosa-suave");
  });

  it("applies every theme value to the document", () => {
    for (const theme of THEMES as Theme[]) {
      useThemeStore.getState().setTheme(theme);
      expect(document.documentElement.getAttribute("data-theme")).toBe(theme);
    }
  });

  it("re-applies data-theme from persisted storage on rehydrate", async () => {
    localStorage.setItem(
      "amendoim-theme",
      JSON.stringify({ state: { theme: "rosa-suave" }, version: 0 })
    );
    document.documentElement.removeAttribute("data-theme");

    await useThemeStore.persist.rehydrate();

    expect(useThemeStore.getState().theme).toBe("rosa-suave");
    expect(document.documentElement.getAttribute("data-theme")).toBe("rosa-suave");
  });
});

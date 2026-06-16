import { describe, it, expect } from "vitest";
import { MONACO_THEMES, MONACO_THEME_NAMES } from "./monacoThemes";
import { THEMES } from "../stores/themeStore";

describe("monacoThemes", () => {
  it("registers exactly one monaco theme per app theme", () => {
    expect(MONACO_THEMES).toHaveLength(THEMES.length);
    const names = MONACO_THEMES.map((t) => t.name);
    for (const theme of THEMES) {
      expect(names).toContain(MONACO_THEME_NAMES[theme]);
    }
  });

  it("uses bare hex for token foregrounds and #-prefixed hex for colors", () => {
    for (const { data } of MONACO_THEMES) {
      for (const rule of data.rules) {
        if (rule.foreground !== undefined) {
          expect(rule.foreground).toMatch(/^[0-9a-fA-F]{6}$/);
        }
      }
      for (const value of Object.values(data.colors)) {
        expect(value).toMatch(/^#[0-9a-fA-F]{6,8}$/);
      }
    }
  });

  it("uses the light 'vs' base only for the light theme", () => {
    const light = MONACO_THEMES.find(
      (t) => t.name === MONACO_THEME_NAMES["rosa-suave"]
    );
    const dark = MONACO_THEMES.find(
      (t) => t.name === MONACO_THEME_NAMES["terracota"]
    );
    expect(light?.data.base).toBe("vs");
    expect(dark?.data.base).toBe("vs-dark");
  });
});

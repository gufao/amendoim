import type { Theme } from "../stores/themeStore";

/**
 * Structurally compatible with monaco's `editor.IStandaloneThemeData`, declared
 * locally so we don't import from "monaco-editor" (not a direct dep under pnpm).
 * Token `foreground`s are bare hex (no `#`); `colors` values use `#`.
 */
export interface MonacoThemeData {
  base: "vs" | "vs-dark";
  inherit: boolean;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

interface Spec {
  base: "vs" | "vs-dark";
  editorBg: string;
  fg: string;
  lineHi: string;
  sel: string;
  inactiveSel: string;
  cursor: string;
  lineNum: string;
  lineNumActive: string;
  indent: string;
  whitespace: string;
  rangeHi: string;
  bracketBg: string;
  bracketBorder: string;
  widgetBg: string;
  widgetBorder: string;
  suggestSel: string;
  listHover: string;
  // syntax tokens (bare hex, no leading #)
  kw: string;
  str: string;
  num: string;
  comment: string;
  op: string;
  pred: string;
}

function build(s: Spec): MonacoThemeData {
  return {
    base: s.base,
    inherit: true,
    rules: [
      { token: "keyword", foreground: s.kw, fontStyle: "bold" },
      { token: "string.sql", foreground: s.str },
      { token: "string", foreground: s.str },
      { token: "number", foreground: s.num },
      { token: "comment", foreground: s.comment, fontStyle: "italic" },
      { token: "operator", foreground: s.op },
      { token: "predefined", foreground: s.pred },
      { token: "type", foreground: s.pred },
    ],
    colors: {
      "editor.background": s.editorBg,
      "editor.foreground": s.fg,
      "editor.lineHighlightBackground": s.lineHi,
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": s.sel,
      "editor.inactiveSelectionBackground": s.inactiveSel,
      "editorCursor.foreground": s.cursor,
      "editorGutter.background": s.editorBg,
      "editorLineNumber.foreground": s.lineNum,
      "editorLineNumber.activeForeground": s.lineNumActive,
      "editorIndentGuide.background": s.indent,
      "editorWhitespace.foreground": s.whitespace,
      "editor.rangeHighlightBackground": s.rangeHi,
      "editorBracketMatch.background": s.bracketBg,
      "editorBracketMatch.border": s.bracketBorder,
      "scrollbar.shadow": "#00000000",
      "editorOverviewRuler.border": "#00000000",
      "editorWidget.background": s.widgetBg,
      "editorWidget.border": s.widgetBorder,
      "editorSuggestWidget.background": s.widgetBg,
      "editorSuggestWidget.border": s.widgetBorder,
      "editorSuggestWidget.selectedBackground": s.suggestSel,
      "list.hoverBackground": s.listHover,
    },
  };
}

const SPECS: Record<Theme, Spec> = {
  terracota: {
    base: "vs-dark",
    editorBg: "#1a1714", fg: "#f5f0eb", lineHi: "#211e1a80",
    sel: "#c2956a30", inactiveSel: "#c2956a15", cursor: "#d4aa80",
    lineNum: "#4a433b", lineNumActive: "#6d6459",
    indent: "#2e292440", whitespace: "#2e292430", rangeHi: "#c2956a08",
    bracketBg: "#c2956a20", bracketBorder: "#c2956a40",
    widgetBg: "#282420", widgetBorder: "#2e2924", suggestSel: "#36312b", listHover: "#2e2a25",
    kw: "d4aa80", str: "7ec699", num: "e0b44a", comment: "4a433b", op: "b0a698", pred: "8bb5cf",
  },
  "rosa-quente": {
    base: "vs-dark",
    editorBg: "#1d1614", fg: "#f6efec", lineHi: "#241b1980",
    sel: "#d98aa630", inactiveSel: "#d98aa615", cursor: "#e6a3bb",
    lineNum: "#4d423e", lineNumActive: "#6f615c",
    indent: "#32282640", whitespace: "#32282630", rangeHi: "#d98aa608",
    bracketBg: "#d98aa620", bracketBorder: "#d98aa640",
    widgetBg: "#2b201e", widgetBorder: "#322826", suggestSel: "#3a2b29", listHover: "#322523",
    kw: "e6a3bb", str: "7ec699", num: "e0b44a", comment: "4d423e", op: "b6a39e", pred: "cf8bb5",
  },
  "rosa-vibrante": {
    base: "vs-dark",
    editorBg: "#191320", fg: "#f5eef5", lineHi: "#1f182880",
    sel: "#ff6fae30", inactiveSel: "#ff6fae15", cursor: "#ff8cc0",
    lineNum: "#4a4050", lineNumActive: "#6d5f72",
    indent: "#2e243340", whitespace: "#2e243330", rangeHi: "#ff6fae0a",
    bracketBg: "#ff6fae25", bracketBorder: "#ff6fae45",
    widgetBg: "#271f2c", widgetBorder: "#2e2433", suggestSel: "#382c3f", listHover: "#2e2433",
    kw: "ff8cc0", str: "6fd99e", num: "e6b84d", comment: "4a4050", op: "b3a4b6", pred: "c98bd6",
  },
  "rosa-suave": {
    base: "vs",
    editorBg: "#f7e9ef", fg: "#3a2630", lineHi: "#f1dde6",
    sel: "#d9628a26", inactiveSel: "#d9628a14", cursor: "#c44e78",
    lineNum: "#c7adb7", lineNumActive: "#a98c97",
    indent: "#f0d7e0", whitespace: "#f0d7e0", rangeHi: "#d9628a0a",
    bracketBg: "#d9628a22", bracketBorder: "#d9628a40",
    widgetBg: "#ffffff", widgetBorder: "#f0d7e0", suggestSel: "#f3e0e8", listHover: "#f7e9ef",
    kw: "c44e78", str: "3aa06a", num: "c98a1e", comment: "a98c97", op: "7a5d68", pred: "b06aa0",
  },
};

/** Monaco theme id registered with `monaco.editor.defineTheme`, per app theme. */
export const MONACO_THEME_NAMES: Record<Theme, string> = {
  terracota: "amendoim-terracota",
  "rosa-quente": "amendoim-rosa-quente",
  "rosa-vibrante": "amendoim-rosa-vibrante",
  "rosa-suave": "amendoim-rosa-suave",
};

/** All themes ready to register on the editor (`{ name, data }` pairs). */
export const MONACO_THEMES: { name: string; data: MonacoThemeData }[] = (
  Object.keys(SPECS) as Theme[]
).map((theme) => ({ name: MONACO_THEME_NAMES[theme], data: build(SPECS[theme]) }));

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "terracota" | "rosa-quente" | "rosa-vibrante" | "rosa-suave";

// Order shown in the picker. "terracota" is the original/default theme.
export const THEMES: Theme[] = [
  "terracota",
  "rosa-quente",
  "rosa-vibrante",
  "rosa-suave",
];

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * Reflect the chosen theme onto the document so the CSS variable overrides in
 * index.css (`:root[data-theme="…"]`) take effect. "terracota" matches no
 * override block and falls back to the `@theme` defaults — i.e. the original look.
 */
function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "terracota",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: "amendoim-theme",
      // Re-apply once the persisted value is read back (covers async storage).
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    }
  )
);

// Apply immediately on import. The default (localStorage) storage rehydrates
// synchronously during create(), so getState() already holds the saved theme —
// this avoids a flash of the default theme before React mounts.
applyTheme(useThemeStore.getState().theme);

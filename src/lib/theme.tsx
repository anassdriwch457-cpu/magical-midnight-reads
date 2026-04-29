import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "magic" | "midnight" | "concrete" | "custom";
const KEY = "nuvia-theme";
const ACCENT_KEY = "nuvia-accent";

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: string;
  setAccent: (hex: string) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

/** Convert hex (#rrggbb) to oklch components string "L C H" (no alpha). */
function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lr = lin(r), lg = lin(g), lb = lin(b);
  // linear sRGB -> LMS
  const L = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const M = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const S = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(L), m_ = Math.cbrt(M), s_ = Math.cbrt(S);
  const Lo = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { l: Lo, c: C, h: H };
}

function applyAccent(hex: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const { l, c, h } = hexToOklch(hex);
  // Floor lightness so very dark accents stay visible on dark bg, but cap chroma for readability
  const baseL = Math.max(0.55, Math.min(0.78, l));
  const cc = Math.min(c, 0.22);
  const base = `${baseL.toFixed(3)} ${cc.toFixed(3)} ${h.toFixed(2)}`;
  const softL = Math.min(0.82, baseL + 0.10);
  const soft = `${softL.toFixed(3)} ${(cc * 0.9).toFixed(3)} ${((h + 25) % 360).toFixed(2)}`;
  // Auto-pick legible foreground for primary surfaces (buttons): dark text on light accent, light text on dark accent
  const fg = baseL >= 0.62 ? "oklch(0.10 0.005 270)" : "oklch(0.98 0.005 270)";
  root.style.setProperty("--primary", `oklch(${base})`);
  root.style.setProperty("--primary-foreground", fg);
  root.style.setProperty("--accent", `oklch(${soft})`);
  root.style.setProperty("--accent-foreground", fg);
  root.style.setProperty("--ring", `oklch(${base})`);
  root.style.setProperty("--neon-purple", `oklch(${base})`);
  root.style.setProperty("--neon-pink", `oklch(${soft})`);
  root.style.setProperty("--gradient-brand", `linear-gradient(135deg, oklch(${base}) 0%, oklch(${soft}) 100%)`);
  root.style.setProperty("--shadow-glow", `0 0 24px oklch(${base} / 0.28)`);
}

function clearAccent() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  ["--primary","--primary-foreground","--accent","--accent-foreground","--ring","--neon-purple","--neon-pink","--gradient-brand","--shadow-glow"].forEach(p =>
    root.style.removeProperty(p)
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("magic");
  const [accent, setAccentState] = useState<string>("#d946ef");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = (localStorage.getItem(KEY) as Theme) || "magic";
    const savedAccent = localStorage.getItem(ACCENT_KEY) || "#d946ef";
    setThemeState(savedTheme);
    setAccentState(savedAccent);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("theme-magic", "theme-midnight", "theme-concrete", "theme-custom");
    root.classList.add(`theme-${theme === "custom" ? "magic" : theme}`);
    if (theme === "custom") root.classList.add("theme-custom");
    localStorage.setItem(KEY, theme);

    if (theme === "custom") applyAccent(accent);
    else clearAccent();
  }, [theme, accent]);

  const setAccent = (hex: string) => {
    setAccentState(hex);
    localStorage.setItem(ACCENT_KEY, hex);
    if (theme !== "custom") setThemeState("custom");
  };

  return (
    <ThemeCtx.Provider value={{ theme, setTheme: setThemeState, accent, setAccent }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme outside provider");
  return c;
}

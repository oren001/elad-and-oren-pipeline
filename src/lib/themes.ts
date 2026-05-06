export type Theme = {
  id: string;
  name: string;
  vibe: string;
  swatch: { from: string; to: string; accent: string };
};

export const THEMES: readonly Theme[] = [
  {
    id: "smoke",
    name: "עשן ירוק",
    vibe: "המקור, רגוע, מסתמן",
    swatch: { from: "#0a1908", to: "#142c11", accent: "#5fa05a" },
  },
  {
    id: "sunset",
    name: "שקיעה משוגעת",
    vibe: "חם, ורוד, רומנטי",
    swatch: { from: "#2a0a1a", to: "#4a1a32", accent: "#ff7a59" },
  },
  {
    id: "neon",
    name: "ניאון לילה",
    vibe: "סייברפאנק, חשמלי",
    swatch: { from: "#06030a", to: "#1a0a35", accent: "#00f0ff" },
  },
  {
    id: "ocean",
    name: "אוקיינוס עמוק",
    vibe: "כחול, רגוע, נשימה",
    swatch: { from: "#021929", to: "#053450", accent: "#50c8dc" },
  },
  {
    id: "dreamy",
    name: "חולמני זהוב",
    vibe: "סגול עמוק עם זהב",
    swatch: { from: "#0a0518", to: "#21103a", accent: "#ffc850" },
  },
  {
    id: "tropical",
    name: "חוף טרופי",
    vibe: "פלמינגו, ירוק טורקיז",
    swatch: { from: "#1a4860", to: "#2a8088", accent: "#ff6e82" },
  },
  {
    id: "crimson",
    name: "אדום דרמטי",
    vibe: "יין, חשוך, חי",
    swatch: { from: "#1a0306", to: "#3d060c", accent: "#dc323c" },
  },
  {
    id: "lemon",
    name: "לימון חמוץ",
    vibe: "אנרגטי, צהוב",
    swatch: { from: "#0a0a05", to: "#2a2a08", accent: "#dcff50" },
  },
  {
    id: "desert",
    name: "חולות מדבר",
    vibe: "חם, חום, יבש",
    swatch: { from: "#2a1810", to: "#4d2e1a", accent: "#dc8c50" },
  },
  {
    id: "psychedelic",
    name: "חלום פסיכדלי",
    vibe: "מסטולי במאת אחוז",
    swatch: { from: "#0a0220", to: "#2a0840", accent: "#ff64c8" },
  },
];

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

export function applyTheme(id: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
}

const STORAGE_KEY = "halviinim:theme";

export function readStoredTheme(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function writeStoredTheme(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

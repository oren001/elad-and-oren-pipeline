// Dynamic UI DSL.
// Claude returns a UISpec each turn; the renderer maps it to React.
// Keep the palette small and additive — Claude composes screens from these.

export type ActionRisk = "low" | "confirm" | "slide_to_confirm";

export type Action =
  | { kind: "send"; prompt: string } // sends a follow-up message back to Claude
  | { kind: "tool"; tool: string; input: Record<string, unknown>; risk?: ActionRisk; label?: string }
  | { kind: "open_url"; url: string }
  | { kind: "dismiss" };

export type Node =
  | { type: "text"; value: string; tone?: "default" | "muted" | "title" | "headline" | "caption" }
  | { type: "stack"; gap?: number; children: Node[] }
  | { type: "row"; gap?: number; align?: "start" | "center" | "between" | "end"; children: Node[] }
  | { type: "card"; title?: string; subtitle?: string; accent?: string; children: Node[] }
  | { type: "button"; label: string; variant?: "primary" | "ghost" | "danger" | "soft"; icon?: string; action: Action }
  | { type: "slide_to_confirm"; label: string; confirmedLabel?: string; action: Action; tone?: "primary" | "danger" }
  | { type: "list"; items: Array<{ title: string; subtitle?: string; trailing?: string; icon?: string; action?: Action }> }
  | { type: "image"; src: string; alt?: string; rounded?: boolean }
  | { type: "photo_grid"; photos: Array<{ src: string; alt?: string; action?: Action }> }
  | { type: "field"; name: string; label: string; placeholder?: string; kind?: "text" | "number" | "tel" | "email" | "password" | "multiline"; value?: string }
  | { type: "form"; submitLabel: string; fields: Array<Extract<Node, { type: "field" }>>; submit: Action }
  | { type: "toggle"; name: string; label: string; value: boolean; onChange?: Action }
  | { type: "slider"; name: string; label?: string; min: number; max: number; step?: number; value: number; unit?: string; onChange?: Action }
  | { type: "map"; lat: number; lng: number; zoom?: number; label?: string }
  | { type: "metric"; label: string; value: string; delta?: string; tone?: "good" | "bad" | "neutral" }
  | { type: "chips"; chips: Array<{ label: string; action?: Action; selected?: boolean }> }
  | { type: "divider" }
  | { type: "spacer"; size?: number }
  | { type: "media_player"; title: string; subtitle?: string; artwork?: string; playing?: boolean; action?: Action }
  | { type: "camera_viewfinder"; capturePrompt?: string }
  | { type: "loading"; label?: string }
  | { type: "error"; message: string };

export interface UISpec {
  // Optional spoken response (TTS) — separate from on-screen UI
  speak?: string;
  // Optional title for the rendered screen
  title?: string;
  // Tree to render
  root: Node;
  // Optional quick-reply suggestions
  suggestions?: string[];
}

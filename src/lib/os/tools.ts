// Tool palette Claude can call.
// Every tool has a risk tier — `slide_to_confirm` tools must be invoked
// through a slide_to_confirm UI node, not directly.

import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export type RiskTier = "low" | "confirm" | "slide_to_confirm";

export interface OsToolDef {
  name: string;
  description: string;
  risk: RiskTier;
  input_schema: Tool["input_schema"];
}

// The renderer is the one that "talks" to the user — Claude almost always
// finishes a turn by calling `render_ui`. Other tools perform real-world side
// effects on the device.
export const TOOLS: OsToolDef[] = [
  {
    name: "render_ui",
    description:
      "Render a screen for the user. Call this at the end of every turn unless you only need to speak. The UI you return replaces the current screen. Be concise and visually clean — pick the smallest set of components that conveys the answer or asks the user for what's needed next.",
    risk: "low",
    input_schema: {
      type: "object",
      properties: {
        spec: {
          type: "object",
          description:
            "A UISpec. Shape: { speak?: string, title?: string, root: Node, suggestions?: string[] }. Node is one of: text, stack, row, card, button, slide_to_confirm, list, image, photo_grid, field, form, toggle, slider, map, metric, chips, divider, spacer, media_player, camera_viewfinder, loading, error. Buttons and slide_to_confirm carry an `action`: { kind: 'send', prompt } | { kind: 'tool', tool, input, risk, label } | { kind: 'open_url', url } | { kind: 'dismiss' }.",
        },
      },
      required: ["spec"],
    },
  },
  {
    name: "remember",
    description:
      "Save a fact about the user to long-term personal memory. Use sparingly — only durable facts (relationships, preferences, routines, IDs). Do NOT store sensitive secrets.",
    risk: "low",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Short stable key, e.g. 'mom.phone' or 'coffee.order'" },
        value: { type: "string", description: "The value to remember" },
        category: {
          type: "string",
          enum: ["person", "preference", "routine", "place", "credential_ref", "other"],
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "recall",
    description: "Look up a remembered fact by key prefix or category.",
    risk: "low",
    input_schema: {
      type: "object",
      properties: {
        key_prefix: { type: "string" },
        category: { type: "string" },
      },
    },
  },
  {
    name: "send_message",
    description: "Send an SMS, iMessage, or chat-app message. Risky — must be invoked via slide_to_confirm.",
    risk: "slide_to_confirm",
    input_schema: {
      type: "object",
      properties: {
        recipient: { type: "string" },
        body: { type: "string" },
        channel: { type: "string", enum: ["sms", "whatsapp", "imessage", "telegram"] },
      },
      required: ["recipient", "body"],
    },
  },
  {
    name: "place_call",
    description: "Place a phone call. Risky — must be invoked via slide_to_confirm.",
    risk: "slide_to_confirm",
    input_schema: {
      type: "object",
      properties: { recipient: { type: "string" } },
      required: ["recipient"],
    },
  },
  {
    name: "take_photo",
    description: "Open the camera viewfinder so the user can capture a photo. Renders a camera UI; the user taps to capture.",
    risk: "low",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", description: "Why you need the photo" } },
    },
  },
  {
    name: "search_photos",
    description: "Search the user's photo library by date, place or contents (e.g. 'Italy', 'last weekend').",
    risk: "low",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "control_smart_home",
    description: "Control a smart home device. Reversible actions are 'confirm', irreversible (locks, garage) are slide_to_confirm.",
    risk: "confirm",
    input_schema: {
      type: "object",
      properties: {
        device: { type: "string" },
        command: { type: "string", description: "e.g. 'on', 'off', 'set:50%', 'play:jazz'" },
      },
      required: ["device", "command"],
    },
  },
  {
    name: "navigate",
    description: "Open turn-by-turn navigation to a destination.",
    risk: "low",
    input_schema: {
      type: "object",
      properties: {
        destination: { type: "string" },
        mode: { type: "string", enum: ["driving", "walking", "transit", "cycling"] },
      },
      required: ["destination"],
    },
  },
  {
    name: "pay",
    description: "Make a payment. ALWAYS slide_to_confirm.",
    risk: "slide_to_confirm",
    input_schema: {
      type: "object",
      properties: {
        recipient: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" },
        memo: { type: "string" },
      },
      required: ["recipient", "amount", "currency"],
    },
  },
  {
    name: "open_app",
    description: "Open a phone app by name (Spotify, Maps, Calendar, etc).",
    risk: "low",
    input_schema: {
      type: "object",
      properties: { app: { type: "string" } },
      required: ["app"],
    },
  },
  {
    name: "calendar_read",
    description: "Read upcoming calendar events.",
    risk: "low",
    input_schema: {
      type: "object",
      properties: {
        start: { type: "string", description: "ISO date" },
        end: { type: "string", description: "ISO date" },
      },
    },
  },
  {
    name: "calendar_write",
    description: "Create or modify a calendar event. Confirm tier.",
    risk: "confirm",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string" },
        end: { type: "string" },
        location: { type: "string" },
        notes: { type: "string" },
      },
      required: ["title", "start"],
    },
  },
  {
    name: "add_lesson",
    description:
      "Save a short behavioral lesson to long-term memory so you do better next time. Examples: 'when the user asks about photos, default to a 3-column grid', 'mom prefers WhatsApp over SMS', 'after dim-the-lights, also ask if they want music'. Use after every meaningful interaction where you noticed something to improve.",
    risk: "low",
    input_schema: {
      type: "object",
      properties: {
        lesson: { type: "string", description: "The lesson, written as a short imperative." },
      },
      required: ["lesson"],
    },
  },
  {
    name: "propose_code_change",
    description:
      "Propose a patch to your own source code to add a new capability, fix a bug, or improve a UI component. Returns a proposal the user must approve via slide-to-confirm. Only works when running in the dev environment. Use this when you hit a limitation you can't work around — e.g. a missing UI component, a bug in the renderer, a tool you wish you had. Provide one or more file edits as old_string/new_string pairs (exact match) or full file rewrites. Be precise — old_string must match exactly.",
    risk: "slide_to_confirm",
    input_schema: {
      type: "object",
      properties: {
        rationale: { type: "string", description: "Why this change is needed, in 1-2 sentences for the user." },
        edits: {
          type: "array",
          description: "List of edits to apply atomically.",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "Repo-relative path, e.g. 'src/components/os/Renderer.tsx'." },
              mode: { type: "string", enum: ["edit", "create", "rewrite"], description: "edit = swap old_string for new_string; create = new file; rewrite = replace whole file." },
              old_string: { type: "string", description: "Exact substring to find (edit only)." },
              new_string: { type: "string", description: "Replacement (edit), or full file content (create/rewrite)." },
            },
            required: ["path", "mode", "new_string"],
          },
        },
      },
      required: ["rationale", "edits"],
    },
  },
  {
    name: "web_browse",
    description: "Fetch and summarize a web page or run a web search.",
    risk: "low",
    input_schema: {
      type: "object",
      properties: { query_or_url: { type: "string" } },
      required: ["query_or_url"],
    },
  },
];

export function anthropicTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

export function toolByName(name: string): OsToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}

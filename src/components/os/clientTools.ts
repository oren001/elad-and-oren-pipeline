"use client";

// Client-side tool executor. These are tools the device must satisfy locally
// (with hardware, local APIs, or stubs). The result is sent back to Claude as
// a tool_result on the next round-trip.

export interface ClientToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClientToolResult {
  tool_use_id: string;
  name: string;
  output: unknown;
  error?: string;
}

// `take_photo` is special: it requires user interaction, so it's handled in
// the Shell via a camera_viewfinder UI rather than here.
export const INTERACTIVE_TOOLS = new Set(["take_photo"]);

export async function runClientTool(call: ClientToolCall): Promise<ClientToolResult> {
  try {
    switch (call.name) {
      case "navigate": {
        const dest = String(call.input.destination ?? "");
        const mode = String(call.input.mode ?? "driving");
        // Open Google Maps in a new tab — works on Pixel.
        if (typeof window !== "undefined" && dest) {
          window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${mode}`,
            "_blank",
          );
        }
        return { tool_use_id: call.id, name: call.name, output: { opened: true, destination: dest } };
      }
      case "open_app": {
        const app = String(call.input.app ?? "").toLowerCase();
        const intents: Record<string, string> = {
          spotify: "https://open.spotify.com",
          maps: "https://maps.google.com",
          calendar: "https://calendar.google.com",
          youtube: "https://youtube.com",
          gmail: "https://mail.google.com",
          whatsapp: "https://web.whatsapp.com",
        };
        const url = intents[app];
        if (url && typeof window !== "undefined") window.open(url, "_blank");
        return { tool_use_id: call.id, name: call.name, output: { opened: !!url, app } };
      }
      case "place_call": {
        const recipient = String(call.input.recipient ?? "");
        if (typeof window !== "undefined" && recipient) {
          window.location.href = `tel:${recipient}`;
        }
        return { tool_use_id: call.id, name: call.name, output: { dialing: recipient } };
      }
      case "send_message": {
        const recipient = String(call.input.recipient ?? "");
        const bodyText = String(call.input.body ?? "");
        const channel = String(call.input.channel ?? "sms");
        if (typeof window !== "undefined" && recipient) {
          if (channel === "sms" || channel === "imessage") {
            window.location.href = `sms:${recipient}?body=${encodeURIComponent(bodyText)}`;
          } else if (channel === "whatsapp") {
            window.open(`https://wa.me/${recipient.replace(/\D/g, "")}?text=${encodeURIComponent(bodyText)}`, "_blank");
          } else {
            window.location.href = `sms:${recipient}?body=${encodeURIComponent(bodyText)}`;
          }
        }
        return { tool_use_id: call.id, name: call.name, output: { sent: true, channel, recipient } };
      }
      case "control_smart_home": {
        // Stub: in a future build, bridge to Home Assistant / Matter. For now,
        // we acknowledge so Claude can render an "Applied" UI.
        return {
          tool_use_id: call.id,
          name: call.name,
          output: { applied: true, device: call.input.device, command: call.input.command, note: "smart-home bridge not yet connected" },
        };
      }
      case "search_photos": {
        // Stub photo search: returns Unsplash thumbnails matching the query
        // so the photo_grid component has something real to display while we
        // wait for true Photos integration.
        const q = String(call.input.query ?? "photo");
        const photos = Array.from({ length: 9 }).map((_, i) => ({
          src: `https://source.unsplash.com/featured/300x300/?${encodeURIComponent(q)}&sig=${i}`,
          alt: q,
        }));
        return { tool_use_id: call.id, name: call.name, output: { photos } };
      }
      case "calendar_read": {
        return {
          tool_use_id: call.id,
          name: call.name,
          output: { events: [], note: "calendar bridge not yet connected" },
        };
      }
      case "calendar_write": {
        return {
          tool_use_id: call.id,
          name: call.name,
          output: { created: true, note: "calendar bridge not yet connected" },
        };
      }
      case "pay": {
        return {
          tool_use_id: call.id,
          name: call.name,
          output: { paid: true, note: "payment bridge not yet connected" },
        };
      }
      case "propose_code_change": {
        const r = await fetch("/api/patch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            rationale: call.input.rationale,
            edits: call.input.edits,
          }),
        });
        const data = await r.json();
        if (!r.ok) {
          return {
            tool_use_id: call.id,
            name: call.name,
            output: data,
            error: typeof data?.error === "string" ? data.error : "patch failed",
          };
        }
        return { tool_use_id: call.id, name: call.name, output: data };
      }
      case "web_browse": {
        const q = String(call.input.query_or_url ?? "");
        if (typeof window !== "undefined" && q) {
          const url = q.startsWith("http") ? q : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
          window.open(url, "_blank");
        }
        return { tool_use_id: call.id, name: call.name, output: { opened: q } };
      }
      default:
        return {
          tool_use_id: call.id,
          name: call.name,
          output: null,
          error: `unknown client tool: ${call.name}`,
        };
    }
  } catch (e) {
    return {
      tool_use_id: call.id,
      name: call.name,
      output: null,
      error: e instanceof Error ? e.message : "tool failed",
    };
  }
}

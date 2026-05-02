import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlock, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { NextRequest, NextResponse } from "next/server";
import { anthropicTools, toolByName } from "@/lib/os/tools";
import { buildSystemPrompt } from "@/lib/os/system-prompt";
import type { UISpec } from "@/lib/os/ui-schema";

export const runtime = "nodejs";

interface ClientToolResult {
  tool_use_id: string;
  name: string;
  output: unknown;
  error?: string;
}

interface RequestBody {
  apiKey: string;
  device?: string;
  history: MessageParam[];
  userTurn?: { text?: string; image_b64?: string }; // new turn from the user
  toolResults?: ClientToolResult[]; // results from client-executed tools (camera, smart home, etc.)
  memory: Array<{ key: string; value: string; category?: string }>;
}

interface ResponseBody {
  history: MessageParam[];
  ui?: UISpec;
  speak?: string;
  pendingClientTools?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  remembered?: Array<{ key: string; value: string; category?: string }>;
  recalled?: Array<{ key: string; value: string; category?: string }>;
}

// Tools the SERVER can satisfy directly (no device side-effect needed).
const SERVER_TOOLS = new Set(["render_ui", "remember", "recall", "add_lesson"]);

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (!body.apiKey) return NextResponse.json({ error: "missing apiKey" }, { status: 400 });

  const client = new Anthropic({ apiKey: body.apiKey });

  // Build the running message history.
  const history: MessageParam[] = [...(body.history ?? [])];

  // Append a new user turn if one was provided.
  if (body.userTurn) {
    const blocks: ContentBlock[] = [];
    if (body.userTurn.image_b64) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: body.userTurn.image_b64 },
      } as unknown as ContentBlock);
    }
    if (body.userTurn.text) {
      blocks.push({ type: "text", text: body.userTurn.text } as ContentBlock);
    }
    if (blocks.length === 0) blocks.push({ type: "text", text: "" } as ContentBlock);
    history.push({ role: "user", content: blocks as unknown as MessageParam["content"] });
  }

  // Or append client-executed tool results (camera capture, smart-home call, etc.).
  if (body.toolResults && body.toolResults.length > 0) {
    history.push({
      role: "user",
      content: body.toolResults.map((r) => ({
        type: "tool_result",
        tool_use_id: r.tool_use_id,
        content: r.error ? r.error : JSON.stringify(r.output),
        is_error: !!r.error,
      })) as unknown as MessageParam["content"],
    });
  }

  const system = buildSystemPrompt({
    memory: body.memory ?? [],
    device: body.device ?? "Pixel 7 Pro",
    now: new Date().toISOString(),
  });

  let ui: UISpec | undefined;
  let speak: string | undefined;
  const remembered: Array<{ key: string; value: string; category?: string }> = [];
  const recalled: Array<{ key: string; value: string; category?: string }> = [];
  let pendingClientTools: Array<{ id: string; name: string; input: Record<string, unknown> }> | undefined;

  // Tool-use loop: call Claude, execute server tools, loop again. Stop when:
  // - Claude finishes with stop_reason !== "tool_use"
  // - or Claude calls a client tool we need the device to satisfy (we return early)
  for (let step = 0; step < 6; step++) {
    const resp = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system,
      tools: anthropicTools(),
      messages: history,
    });

    history.push({ role: "assistant", content: resp.content as unknown as MessageParam["content"] });

    if (resp.stop_reason !== "tool_use") {
      // Plain text reply with no tool call. Treat any text as `speak`.
      const text = resp.content
        .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) speak = text;
      break;
    }

    const toolUses = resp.content.filter((b): b is ToolUseBlock => b.type === "tool_use");

    // Server-side tools we resolve immediately, then loop.
    const serverResults: Array<{ id: string; name: string; result: unknown; error?: string }> = [];
    const clientPending: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for (const tu of toolUses) {
      if (tu.name === "render_ui") {
        const spec = (tu.input as { spec?: UISpec })?.spec;
        if (spec) {
          ui = spec;
          if (!speak && spec.speak) speak = spec.speak;
        }
        serverResults.push({ id: tu.id, name: tu.name, result: { ok: true } });
      } else if (tu.name === "remember") {
        const i = tu.input as { key: string; value: string; category?: string };
        remembered.push({ key: i.key, value: i.value, category: i.category });
        serverResults.push({ id: tu.id, name: tu.name, result: { ok: true } });
      } else if (tu.name === "add_lesson") {
        const i = tu.input as { lesson: string };
        if (i.lesson) {
          remembered.push({ key: `lesson.${Date.now().toString(36)}`, value: i.lesson, category: "lesson" });
        }
        serverResults.push({ id: tu.id, name: tu.name, result: { ok: true } });
      } else if (tu.name === "recall") {
        const i = tu.input as { key_prefix?: string; category?: string };
        const matched = (body.memory ?? []).filter((m) => {
          if (i.key_prefix && !m.key.startsWith(i.key_prefix)) return false;
          if (i.category && m.category !== i.category) return false;
          return true;
        });
        recalled.push(...matched);
        serverResults.push({ id: tu.id, name: tu.name, result: { facts: matched } });
      } else if (SERVER_TOOLS.has(tu.name)) {
        serverResults.push({ id: tu.id, name: tu.name, result: { ok: true } });
      } else {
        // Client-side tool — needs to round-trip to the device.
        clientPending.push({ id: tu.id, name: tu.name, input: (tu.input as Record<string, unknown>) ?? {} });
      }
    }

    if (clientPending.length > 0) {
      // We must hand back to the device. UI (if any) is already captured above.
      pendingClientTools = clientPending;
      break;
    }

    // Feed server tool results back and loop.
    history.push({
      role: "user",
      content: serverResults.map((r) => ({
        type: "tool_result",
        tool_use_id: r.id,
        content: r.error ? r.error : JSON.stringify(r.result),
        is_error: !!r.error,
      })) as unknown as MessageParam["content"],
    });

    // If we got a UI and no client tools are pending, we're done — Claude can keep
    // talking on the next user action.
    if (ui) break;
  }

  const out: ResponseBody = { history, ui, speak, pendingClientTools, remembered, recalled };
  return NextResponse.json(out);
}

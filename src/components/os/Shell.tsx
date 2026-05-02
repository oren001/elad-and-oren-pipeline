"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import ApiKeyGate, { loadApiKey } from "./ApiKeyGate";
import Renderer from "./Renderer";
import { listenOnce, speak, speechSupported, stopSpeaking } from "./voice";
import { INTERACTIVE_TOOLS, runClientTool, type ClientToolCall, type ClientToolResult } from "./clientTools";
import { TOOLS } from "@/lib/os/tools";
import { rememberFact, recallAll } from "@/lib/os/memory";
import type { Action, UISpec } from "@/lib/os/ui-schema";

const HISTORY_KEY = "claude-os-history";
const MAX_HISTORY_TURNS = 30;

export default function Shell() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [history, setHistory] = useState<MessageParam[]>([]);
  const [ui, setUi] = useState<UISpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [voiceOut, setVoiceOut] = useState(true);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  // pendingPhotoTool stores the tool_use_id for an in-progress take_photo so
  // the captured image can be sent back as that tool's result.
  const pendingPhotoTool = useRef<{ id: string } | null>(null);

  // Load existing key + welcome screen.
  useEffect(() => {
    const k = loadApiKey();
    if (k) setApiKey(k);
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Persist history.
  useEffect(() => {
    if (history.length === 0) return;
    const trimmed = history.slice(-MAX_HISTORY_TURNS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  }, [history]);

  // First render: ask Claude for an opening dashboard.
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (!apiKey || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    if (history.length === 0) {
      void send({ text: "(idle bootstrap — render an adaptive home dashboard for right now)" });
    } else {
      // Show the last UI if we have one stashed.
      const cached = localStorage.getItem("claude-os-last-ui");
      if (cached) {
        try {
          setUi(JSON.parse(cached));
        } catch {
          /* ignore */
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (ui) localStorage.setItem("claude-os-last-ui", JSON.stringify(ui));
  }, [ui]);

  const send = useCallback(
    async (turn: { text?: string; image_b64?: string; toolResults?: ClientToolResult[] }) => {
      if (!apiKey) return;
      setBusy(true);
      try {
        const memory = await recallAll();
        const memorySlim = memory.map((m) => ({ key: m.key, value: m.value, category: m.category }));
        let nextHistory = history;
        let toolResults = turn.toolResults;
        let userTurn: { text?: string; image_b64?: string } | undefined =
          turn.text || turn.image_b64 ? { text: turn.text, image_b64: turn.image_b64 } : undefined;

        // Loop while the server hands back client tools to execute.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const r = await fetch("/api/claude", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              apiKey,
              device: "Pixel 7 Pro",
              history: nextHistory,
              userTurn,
              toolResults,
              memory: memorySlim,
            }),
          });
          if (!r.ok) {
            const errText = await r.text();
            setUi({ root: { type: "error", message: `API error: ${errText}` } });
            break;
          }
          const data = (await r.json()) as {
            history: MessageParam[];
            ui?: UISpec;
            speak?: string;
            pendingClientTools?: ClientToolCall[];
            remembered?: Array<{ key: string; value: string; category?: string }>;
          };

          nextHistory = data.history;
          setHistory(data.history);

          // Persist any new memories Claude wrote this turn.
          if (data.remembered) {
            for (const m of data.remembered) {
              await rememberFact({ key: m.key, value: m.value, category: m.category });
            }
          }

          if (data.ui) setUi(data.ui);
          if (data.speak && voiceOut) speak(data.speak);

          // Handle client tools.
          if (data.pendingClientTools && data.pendingClientTools.length > 0) {
            const interactive = data.pendingClientTools.find((t) => INTERACTIVE_TOOLS.has(t.name));
            if (interactive) {
              if (interactive.name === "take_photo") {
                pendingPhotoTool.current = { id: interactive.id };
                setUi({
                  root: {
                    type: "camera_viewfinder",
                    capturePrompt: String(interactive.input.reason ?? "Take a photo"),
                  },
                });
              }
              break;
            }
            // Safety net: if Claude emitted a risky tool directly without
            // going through a slide_to_confirm UI, render our own gate.
            const risky = data.pendingClientTools.find((t) => {
              const def = TOOLS.find((d) => d.name === t.name);
              return def?.risk === "slide_to_confirm" || def?.risk === "confirm";
            });
            if (risky) {
              const summary =
                risky.name === "propose_code_change"
                  ? `Apply ${(Array.isArray((risky.input as { edits?: unknown[] }).edits) ? (risky.input as { edits: unknown[] }).edits.length : 0)} file change(s)?`
                  : `Run ${risky.name}?`;
              setUi({
                speak: undefined,
                title: "Confirm",
                root: {
                  type: "card",
                  title: summary,
                  subtitle: typeof (risky.input as { rationale?: string }).rationale === "string"
                    ? (risky.input as { rationale: string }).rationale
                    : undefined,
                  children: [
                    {
                      type: "text",
                      tone: "muted",
                      value: JSON.stringify(risky.input, null, 2).slice(0, 800),
                    },
                    {
                      type: "slide_to_confirm",
                      label: `Slide to ${risky.name === "propose_code_change" ? "apply patch" : "confirm"}`,
                      tone: risky.name === "pay" ? "danger" : "primary",
                      action: { kind: "tool", tool: risky.name, input: risky.input as Record<string, unknown> },
                    },
                  ],
                },
              });
              // Tell Claude the user has been shown a confirmation gate.
              toolResults = data.pendingClientTools.map((t) => ({
                tool_use_id: t.id,
                name: t.name,
                output: { awaiting_user_confirmation: true },
              }));
              userTurn = undefined;
              break;
            }
            const results: ClientToolResult[] = [];
            for (const t of data.pendingClientTools) {
              results.push(await runClientTool(t));
            }
            toolResults = results;
            userTurn = undefined;
            continue;
          }
          break;
        }
      } catch (e) {
        setUi({
          root: {
            type: "error",
            message: e instanceof Error ? e.message : "something broke",
          },
        });
      } finally {
        setBusy(false);
      }
    },
    [apiKey, history, voiceOut],
  );

  const onAction = useCallback(
    async (a: Action) => {
      if (a.kind === "send") {
        await send({ text: a.prompt });
      } else if (a.kind === "tool") {
        // The action targets a tool — synthesize a tool result by running it
        // client-side, but only when the user has gone through the right
        // confirmation gate (slide_to_confirm component for risky tools).
        // Here, the renderer already enforces gating, so just run.
        const fakeId = `act_${Date.now()}`;
        const result = await runClientTool({ id: fakeId, name: a.tool, input: a.input });
        // Tell Claude what happened so it can render the next screen.
        await send({
          text: `[user-confirmed action] tool=${a.tool} input=${JSON.stringify(a.input)} result=${JSON.stringify(result.output ?? result.error)}`,
        });
      } else if (a.kind === "open_url") {
        window.open(a.url, "_blank");
      } else if (a.kind === "dismiss") {
        // no-op for now
      }
    },
    [send],
  );

  const onPhoto = useCallback(
    async (b64: string) => {
      if (pendingPhotoTool.current) {
        const id = pendingPhotoTool.current.id;
        pendingPhotoTool.current = null;
        await send({
          toolResults: [
            { tool_use_id: id, name: "take_photo", output: { captured: true, note: "image attached" } },
          ],
          image_b64: b64,
        });
      } else {
        // Standalone capture — feed to Claude as an image.
        await send({ image_b64: b64, text: "(captured photo)" });
      }
    },
    [send],
  );

  const startListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    stopSpeaking();
    setPartial("");
    setListening(true);
    const handle = listenOnce({
      onPartial: (t) => setPartial(t),
      onFinal: (t) => {
        setListening(false);
        setPartial("");
        if (t) void send({ text: t });
      },
      onError: () => setListening(false),
    });
    recognitionRef.current = handle;
  }, [listening, send]);

  if (!apiKey) {
    return <ApiKeyGate onReady={setApiKey} />;
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#0b0d12] via-[#0b0d12] to-[#13161d] text-white">
      {/* Top bar */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between text-white/70 text-xs">
        <div>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceOut((v) => !v)}
            className="px-2 py-1 rounded-full bg-white/10"
            aria-label="toggle voice"
          >
            {voiceOut ? "🔊" : "🔇"}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem(HISTORY_KEY);
              localStorage.removeItem("claude-os-last-ui");
              setHistory([]);
              setUi(null);
              bootstrappedRef.current = false;
              void send({ text: "(reset — render a fresh home)" });
            }}
            className="px-2 py-1 rounded-full bg-white/10"
          >
            new
          </button>
        </div>
      </div>

      {ui ? (
        <Renderer spec={ui} onAction={onAction} onPhoto={onPhoto} />
      ) : (
        <div className="flex items-center justify-center h-[60dvh] text-white/60">
          {busy ? "thinking…" : "say something"}
        </div>
      )}

      {/* Bottom input dock */}
      <div className="fixed bottom-0 inset-x-0 p-3 pb-[max(env(safe-area-inset-bottom),12px)] bg-gradient-to-t from-black/90 via-black/70 to-transparent">
        <div className="max-w-screen-sm mx-auto flex items-end gap-2">
          <button
            onClick={startListening}
            disabled={!speechSupported()}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${listening ? "bg-red-500 animate-pulse" : "bg-white/15"} disabled:opacity-30`}
            aria-label="voice"
          >
            🎙
          </button>
          <button
            onClick={() => {
              setUi({
                root: { type: "camera_viewfinder", capturePrompt: "Tap to capture" },
              });
            }}
            className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-xl shrink-0"
            aria-label="camera"
          >
            📷
          </button>
          <div className="flex-1 flex items-end gap-2 bg-white/10 rounded-2xl border border-white/10 px-3 py-2 min-h-[48px]">
            <textarea
              rows={1}
              value={listening ? partial : textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (textInput.trim()) {
                    void send({ text: textInput.trim() });
                    setTextInput("");
                  }
                }
              }}
              placeholder={listening ? "listening…" : busy ? "…" : "ask anything"}
              className="flex-1 bg-transparent resize-none outline-none placeholder-white/40 text-white"
            />
            {textInput && (
              <button
                onClick={() => {
                  if (textInput.trim()) {
                    void send({ text: textInput.trim() });
                    setTextInput("");
                  }
                }}
                disabled={busy}
                className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center"
                aria-label="send"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

const KEY_NAME = "claude-os-api-key";

export function loadApiKey(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(KEY_NAME);
}

export function saveApiKey(k: string) {
  localStorage.setItem(KEY_NAME, k);
}

export function clearApiKey() {
  localStorage.removeItem(KEY_NAME);
}

export default function ApiKeyGate({ onReady }: { onReady: (k: string) => void }) {
  const [k, setK] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const existing = loadApiKey();
    if (existing) onReady(existing);
  }, [onReady]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-black text-white">
      <div className="max-w-sm w-full">
        <div className="text-3xl font-semibold tracking-tight mb-1">Claude OS</div>
        <div className="text-white/60 mb-6">Paste your Anthropic API key to begin.</div>
        <input
          type="password"
          autoFocus
          value={k}
          onChange={(e) => setK(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="sk-ant-..."
          className="w-full px-3 py-3 rounded-xl bg-white/10 border border-white/15 placeholder-white/30 focus:outline-none focus:border-white/40"
        />
        {touched && k && !k.startsWith("sk-ant-") && (
          <div className="text-amber-400 text-sm mt-2">That doesn&apos;t look like an Anthropic key.</div>
        )}
        <button
          disabled={!k}
          onClick={() => {
            saveApiKey(k);
            onReady(k);
          }}
          className="w-full mt-4 px-4 py-3 rounded-xl bg-white text-black font-medium disabled:opacity-40"
        >
          Continue
        </button>
        <div className="text-white/40 text-xs mt-6 leading-relaxed">
          Your key is stored locally on this device only. Memory and conversation history live in your browser.
          Nothing is sent to any server other than Anthropic.
        </div>
      </div>
    </div>
  );
}

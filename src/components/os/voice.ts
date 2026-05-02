"use client";

// Thin wrappers around the browser's SpeechRecognition / SpeechSynthesis APIs.
// Works on Chromium-based browsers (the Pixel default).

interface SpeechRecognitionLike extends EventTarget {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: { 0: { transcript: string }; isFinal: boolean }[] & { length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported() {
  return getRecognitionCtor() !== null;
}

export interface RecognitionHandle {
  stop: () => void;
}

export function listenOnce(opts: {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (err: string) => void;
  lang?: string;
}): RecognitionHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    opts.onError?.("speech recognition not supported");
    return null;
  }
  const r = new Ctor();
  r.lang = opts.lang ?? "en-US";
  r.continuous = false;
  r.interimResults = true;
  let finalText = "";
  r.onresult = (ev) => {
    let interim = "";
    for (let i = 0; i < ev.results.length; i++) {
      const res = ev.results[i];
      const t = res[0].transcript;
      if (res.isFinal) finalText += t;
      else interim += t;
    }
    if (interim && opts.onPartial) opts.onPartial(interim);
  };
  r.onend = () => {
    opts.onFinal(finalText.trim());
  };
  r.onerror = (e) => opts.onError?.(e.error);
  try {
    r.start();
  } catch (e) {
    opts.onError?.(e instanceof Error ? e.message : "start failed");
    return null;
  }
  return { stop: () => r.stop() };
}

export function speak(text: string, opts?: { lang?: string; rate?: number; pitch?: number }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts?.lang ?? "en-US";
  u.rate = opts?.rate ?? 1;
  u.pitch = opts?.pitch ?? 1;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

// ── Minimal type shim for Web Speech API (not in all TS lib versions) ──────
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface ISpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: ISpeechRecognitionResult[] & { length: number };
}
type SpeechRecognitionConstructor = new () => ISpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}
// ──────────────────────────────────────────────────────────────────────────

interface VoiceButtonProps {
  /** id of the <textarea> to write transcript into */
  targetId: string;
}

type RecordingState = "idle" | "recording" | "unsupported";

export function VoiceButton({ targetId }: VoiceButtonProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const finalRef = useRef(""); // accumulates confirmed transcript text

  useEffect(() => {
    const SR: SpeechRecognitionConstructor | undefined =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SR) {
      setState("unsupported");
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-AU";

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalRef.current += result[0].transcript + " ";
        } else {
          interimText += result[0].transcript;
        }
      }
      setInterim(interimText);

      const el = document.getElementById(targetId) as HTMLTextAreaElement | null;
      if (el) {
        el.value = finalRef.current + interimText;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    recognition.onerror = (event: { error: string }) => {
      console.error("Speech recognition error:", event.error);
      setState("idle");
    };

    recognition.onend = () => {
      setState("idle");
      setInterim("");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [targetId]);

  const toggle = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (state === "recording") {
      recognition.stop();
      setState("idle");
    } else {
      // Pre-seed with whatever is already typed
      const el = document.getElementById(targetId) as HTMLTextAreaElement | null;
      const existing = el?.value?.trim() ?? "";
      finalRef.current = existing ? existing + " " : "";
      recognition.start();
      setState("recording");
    }
  };

  if (state === "unsupported") {
    return (
      <p className="text-xs text-ink-400 mt-1">
        Voice input isn&apos;t supported in this browser. Try Chrome or Edge.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 mt-1">
      <button
        type="button"
        onClick={toggle}
        className={`relative flex items-center justify-center w-20 h-20 rounded-full shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-red-300 bg-red-500 hover:bg-red-600 transition-transform duration-200 ${
          state === "recording" ? "scale-110" : ""
        }`}
        aria-label={state === "recording" ? "Stop recording" : "Start voice recording"}
      >
        {/* Pulse rings when recording */}
        {state === "recording" && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" />
            <span className="absolute -inset-3 rounded-full bg-red-300 opacity-30 animate-ping [animation-delay:300ms]" />
          </>
        )}
        {state === "recording" ? (
          <MicOff size={32} className="relative text-white" />
        ) : (
          <Mic size={32} className="relative text-white" />
        )}
      </button>

      <p className="text-sm text-ink-500 text-center min-h-[1.25rem]">
        {state === "recording" ? (
          <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
            <Loader2 size={14} className="animate-spin" />
            Recording… tap to stop
          </span>
        ) : (
          "Tap the mic to describe your project by voice"
        )}
      </p>

      {interim && (
        <p className="text-xs text-ink-400 italic text-center max-w-xs truncate">
          &ldquo;{interim}&rdquo;
        </p>
      )}
    </div>
  );
}

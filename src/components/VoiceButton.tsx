"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceButtonProps {
  targetId: string; // id of the textarea to fill
}

type RecordingState = "idle" | "recording" | "unsupported";

export function VoiceButton({ targetId }: VoiceButtonProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef(""); // accumulates confirmed transcript text

  useEffect(() => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: typeof globalThis.SpeechRecognition; webkitSpeechRecognition?: typeof globalThis.SpeechRecognition })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof globalThis.SpeechRecognition })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState("unsupported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-AU";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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

      // Push to textarea
      const el = document.getElementById(targetId) as HTMLTextAreaElement | null;
      if (el) {
        el.value = finalRef.current + interimText;
        // Trigger React's synthetic change so the form picks it up
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(el, el.value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
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
      // Seed finalRef with whatever is already in the textarea
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
        🎤 Voice input isn&apos;t supported in this browser. Try Chrome or Edge.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 mt-1">
      <button
        type="button"
        onClick={toggle}
        className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-200 shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 ${
          state === "recording"
            ? "bg-red-500 hover:bg-red-600 focus-visible:ring-red-300 scale-110"
            : "bg-red-500 hover:bg-red-600 focus-visible:ring-red-300"
        }`}
        aria-label={state === "recording" ? "Stop recording" : "Start voice recording"}
      >
        {/* Pulse rings when recording */}
        {state === "recording" && (
          <>
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60 animate-ping" />
            <span className="absolute inline-flex h-[140%] w-[140%] rounded-full bg-red-300 opacity-30 animate-ping [animation-delay:0.3s]" />
          </>
        )}
        {state === "recording" ? (
          <MicOff size={32} className="relative text-white" />
        ) : (
          <Mic size={32} className="relative text-white" />
        )}
      </button>

      <p className="text-sm text-ink-500 text-center">
        {state === "recording" ? (
          <span className="flex items-center gap-1.5 text-red-600 font-medium">
            <Loader2 size={14} className="animate-spin" />
            Recording… tap to stop
          </span>
        ) : (
          "Tap to describe your project by voice"
        )}
      </p>

      {interim && (
        <p className="text-xs text-ink-400 italic text-center max-w-xs">
          &ldquo;{interim}&rdquo;
        </p>
      )}
    </div>
  );
}

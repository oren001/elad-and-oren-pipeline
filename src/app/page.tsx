"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Leaf, Flame } from "lucide-react";

type Mood =
  | "chill"
  | "deep"
  | "hungry"
  | "paranoid"
  | "forgetful"
  | "eran-disses";

type Msg = {
  id: string;
  role: "me" | "bot";
  text: string;
  mood?: Mood;
};

const MOOD_LABEL: Record<Mood, string> = {
  chill: "רגוע",
  deep: "פילוסופי",
  hungry: "רעב",
  paranoid: "פרנואיד",
  forgetful: "שכחן",
  "eran-disses": "מדבר על ערן",
};

const SUGGESTIONS = [
  "מה נשמע אחי",
  "בא לי במבה",
  "מה זה החיים?",
  "ערן אמר שהוא מעשן יותר ממך",
  "שכחתי מה רציתי להגיד",
  "אני חושב שעוקבים אחריי",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "bot",
      text:
        "וואלה, היי. אני המסטולון. שלוש גרם ביום, פעמיים מערן. דבר אליי, אני פה. בערך.",
      mood: "chill",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const myMsg: Msg = { id: uid(), role: "me", text: trimmed };
    setMessages((prev) => [...prev, myMsg]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/stoner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json()) as { reply?: string; mood?: Mood };
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "bot",
          text: data.reply ?? "אהמ... שכחתי מה רציתי להגיד.",
          mood: data.mood,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "bot",
          text: "אחי הראש שלי בענן. נסה שוב.",
          mood: "forgetful",
        },
      ]);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <SmokeBackdrop />

      <header className="relative z-10 px-5 sm:px-8 py-5 flex items-center gap-3 border-b border-smoke-700/40 bg-smoke-950/40 backdrop-blur">
        <div className="w-10 h-10 rounded-full glow-ring flex items-center justify-center bg-smoke-800/70">
          <Leaf className="w-5 h-5 text-smoke-200" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-smoke-100 font-bold text-lg leading-tight">
              מסטולון
            </h1>
            <span className="text-smoke-300 text-xs px-2 py-0.5 rounded-full bg-smoke-800/60 border border-smoke-700/60">
              3 גרם / יום · פעמיים מערן
            </span>
          </div>
          <p className="text-smoke-300/80 text-xs">
            צ'אט עברי · מצבי רוח אמיתיים · אפס סבלנות לערן
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-smoke-300 text-xs">
          <Flame className="w-4 h-4" />
          <span>online · בערך</span>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-3 sm:px-6 pt-4 pb-40">
        <div
          ref={scrollRef}
          className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1"
        >
          {messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
          {pending && <Typing />}
        </div>

        <Suggestions onPick={(s) => void send(s)} disabled={pending} />
      </main>

      <Composer
        input={input}
        setInput={setInput}
        onKeyDown={onKeyDown}
        onSend={() => void send(input)}
        disabled={pending}
        inputRef={inputRef}
      />
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isMe = msg.role === "me";
  return (
    <div className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
      <div
        className={[
          "max-w-[82%] sm:max-w-[70%] px-4 py-3 rounded-2xl shadow-lg leading-relaxed text-[15px]",
          isMe ? "bubble-me rounded-bl-sm" : "bubble-bot rounded-br-sm",
        ].join(" ")}
      >
        {!isMe && msg.mood && (
          <div className="text-[11px] text-smoke-300 mb-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-smoke-400 animate-pulse" />
            <span>מצב רוח: {MOOD_LABEL[msg.mood]}</span>
          </div>
        )}
        <div className="whitespace-pre-wrap">{msg.text}</div>
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-end">
      <div className="bubble-bot px-4 py-3 rounded-2xl rounded-br-sm">
        <span className="dot-typing" />
        <span className="dot-typing" />
        <span className="dot-typing" />
      </div>
    </div>
  );
}

function Suggestions({
  onPick,
  disabled,
}: {
  onPick: (s: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="text-xs px-3 py-1.5 rounded-full bg-smoke-800/60 hover:bg-smoke-700/70 border border-smoke-700/60 text-smoke-200 disabled:opacity-50 transition"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function Composer({
  input,
  setInput,
  onKeyDown,
  onSend,
  disabled,
  inputRef,
}: {
  input: string;
  setInput: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 border-t border-smoke-700/40 bg-smoke-950/80 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="כתוב משהו... או אל תכתוב, גם זה בסדר"
            className="flex-1 input-glow resize-none rounded-2xl bg-smoke-900/70 border border-smoke-700/60 px-4 py-3 text-smoke-100 placeholder:text-smoke-300/50 max-h-40"
            dir="rtl"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || !input.trim()}
            className="h-12 w-12 rounded-full bg-gradient-to-br from-smoke-400 to-smoke-600 text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed glow-ring transition active:scale-95"
            aria-label="שלח"
          >
            <Send className="w-5 h-5 -scale-x-100" />
          </button>
        </div>
        <p className="text-center text-[10px] text-smoke-400/70 mt-2">
          המסטולון לא תורם לחברה. הוא רק תורם להפסקות עישון.
        </p>
      </div>
    </div>
  );
}

function SmokeBackdrop() {
  const puffs = Array.from({ length: 8 });
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {puffs.map((_, i) => (
        <div
          key={i}
          className="smoke-puff animate-drift"
          style={{
            left: `${(i * 13 + 5) % 100}%`,
            animationDelay: `${i * 1.2}s`,
            animationDuration: `${8 + (i % 4)}s`,
            transform: `scale(${0.6 + ((i * 17) % 10) / 12})`,
          }}
        />
      ))}
    </div>
  );
}

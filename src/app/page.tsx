"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Leaf,
  Sparkles,
  ImageIcon,
  X,
  Edit3,
  Users,
} from "lucide-react";
import { randomNickname } from "@/lib/nicknames";

type Mood =
  | "chill"
  | "deep"
  | "hungry"
  | "paranoid"
  | "forgetful"
  | "eran-disses";

type ImageState = {
  prompt: string;
  refUsed: boolean;
  status: "pending" | "ready" | "error";
  url?: string;
  generationId?: string;
  error?: string;
};

type RoomMsg = {
  id: string;
  ts: number;
  author?: { id: string; name: string };
  role: "user" | "bot" | "system";
  text?: string;
  mood?: Mood;
  image?: ImageState;
};

type Author = { id: string; name: string };

const MOOD_LABEL: Record<Mood, string> = {
  chill: "רגוע",
  deep: "פילוסופי",
  hungry: "רעב",
  paranoid: "פרנואיד",
  forgetful: "שכחן",
  "eran-disses": "מדבר על ערן",
};

function getOrCreateAuthor(): Author {
  if (typeof window === "undefined") return { id: "anon", name: "אנונימי" };
  let id = localStorage.getItem("mastulon:authorId");
  let name = localStorage.getItem("mastulon:authorName");
  if (!id) {
    id = "u_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("mastulon:authorId", id);
  }
  if (!name) {
    name = randomNickname();
    localStorage.setItem("mastulon:authorName", name);
  }
  return { id, name };
}

export default function Page() {
  const [messages, setMessages] = useState<RoomMsg[]>([]);
  const [daily, setDaily] = useState<{ used: number; limit: number }>({
    used: 0,
    limit: 30,
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [imagineOpen, setImagineOpen] = useState(false);
  const [author, setAuthor] = useState<Author>({ id: "anon", name: "אנונימי" });
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastMsgCountRef = useRef(0);

  useEffect(() => {
    setAuthor(getOrCreateAuthor());
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchOnce() {
      try {
        const res = await fetch("/api/room", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages?: RoomMsg[];
          daily?: { used: number; limit: number };
        };
        if (cancelled) return;
        if (Array.isArray(data.messages)) setMessages(data.messages);
        if (data.daily) setDaily(data.daily);
      } catch {
        // silent
      }
    }
    fetchOnce();
    const id = setInterval(fetchOnce, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (messages.length > lastMsgCountRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    lastMsgCountRef.current = messages.length;
  }, [messages.length]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/room/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          authorId: author.id,
          authorName: author.name,
        }),
      });
      const data = (await res.json()) as { messages?: RoomMsg[] };
      if (Array.isArray(data.messages)) setMessages(data.messages);
    } catch {
      // silent — next poll will resync
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function imagine(prompt: string, refFile: File | null) {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    let refImageId: string | null = null;
    if (refFile) {
      try {
        const fd = new FormData();
        fd.append("file", refFile);
        const up = await fetch("/api/imagine/upload", {
          method: "POST",
          body: fd,
        });
        if (up.ok) {
          const upData = (await up.json()) as { imageId?: string };
          if (upData.imageId) refImageId = upData.imageId;
        }
      } catch {
        // continue without ref image
      }
    }

    let msgId: string | null = null;
    let generationId: string | null = null;
    let creationError: string | null = null;
    try {
      const create = await fetch("/api/room/imagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          refImageId,
          authorId: author.id,
          authorName: author.name,
        }),
      });
      const createData = (await create.json()) as {
        msgId?: string;
        generationId?: string;
        error?: string;
        status?: number;
        body?: unknown;
        used?: number;
        limit?: number;
      };
      if (!create.ok) {
        creationError = `${create.status}/${createData.error ?? "unknown"}${
          createData.body
            ? ` | body: ${JSON.stringify(createData.body).slice(0, 300)}`
            : ""
        }`;
      } else {
        msgId = createData.msgId ?? null;
        generationId = createData.generationId ?? null;
      }
    } catch (err) {
      creationError =
        err instanceof Error ? `network: ${err.message}` : "network";
    }

    if (creationError) {
      const friendly =
        creationError.startsWith("429/daily_cap_reached") ||
        creationError.includes("daily_cap")
          ? "הגענו לתקרה היומית של ציורים. ננסה מחר."
          : `אחי הראש שלי לא צייר.\n[debug: ${creationError}]`;

      const localMsg: RoomMsg = {
        id: "local-" + Math.random().toString(36).slice(2, 8),
        ts: Date.now(),
        role: "bot",
        text: friendly,
        mood: "forgetful",
      };
      setMessages((prev) => [...prev, localMsg]);
      return;
    }

    if (!msgId || !generationId) return;

    setTimeout(() => void refresh(), 500);

    try {
      const imageUrl = await pollGeneration(generationId);
      await fetch("/api/room/imagine/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msgId, imageUrl }),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "unknown";
      await fetch("/api/room/imagine/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msgId, error: detail }),
      });
    } finally {
      void refresh();
    }
  }

  async function refresh() {
    try {
      const res = await fetch("/api/room", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: RoomMsg[];
        daily?: { used: number; limit: number };
      };
      if (Array.isArray(data.messages)) setMessages(data.messages);
      if (data.daily) setDaily(data.daily);
    } catch {
      // silent
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  function changeName() {
    const next = window.prompt("שם חדש (יוצג לכולם):", author.name);
    if (next && next.trim()) {
      const trimmed = next.trim().slice(0, 30);
      localStorage.setItem("mastulon:authorName", trimmed);
      setAuthor({ ...author, name: trimmed });
    }
  }

  const imagining = messages.some((m) => m.image?.status === "pending");

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <SmokeBackdrop />

      <header className="relative z-10 px-4 sm:px-8 py-4 flex items-center gap-3 border-b border-smoke-700/40 bg-smoke-950/40 backdrop-blur">
        <div className="w-9 h-9 rounded-full glow-ring flex items-center justify-center bg-smoke-800/70 shrink-0">
          <Leaf className="w-5 h-5 text-smoke-200" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-smoke-100 font-bold text-lg leading-tight">
              מסטולון
            </h1>
            <span className="text-smoke-300 text-[11px] px-2 py-0.5 rounded-full bg-smoke-800/60 border border-smoke-700/60 flex items-center gap-1">
              <Users className="w-3 h-3" />
              חדר ציבורי
            </span>
            <span className="text-smoke-400 text-[11px]">
              ציורים היום: {daily.used}/{daily.limit}
            </span>
          </div>
          {hydrated && (
            <button
              type="button"
              onClick={changeName}
              className="text-smoke-300/80 text-xs flex items-center gap-1 hover:text-smoke-100 transition truncate mt-0.5"
            >
              <span className="truncate">אתה: {author.name}</span>
              <Edit3 className="w-3 h-3 shrink-0" />
            </button>
          )}
        </div>
      </header>

      {imagining && (
        <div className="relative z-10 px-4 py-2.5 flex items-center justify-center gap-2 bg-emerald-900/80 backdrop-blur-md border-b border-emerald-600/40 text-emerald-100">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-medium">
            המסטולון מצייר... רגע אחי 🟢
          </span>
          <span className="dot-typing" />
          <span className="dot-typing" />
          <span className="dot-typing" />
        </div>
      )}

      <main className="relative z-10 max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-32">
        <div
          ref={scrollRef}
          className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1"
        >
          {messages.length === 0 ? (
            <div className="text-center text-smoke-300/70 text-sm py-12 px-6">
              עדיין שקט פה. תתחיל בלכתוב משהו, או תלחץ על ✨ כדי לצייר. כל מי
              שנכנס לקישור רואה את הכל.
            </div>
          ) : (
            messages.map((m) => (
              <Bubble key={m.id} msg={m} myAuthorId={author.id} />
            ))
          )}
        </div>
      </main>

      {imagineOpen && (
        <ImaginePanel
          onClose={() => setImagineOpen(false)}
          onSubmit={(p, f) => {
            setImagineOpen(false);
            void imagine(p, f);
          }}
        />
      )}

      <Composer
        input={input}
        setInput={setInput}
        onKeyDown={onKeyDown}
        onSend={() => void send(input)}
        onImagine={() => setImagineOpen(true)}
        disabled={sending}
        inputRef={inputRef}
      />
    </div>
  );
}

async function pollGeneration(id: string): Promise<string> {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(i === 0 ? 2500 : 2000);
    const res = await fetch(`/api/imagine/${encodeURIComponent(id)}`);
    if (!res.ok) continue;
    const data = (await res.json()) as { status?: string; imageUrl?: string };
    if (data.status === "COMPLETE" && data.imageUrl) return data.imageUrl;
    if (data.status === "FAILED") throw new Error("generation_failed");
  }
  throw new Error("timeout");
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function Bubble({
  msg,
  myAuthorId,
}: {
  msg: RoomMsg;
  myAuthorId: string;
}) {
  const isMe = msg.author?.id === myAuthorId;
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
      <div
        className={[
          "max-w-[82%] sm:max-w-[70%] px-4 py-3 rounded-2xl shadow-lg leading-relaxed text-[15px]",
          isMe ? "bubble-me rounded-bl-sm" : "bubble-bot rounded-br-sm",
        ].join(" ")}
      >
        {isUser && msg.author && !isMe && (
          <div className="text-[11px] text-smoke-100/90 font-semibold mb-1">
            {msg.author.name}
          </div>
        )}

        {msg.role === "bot" && msg.mood && !msg.image && (
          <div className="text-[11px] text-smoke-300 mb-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-smoke-400 animate-pulse" />
            <span>מצב רוח: {MOOD_LABEL[msg.mood]}</span>
          </div>
        )}

        {msg.image?.status === "pending" && (
          <div className="text-[11px] text-smoke-300 mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-pulse" />
            <span>nano banana pro · רץ</span>
          </div>
        )}

        {msg.image?.status === "ready" && msg.image.url && (
          <a
            href={msg.image.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl overflow-hidden border border-smoke-700/40 mb-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.image.url}
              alt={msg.image.prompt ?? "imagine"}
              className="w-full h-auto"
              loading="lazy"
            />
          </a>
        )}

        {msg.image?.prompt && msg.image.status === "ready" && (
          <div className="text-[12px] text-smoke-300/80 mb-1">
            “{msg.image.prompt}”
          </div>
        )}

        {msg.text && (
          <div className="whitespace-pre-wrap">{msg.text}</div>
        )}
      </div>
    </div>
  );
}

function ImaginePanel({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (prompt: string, ref: File | null) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const previewUrl = file ? URL.createObjectURL(file) : null;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="fixed inset-0 z-30 bg-smoke-950/70 backdrop-blur-sm grid place-items-end sm:place-items-center px-3 sm:px-0">
      <div className="w-full sm:max-w-md bg-smoke-900/95 border border-smoke-700/60 rounded-2xl p-4 shadow-2xl glow-ring">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-smoke-200" />
          <h2 className="text-smoke-100 font-semibold flex-1">תצייר לחדר</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-smoke-800/60 text-smoke-300"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="לדוגמה: ערן יושב על ספה ירוקה ובוכה לתוך בונג ריק"
          className="w-full input-glow resize-none rounded-xl bg-smoke-950/80 border border-smoke-700/60 px-3 py-2.5 text-smoke-100 placeholder:text-smoke-300/50 text-sm"
          dir="rtl"
        />

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-full bg-smoke-800/60 hover:bg-smoke-700/70 border border-smoke-700/60 text-smoke-200 flex items-center gap-1.5 transition"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {file ? "החלף תמונה" : "תמונת התייחסות (לא חובה)"}
          </button>
          {file && (
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-xs text-smoke-300/80 hover:text-smoke-100"
            >
              הסר
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
            }}
          />
        </div>

        {previewUrl && (
          <div className="mt-3 rounded-xl overflow-hidden border border-smoke-700/60 max-h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="preview"
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            if (submitting || !prompt.trim()) return;
            setSubmitting(true);
            onSubmit(prompt, file);
          }}
          disabled={submitting || !prompt.trim()}
          className="mt-4 w-full h-11 rounded-xl bg-gradient-to-br from-smoke-400 to-smoke-600 text-white font-medium disabled:opacity-60 transition active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="dot-typing" />
              <span className="dot-typing" />
              <span className="dot-typing" />
              <span className="ms-2">שולח לציור...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              תצייר ושתף לחדר
            </>
          )}
        </button>

        <p className="text-[10px] text-smoke-400/70 mt-3 text-center">
          nano banana pro · בערך 10–25 שניות · גלוי לכולם בחדר
        </p>
      </div>
    </div>
  );
}

function Composer({
  input,
  setInput,
  onKeyDown,
  onSend,
  onImagine,
  disabled,
  inputRef,
}: {
  input: string;
  setInput: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onImagine: () => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 border-t border-smoke-700/40 bg-smoke-950/80 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3">
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={onImagine}
            className="h-12 w-12 shrink-0 rounded-full bg-smoke-800/70 hover:bg-smoke-700/80 border border-smoke-700/60 text-smoke-200 grid place-items-center transition active:scale-95"
            aria-label="תצייר"
            title="תצייר לחדר"
          >
            <Sparkles className="w-5 h-5" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="כתוב משהו לחדר..."
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
          חדר ציבורי · כל מי שיש לו את הקישור רואה הכל
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

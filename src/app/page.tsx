"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Leaf,
  Flame,
  Sparkles,
  ImageIcon,
  X,
  Copy,
  Check,
} from "lucide-react";

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
  imageUrl?: string;
  imagePrompt?: string;
  imageStatus?: "pending" | "awaiting" | "ready" | "error";
  approveUrl?: string;
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
  const [imagineOpen, setImagineOpen] = useState(false);
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

  async function imagine(prompt: string, refFile: File | null) {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const userBubbleText = refFile
      ? `🎨 ${trimmed}  (תמונת התייחסות מצורפת)`
      : `🎨 ${trimmed}`;
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "me", text: userBubbleText },
    ]);

    const placeholderId = uid();
    setMessages((prev) => [
      ...prev,
      {
        id: placeholderId,
        role: "bot",
        text: "המסטולון מצייר... רגע אחי 🟢",
        imagePrompt: trimmed,
        imageStatus: "pending",
      },
    ]);

    try {
      let refImageId: string | null = null;
      if (refFile) {
        const fd = new FormData();
        fd.append("file", refFile);
        const up = await fetch("/api/imagine/upload", {
          method: "POST",
          body: fd,
        });
        if (!up.ok) {
          const detail = await readErrorDetail(up);
          throw new Error(`upload_failed: ${detail}`);
        }
        const upData = (await up.json()) as { imageId?: string };
        if (!upData.imageId) throw new Error("no_image_id");
        refImageId = upData.imageId;
      }

      const create = await fetch("/api/imagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, refImageId }),
      });
      if (!create.ok) {
        const detail = await readErrorDetail(create);
        throw new Error(`create_failed: ${detail}`);
      }
      const createData = (await create.json()) as {
        generationId?: string;
        awaitingApproval?: boolean;
        pendingId?: string;
      };

      let genId = createData.generationId;

      if (createData.awaitingApproval && createData.pendingId) {
        const approveUrl = `${window.location.origin}/admin/approve/${createData.pendingId}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  text:
                    "הגענו ל-10 תמונות חינם. שלח את הקישור הזה לאלעד כדי לאשר:",
                  imageStatus: "awaiting",
                  approveUrl,
                }
              : m,
          ),
        );
        const decision = await pollPending(createData.pendingId);
        if (decision.status === "denied") {
          throw new Error("denied");
        }
        genId = decision.generationId;
      }

      if (!genId) throw new Error("no_generation_id");

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                text: "המסטולון מצייר... רגע אחי 🟢",
                imageStatus: "pending",
                approveUrl: undefined,
              }
            : m,
        ),
      );

      const imageUrl = await pollGeneration(genId);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                text: trimmed,
                imageUrl,
                imageStatus: "ready",
              }
            : m,
        ),
      );
    } catch (err) {
      const denied = err instanceof Error && err.message === "denied";
      const detail =
        err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                text: denied
                  ? "אלעד אמר לא הפעם 😔"
                  : `אחי הראש שלי לא צייר. ננסה שוב אחר כך.\n\n[debug: ${detail}]`,
                imageStatus: "error",
                mood: denied ? "eran-disses" : "forgetful",
                approveUrl: undefined,
              }
            : m,
        ),
      );
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

      {messages.some(
        (m) => m.imageStatus === "pending" || m.imageStatus === "awaiting",
      ) && (
        <div className="relative z-10 px-4 py-2.5 flex items-center justify-center gap-2 bg-emerald-900/80 backdrop-blur-md border-b border-emerald-600/40 text-emerald-100">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-medium">
            {messages.some((m) => m.imageStatus === "awaiting")
              ? "ממתין לאישור מאלעד..."
              : "המסטולון מצייר... רגע אחי 🟢"}
          </span>
          <span className="dot-typing" />
          <span className="dot-typing" />
          <span className="dot-typing" />
        </div>
      )}

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
        disabled={pending}
        inputRef={inputRef}
      />
    </div>
  );
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; status?: number };
    const code = data?.error ?? "unknown";
    const status = data?.status ?? res.status;
    return `${res.status}/${code}${status !== res.status ? `(${status})` : ""}`;
  } catch {
    return `${res.status}`;
  }
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

async function pollPending(
  pendingId: string,
): Promise<{ status: "approved" | "denied"; generationId?: string }> {
  const maxAttempts = 360;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);
    const res = await fetch(
      `/api/imagine/pending/${encodeURIComponent(pendingId)}`,
    );
    if (!res.ok) continue;
    const data = (await res.json()) as {
      status?: string;
      generationId?: string | null;
    };
    if (data.status === "approved") {
      return {
        status: "approved",
        generationId: data.generationId ?? undefined,
      };
    }
    if (data.status === "denied") {
      return { status: "denied" };
    }
  }
  throw new Error("approval_timeout");
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
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

        {msg.imageStatus === "pending" && (
          <div className="text-[11px] text-smoke-300 mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-pulse" />
            <span>nano banana pro · רץ</span>
          </div>
        )}

        {msg.imageStatus === "awaiting" && (
          <div className="text-[11px] text-smoke-300 mb-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>ממתין לאישור</span>
          </div>
        )}

        {msg.imageStatus === "awaiting" && msg.approveUrl ? (
          <div className="space-y-2">
            <div className="whitespace-pre-wrap text-sm">{msg.text}</div>
            <CopyLink url={msg.approveUrl} />
          </div>
        ) : msg.imageUrl && msg.imageStatus === "ready" ? (
          <div className="space-y-2">
            <a
              href={msg.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl overflow-hidden border border-smoke-700/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={msg.imageUrl}
                alt={msg.imagePrompt ?? "imagine"}
                className="w-full h-auto"
                loading="lazy"
              />
            </a>
            {msg.text && (
              <div className="text-[13px] text-smoke-200/90 whitespace-pre-wrap">
                {msg.text}
              </div>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{msg.text}</div>
        )}
      </div>
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const msg = encodeURIComponent(`אישור למסטולון: ${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 bg-smoke-950/60 border border-smoke-700/60 rounded-lg px-2.5 py-1.5">
        <code className="flex-1 text-[11px] text-smoke-200 truncate" dir="ltr">
          {url}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 p-1.5 rounded-md hover:bg-smoke-800/70 text-smoke-200"
          aria-label="העתק"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-300" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={shareWhatsApp}
        className="w-full text-xs px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white"
      >
        שלח לאלעד בוואטסאפ
      </button>
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
          <h2 className="text-smoke-100 font-semibold flex-1">תצייר לי משהו</h2>
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
              תצייר
            </>
          )}
        </button>

        <p className="text-[10px] text-smoke-400/70 mt-3 text-center">
          nano banana pro · בערך 10–25 שניות
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
            title="תצייר לי משהו"
          >
            <Sparkles className="w-5 h-5" />
          </button>

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

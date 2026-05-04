import { redirect } from "next/navigation";
import { isOwner } from "@/lib/admin";
import { getKv, loadPending } from "@/lib/kv";

export const runtime = "edge";

type PageParams = Promise<{ id: string }>;

export default async function ApprovePage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;

  if (!(await isOwner())) {
    redirect(`/admin/login?next=/admin/approve/${encodeURIComponent(id)}`);
  }

  const kv = getKv();
  if (!kv) {
    return (
      <Wrap>
        <Title>אין KV מחובר</Title>
        <P>צריך לקשר את ה-KV namespace לפרויקט (MASTULON_KV).</P>
      </Wrap>
    );
  }

  const pending = await loadPending(kv, id);
  if (!pending) {
    return (
      <Wrap>
        <Title>בקשה לא נמצאה</Title>
        <P>אולי פג תוקפה או שהמזהה לא נכון.</P>
      </Wrap>
    );
  }

  const created = new Date(pending.createdAt).toLocaleString("he-IL");

  if (pending.status === "approved") {
    return (
      <Wrap>
        <Title>אושר ✅</Title>
        <KeyVal label="פרומפט">{pending.prompt}</KeyVal>
        <KeyVal label="נוצרה ב">{created}</KeyVal>
        {pending.generationId && (
          <KeyVal label="generationId">{pending.generationId}</KeyVal>
        )}
      </Wrap>
    );
  }

  if (pending.status === "denied") {
    return (
      <Wrap>
        <Title>נדחה ❌</Title>
        <KeyVal label="פרומפט">{pending.prompt}</KeyVal>
        <KeyVal label="סיבה">{pending.reason ?? "אין"}</KeyVal>
        <KeyVal label="נוצרה ב">{created}</KeyVal>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Title>בקשה ממתינה</Title>
      <KeyVal label="פרומפט">{pending.prompt}</KeyVal>
      <KeyVal label="תמונת התייחסות">
        {pending.refImageId ?? "אין"}
      </KeyVal>
      <KeyVal label="נוצרה ב">{created}</KeyVal>

      <div className="flex gap-2 pt-2">
        <form method="POST" action="/api/admin/decide" className="flex-1">
          <input type="hidden" name="id" value={pending.id} />
          <input type="hidden" name="decision" value="approve" />
          <button
            type="submit"
            className="w-full h-11 rounded-xl bg-gradient-to-br from-smoke-400 to-smoke-600 text-white font-medium"
          >
            אשר ואצור
          </button>
        </form>
        <form method="POST" action="/api/admin/decide" className="flex-1">
          <input type="hidden" name="id" value={pending.id} />
          <input type="hidden" name="decision" value="deny" />
          <button
            type="submit"
            className="w-full h-11 rounded-xl bg-smoke-800/70 hover:bg-smoke-700/80 border border-smoke-700/60 text-smoke-100 font-medium"
          >
            דחה
          </button>
        </form>
      </div>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-smoke-950 grid place-items-center px-4 py-8">
      <div className="w-full max-w-md bg-smoke-900/80 border border-smoke-700/60 rounded-2xl p-6 space-y-3">
        {children}
      </div>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-smoke-100 font-semibold text-lg">{children}</h1>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-smoke-300/80 text-sm">{children}</p>;
}

function KeyVal({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-smoke-300/70 text-[11px] uppercase tracking-wide">
        {label}
      </div>
      <div className="text-smoke-100 text-sm break-words whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}

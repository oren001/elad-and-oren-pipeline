export const runtime = "edge";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/admin";
  const error = sp.error === "1";

  return (
    <div className="min-h-screen bg-smoke-950 grid place-items-center px-4">
      <form
        method="POST"
        action="/api/admin/login"
        className="w-full max-w-sm bg-smoke-900/80 border border-smoke-700/60 rounded-2xl p-6 space-y-4"
      >
        <div>
          <h1 className="text-smoke-100 font-semibold text-lg">כניסת בעלים</h1>
          <p className="text-smoke-300/80 text-xs mt-1">
            רק אלעד אמור להיות פה.
          </p>
        </div>

        <input type="hidden" name="next" value={next} />

        <div>
          <label
            htmlFor="password"
            className="block text-smoke-200 text-xs mb-1.5"
          >
            סיסמה
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            className="w-full input-glow rounded-xl bg-smoke-950/80 border border-smoke-700/60 px-3 py-2.5 text-smoke-100"
            dir="ltr"
          />
        </div>

        {error && (
          <p className="text-red-400 text-xs">סיסמה שגויה. תנסה שוב.</p>
        )}

        <button
          type="submit"
          className="w-full h-11 rounded-xl bg-gradient-to-br from-smoke-400 to-smoke-600 text-white font-medium"
        >
          כניסה
        </button>
      </form>
    </div>
  );
}

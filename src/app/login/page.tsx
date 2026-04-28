import { adminLogin } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded bg-brand flex items-center justify-center text-white font-bold text-sm">
            EO
          </div>
          <span className="font-semibold text-ink-800">Admin</span>
        </div>
        <h1 className="text-xl font-bold text-ink-900 mb-1">Sign in</h1>
        <p className="text-sm text-ink-400 mb-6">Enter the admin password to continue.</p>
        <form action={adminLogin} className="space-y-4">
          <div>
            <label className="label block mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="input"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">Wrong password — try again.</p>
          )}
          <button type="submit" className="btn-primary w-full justify-center py-2.5">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

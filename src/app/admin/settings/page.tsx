import { TopBar } from "@/components/TopBar";
import { adminLogout } from "@/lib/actions/auth";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Settings" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-6 space-y-5">
          <div className="card p-5">
            <h2 className="font-semibold text-ink-800 mb-4">Environment</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">DATABASE_URL</dt>
                <dd className="text-ink-800 font-mono text-xs">
                  {process.env.DATABASE_URL ? "✓ set" : "✗ missing"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">ADMIN_PASSWORD</dt>
                <dd className="text-ink-800 font-mono text-xs">
                  {process.env.ADMIN_PASSWORD ? "✓ set" : "✗ missing"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Version</dt>
                <dd className="text-ink-800 font-mono text-xs">0.1.0</dd>
              </div>
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-ink-800 mb-2">Session</h2>
            <p className="text-sm text-ink-500 mb-4">
              You are signed in as an admin.
            </p>
            <form action={adminLogout}>
              <button type="submit" className="btn-soft text-red-600 hover:bg-red-50">
                Log out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

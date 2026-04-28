import { submitLead } from "@/lib/actions/intake";

export default function IntakePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-50 to-white flex flex-col">
      <header className="px-6 py-5 flex items-center gap-3 border-b border-ink-100 bg-white">
        <div className="w-8 h-8 rounded bg-brand flex items-center justify-center text-white font-bold text-sm">
          EO
        </div>
        <span className="font-semibold text-ink-800">Elad &amp; Oren</span>
        <span className="text-ink-300 text-sm">· Vibe Coding</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-ink-900 mb-3">
              Let&apos;s build something together
            </h1>
            <p className="text-ink-500 text-lg">
              Tell us about your project and we&apos;ll get back to you within 24 hours.
            </p>
          </div>

          <form action={submitLead} className="card p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label block mb-1.5" htmlFor="name">
                  Your name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="input"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="label block mb-1.5" htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="input"
                  placeholder="jane@yourcompany.com"
                />
              </div>
            </div>

            <div>
              <label className="label block mb-1.5" htmlFor="business">
                Business name
              </label>
              <input
                id="business"
                name="business"
                type="text"
                className="input"
                placeholder="Your Company Pty Ltd"
              />
            </div>

            <div>
              <label className="label block mb-1.5" htmlFor="description">
                What do you want to build? <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={5}
                className="input resize-none"
                placeholder="Describe your idea — what problem it solves, who uses it, any features you have in mind..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label block mb-1.5" htmlFor="budget">
                  Budget (rough is fine)
                </label>
                <input
                  id="budget"
                  name="budget"
                  type="text"
                  className="input"
                  placeholder="e.g. $5k, $10–20k, not sure"
                />
              </div>
              <div>
                <label className="label block mb-1.5" htmlFor="timeline">
                  Timeline
                </label>
                <input
                  id="timeline"
                  name="timeline"
                  type="text"
                  className="input"
                  placeholder="e.g. ASAP, 3 months, flexible"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full justify-center py-3 text-base">
              Send request
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

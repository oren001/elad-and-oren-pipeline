import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";

interface Edit {
  path: string;
  mode: "edit" | "create" | "rewrite";
  old_string?: string;
  new_string: string;
}

interface Body {
  rationale: string;
  edits: Edit[];
}

// Apply a patch proposed by Claude (via the propose_code_change tool) to the
// running project's source files. Only allowed:
// - in development (NODE_ENV !== 'production')
// - for paths under src/ or public/
// - never to .env, secrets, package.json's lock-related fields
//
// Each successful patch is appended to .claude-os-changelog.json so we have a
// record of what the system has changed about itself.

const ALLOWED_PREFIXES = ["src/", "public/"];
const FORBIDDEN = [".env", "package.json", ".git/"];

function isAllowed(p: string): boolean {
  const norm = p.replace(/\\/g, "/").replace(/^\.\//, "");
  if (norm.includes("..")) return false;
  if (FORBIDDEN.some((f) => norm.includes(f))) return false;
  return ALLOWED_PREFIXES.some((pref) => norm.startsWith(pref));
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "self-patching is disabled in production" }, { status: 403 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!Array.isArray(body.edits) || body.edits.length === 0) {
    return NextResponse.json({ error: "no edits" }, { status: 400 });
  }

  const cwd = process.cwd();
  const applied: Array<{ path: string; mode: string; bytes: number }> = [];

  for (const e of body.edits) {
    if (!isAllowed(e.path)) {
      return NextResponse.json({ error: `path not allowed: ${e.path}` }, { status: 403 });
    }
    const full = path.resolve(cwd, e.path);
    if (!full.startsWith(cwd)) {
      return NextResponse.json({ error: `path escapes cwd: ${e.path}` }, { status: 403 });
    }

    if (e.mode === "create") {
      try {
        await fs.access(full);
        return NextResponse.json({ error: `file exists: ${e.path}` }, { status: 409 });
      } catch {
        /* doesn't exist — good */
      }
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, e.new_string, "utf8");
      applied.push({ path: e.path, mode: e.mode, bytes: e.new_string.length });
    } else if (e.mode === "rewrite") {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, e.new_string, "utf8");
      applied.push({ path: e.path, mode: e.mode, bytes: e.new_string.length });
    } else if (e.mode === "edit") {
      if (!e.old_string) {
        return NextResponse.json({ error: `edit missing old_string: ${e.path}` }, { status: 400 });
      }
      const current = await fs.readFile(full, "utf8");
      const occurrences = current.split(e.old_string).length - 1;
      if (occurrences === 0) {
        return NextResponse.json({ error: `old_string not found in ${e.path}` }, { status: 404 });
      }
      if (occurrences > 1) {
        return NextResponse.json(
          { error: `old_string matches ${occurrences} times in ${e.path}; make it unique` },
          { status: 409 },
        );
      }
      const next = current.replace(e.old_string, e.new_string);
      await fs.writeFile(full, next, "utf8");
      applied.push({ path: e.path, mode: e.mode, bytes: next.length });
    }
  }

  // Append to changelog
  const logPath = path.join(cwd, ".claude-os-changelog.json");
  let log: Array<{ ts: string; rationale: string; edits: typeof applied }> = [];
  try {
    log = JSON.parse(await fs.readFile(logPath, "utf8"));
  } catch {
    /* no log yet */
  }
  log.push({ ts: new Date().toISOString(), rationale: body.rationale, edits: applied });
  await fs.writeFile(logPath, JSON.stringify(log, null, 2), "utf8");

  return NextResponse.json({ ok: true, applied });
}

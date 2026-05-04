import { passwordMatches, setOwnerCookie } from "@/lib/admin";

export const runtime = "edge";

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  const password = form?.get("password");
  const next = form?.get("next");
  const nextUrl =
    typeof next === "string" && next.startsWith("/") ? next : "/admin";

  if (typeof password !== "string" || !passwordMatches(password)) {
    const url = new URL(req.url);
    url.pathname = "/admin/login";
    url.searchParams.set("error", "1");
    if (typeof next === "string" && next.startsWith("/")) {
      url.searchParams.set("next", next);
    }
    return Response.redirect(url.toString(), 303);
  }

  await setOwnerCookie();

  const dest = new URL(req.url);
  dest.pathname = nextUrl;
  dest.search = "";
  return Response.redirect(dest.toString(), 303);
}

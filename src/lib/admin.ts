import { cookies } from "next/headers";

const COOKIE_NAME = "owner_session";
const COOKIE_VALUE = "1";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function isOwner(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value === COOKIE_VALUE;
}

export async function setOwnerCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearOwnerCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.OWNER_PASSWORD;
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ input.charCodeAt(i);
  }
  return mismatch === 0;
}

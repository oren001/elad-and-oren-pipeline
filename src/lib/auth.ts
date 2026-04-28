import { cookies } from "next/headers";

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return store.get("admin_session")?.value === "1";
}

"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function adminLogin(formData: FormData) {
  const password = formData.get("password") as string;
  if (password === process.env.ADMIN_PASSWORD) {
    const store = await cookies();
    store.set("admin_session", "1", {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    redirect("/admin");
  }
  redirect("/login?error=1");
}

export async function adminLogout() {
  const store = await cookies();
  store.delete("admin_session");
  redirect("/login");
}

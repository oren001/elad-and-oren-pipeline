import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthenticated();
  if (!authed) redirect("/login");
  return <Shell>{children}</Shell>;
}

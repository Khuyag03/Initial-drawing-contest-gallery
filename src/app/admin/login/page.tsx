import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/app/admin/login/AdminLoginForm";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-soft">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
          Админ хэсэг
        </p>
        <h1 className="mb-6 text-2xl font-semibold text-neutral-950">Нэвтрэх</h1>
        <AdminLoginForm />
      </section>
    </main>
  );
}

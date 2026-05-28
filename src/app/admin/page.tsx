import { AdminDashboard } from "@/components/AdminDashboard";
import { getAdminResults } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const drawings = await getAdminResults();

  return <AdminDashboard drawings={drawings} />;
}

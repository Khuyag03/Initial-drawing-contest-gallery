import { getAdminEmployees } from "@/app/actions/admin-employees";
import { EmployeeDashboard } from "@/components/EmployeeDashboard";

export const dynamic = "force-dynamic";

export default async function AdminEmployeesPage() {
  const employees = await getAdminEmployees();
  return <EmployeeDashboard employees={employees} />;
}

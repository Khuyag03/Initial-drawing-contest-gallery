"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  adminAddEmployee,
  adminDeleteEmployee,
  adminImportEmployees,
  adminResetAllEmployeeVotes,
  adminResetEmployeeVotes,
  adminUpdateEmployee,
  adminUpdateEmployeeStatus
} from "@/app/actions/admin-employees";
import { EMPLOYEE_STATUSES, type ActionState, type AdminEmployeeRow, type EmployeeStatus } from "@/types";

type EmployeeDashboardProps = {
  employees: AdminEmployeeRow[];
};

const idleState: ActionState = { status: "idle", message: "" };

function escapeCsv(value: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function EmployeeDashboard({ employees }: EmployeeDashboardProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionState>(idleState);
  const [isPending, startTransition] = useTransition();

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        employee.sap_code.toLowerCase().includes(normalizedQuery) ||
        employee.first_name.toLowerCase().includes(normalizedQuery) ||
        employee.last_name.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [employees, query, statusFilter]);

  function setResult(result: ActionState) {
    setNotice(result);
    if (result.status === "success") {
      router.refresh();
    }
  }

  function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setNotice(idleState);
    startTransition(async () => {
      const result = await adminImportEmployees(formData);
      setResult({
        status: result.status,
        message: [
          result.message,
          result.totalRows !== undefined
            ? `Total: ${result.totalRows}, Imported: ${result.imported}, Updated: ${result.updated}, Skipped: ${result.skipped}`
            : "",
          result.errors?.length ? `Errors: ${result.errors.slice(0, 3).join(" | ")}` : ""
        ]
          .filter(Boolean)
          .join(" · ")
      });
      if (result.status === "success") {
        form.reset();
      }
    });
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await adminAddEmployee(formData);
      setResult(result);
      if (result.status === "success") {
        form.reset();
      }
    });
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await adminUpdateEmployee(formData);
      setResult(result);
      if (result.status === "success") {
        setEditingId(null);
      }
    });
  }

  function runEmployeeAction(action: () => Promise<ActionState>) {
    setNotice(idleState);
    startTransition(async () => setResult(await action()));
  }

  function exportCsv() {
    const header = ["SAP", "First Name", "Last Name", "Status", "Votes used", "Last vote date"];
    const rows = filteredEmployees.map((employee) => [
      employee.sap_code,
      employee.first_name,
      employee.last_name,
      employee.status,
      employee.votes_used,
      employee.last_vote_date
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-[1500px]">
        <header className="grid gap-5 border-b border-neutral-200 pb-7 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              Админ хэсэг
            </p>
            <h1 className="text-4xl font-semibold leading-none text-neutral-950 sm:text-6xl">Ажилтны эрх</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950">
              Зураг
            </Link>
            <Link href="/admin/votes" className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950">
              Саналууд
            </Link>
          </div>
        </header>

        {notice.message ? (
          <p className={clsx("mt-5 rounded-lg px-4 py-3 text-sm font-medium", notice.status === "success" ? "bg-neutral-950 text-white" : "bg-red-50 text-red-700 ring-1 ring-red-100")}>
            {notice.message}
          </p>
        ) : null}

        <section className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-5">
            <form className="rounded-lg border border-neutral-200 bg-white p-5" onSubmit={handleImport}>
              <h2 className="text-xl font-medium text-neutral-950">Excel импорт</h2>
              <input
                name="file"
                type="file"
                accept=".xlsx,.xls"
                className="mt-5 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-neutral-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                required
              />
              <label className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
                <input name="resetStatus" type="checkbox" className="h-4 w-4 rounded border-neutral-300" />
                reset status = active
              </label>
              <button type="submit" disabled={isPending} className="mt-5 w-full rounded-full border border-neutral-950 bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300">
                Импорт хийх
              </button>
            </form>

            <form className="rounded-lg border border-neutral-200 bg-white p-5" onSubmit={handleAdd}>
              <h2 className="text-xl font-medium text-neutral-950">Ажилтан нэмэх</h2>
              <div className="mt-5 space-y-3">
                <input name="sapCode" placeholder="SAP" className="w-full rounded-lg border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-950" required />
                <input name="firstName" placeholder="First Name" className="w-full rounded-lg border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-950" required />
                <input name="lastName" placeholder="Last Name" className="w-full rounded-lg border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-950" required />
                <select name="status" className="w-full rounded-lg border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-950" defaultValue="active">
                  {EMPLOYEE_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={isPending} className="mt-5 w-full rounded-full border border-neutral-950 bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300">
                Нэмэх
              </button>
            </form>
          </aside>

          <section>
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <label className="text-sm font-medium text-neutral-600">
                  Хайх
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SAP, нэр..." className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-950" />
                </label>
                <label className="text-sm font-medium text-neutral-600">
                  Status
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EmployeeStatus | "all")} className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-950">
                    <option value="all">Бүгд</option>
                    {EMPLOYEE_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportCsv} className="rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950">
                  CSV татах
                </button>
                <button type="button" onClick={() => window.confirm("Бүх ажилтны саналын эрхийг шинэчлэх үү?") && runEmployeeAction(adminResetAllEmployeeVotes)} disabled={isPending} className="rounded-full border border-red-100 px-5 py-3 text-sm font-semibold text-red-700 transition hover:border-red-300 disabled:opacity-50">
                  Бүгдийн эрх шинэчлэх
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredEmployees.map((employee) => (
                <article key={employee.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">SAP {employee.sap_code}</p>
                      <h2 className="mt-1 text-xl font-medium text-neutral-950">{employee.first_name} {employee.last_name}</h2>
                      <p className="mt-2 text-sm text-neutral-500">
                        {employee.status} · {employee.votes_used} санал · {employee.last_vote_date ? new Date(employee.last_vote_date).toLocaleString() : "Санал өгөөгүй"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => runEmployeeAction(() => adminUpdateEmployeeStatus(employee.id, "active"))} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">Идэвхжүүлэх</button>
                      <button type="button" onClick={() => runEmployeeAction(() => adminUpdateEmployeeStatus(employee.id, "inactive"))} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">Идэвхгүй болгох</button>
                      <button type="button" onClick={() => runEmployeeAction(() => adminUpdateEmployeeStatus(employee.id, "blocked"))} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">Блоклох</button>
                      <button type="button" onClick={() => window.confirm("Энэ ажилтны саналын эрхийг шинэчлэх үү?") && runEmployeeAction(() => adminResetEmployeeVotes(employee.id))} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">Эрх шинэчлэх</button>
                      <button type="button" onClick={() => setEditingId(editingId === employee.id ? null : employee.id)} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">Засах</button>
                      <button type="button" onClick={() => window.confirm("Ажилтныг устгах уу?") && runEmployeeAction(() => adminDeleteEmployee(employee.id))} className="rounded-full border border-red-100 px-4 py-2 text-sm font-semibold text-red-700">Устгах</button>
                    </div>
                  </div>

                  {editingId === employee.id ? (
                    <form className="mt-5 grid gap-3 border-t border-neutral-200 pt-5 md:grid-cols-4" onSubmit={handleEdit}>
                      <input type="hidden" name="id" value={employee.id} />
                      <input name="firstName" defaultValue={employee.first_name} className="rounded-lg border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-950" required />
                      <input name="lastName" defaultValue={employee.last_name} className="rounded-lg border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-950" required />
                      <select name="status" defaultValue={employee.status} className="rounded-lg border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-950">
                        {EMPLOYEE_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <button type="submit" className="rounded-full border border-neutral-950 bg-neutral-950 px-5 py-3 text-sm font-semibold text-white">Хадгалах</button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { adminDeleteVote, adminRestoreVote } from "@/app/actions/admin-employees";
import { AGE_CATEGORIES, type ActionState, type AdminVoteRecord, type AgeCategory } from "@/types";

type VotesDashboardProps = {
  votes: AdminVoteRecord[];
};

const idleState: ActionState = { status: "idle", message: "" };

export function VotesDashboard({ votes }: VotesDashboardProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [ageFilter, setAgeFilter] = useState<AgeCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "deleted">("all");
  const [notice, setNotice] = useState<ActionState>(idleState);
  const [isPending, startTransition] = useTransition();

  const filteredVotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return votes.filter((vote) => {
      const fullName = `${vote.employee_first_name ?? ""} ${vote.employee_last_name ?? ""}`.toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        vote.sap_code.toLowerCase().includes(normalizedQuery) ||
        fullName.includes(normalizedQuery) ||
        vote.drawing_title.toLowerCase().includes(normalizedQuery);
      const matchesAge = ageFilter === "all" || vote.age_category === ageFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !vote.deleted_at) ||
        (statusFilter === "deleted" && Boolean(vote.deleted_at));
      return matchesQuery && matchesAge && matchesStatus;
    });
  }, [ageFilter, query, statusFilter, votes]);

  function runAction(action: () => Promise<ActionState>) {
    setNotice(idleState);
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-[1500px]">
        <header className="grid gap-5 border-b border-neutral-200 pb-7 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              Админ хэсэг
            </p>
            <h1 className="text-4xl font-semibold leading-none text-neutral-950 sm:text-6xl">Саналын бүртгэл</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950">
              Зураг
            </Link>
            <Link href="/admin/employees" className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950">
              Ажилтны эрх
            </Link>
          </div>
        </header>

        {notice.message ? (
          <p className={clsx("mt-5 rounded-lg px-4 py-3 text-sm font-medium", notice.status === "success" ? "bg-neutral-950 text-white" : "bg-red-50 text-red-700 ring-1 ring-red-100")}>
            {notice.message}
          </p>
        ) : null}

        <div className="mt-8 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 lg:grid-cols-[1fr_180px_180px]">
          <label className="text-sm font-medium text-neutral-600">
            Хайх
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SAP, нэр, зураг..." className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-950" />
          </label>
          <label className="text-sm font-medium text-neutral-600">
            Насны ангилал
            <select value={ageFilter} onChange={(event) => setAgeFilter(event.target.value as AgeCategory | "all")} className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-950">
              <option value="all">Бүгд</option>
              {AGE_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-neutral-600">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "deleted")} className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-950">
              <option value="all">Бүгд</option>
              <option value="active">Идэвхтэй</option>
              <option value="deleted">Хассан</option>
            </select>
          </label>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <div className="grid min-w-[1100px] grid-cols-[150px_120px_160px_120px_1fr_160px_140px_120px] gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">
            <span>Огноо</span>
            <span>SAP</span>
            <span>Нэр</span>
            <span>Нас</span>
            <span>Санал өгсөн зураг</span>
            <span>Device</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          <div className="overflow-x-auto">
            {filteredVotes.map((vote) => (
              <div key={vote.id} className="grid min-w-[1100px] grid-cols-[150px_120px_160px_120px_1fr_160px_140px_120px] gap-4 border-b border-neutral-100 px-4 py-4 text-sm text-neutral-700 last:border-0">
                <span>{new Date(vote.created_at).toLocaleString()}</span>
                <span className="font-semibold text-neutral-950">{vote.sap_code}</span>
                <span>{vote.employee_first_name} {vote.employee_last_name}</span>
                <span>{vote.age_category}</span>
                <span>
                  <span className="font-medium text-neutral-950">{vote.drawing_title}</span>
                  <span className="block text-neutral-400">{vote.drawing_child_name || "Оролцогч"}</span>
                </span>
                <span className="truncate">{vote.browser_summary || "-"}</span>
                <span>{vote.deleted_at ? "Хассан" : "Идэвхтэй"}</span>
                <span>
                  {vote.deleted_at ? (
                    <button type="button" disabled={isPending} onClick={() => runAction(() => adminRestoreVote(vote.id))} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700">
                      Сэргээх
                    </button>
                  ) : (
                    <button type="button" disabled={isPending} onClick={() => window.confirm("Энэ саналыг хасах уу?") && runAction(() => adminDeleteVote(vote.id))} className="rounded-full border border-red-100 px-4 py-2 text-xs font-semibold text-red-700">
                      Хасах
                    </button>
                  )}
                </span>
              </div>
            ))}
            {filteredVotes.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-500">Саналын бүртгэл олдсонгүй.</div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { FormEvent, useState, useTransition } from "react";
import { logoutEmployee, validateSapCode } from "@/app/actions/employee";
import { Gallery } from "@/components/Gallery";
import type { Drawing, EmployeeAccess } from "@/types";

type PublicVotingAppProps = {
  drawings: Drawing[];
  initialEmployee: EmployeeAccess | null;
};

export function PublicVotingApp({ drawings, initialEmployee }: PublicVotingAppProps) {
  const [employee, setEmployee] = useState<EmployeeAccess | null>(initialEmployee);
  const [sapCode, setSapCode] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const result = await validateSapCode(sapCode);
      setMessage(result.message);

      if (result.status === "success") {
        setEmployee(result.employee);
        setSapCode("");
      }
    });
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutEmployee();
      setEmployee(null);
      setMessage("");
    });
  }

  if (!employee) {
    return (
      <section className="mx-auto flex max-w-[1500px] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-[420px] rounded-lg border border-neutral-200 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.06)] sm:p-8">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
            SAP access
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-neutral-950">
            Хүүхдийн гар зургийн санал хураалт
          </h2>
          <p className="mt-4 text-sm leading-6 text-neutral-500">
            Санал өгөхийн тулд SAP дугаараа оруулна уу.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-neutral-700">SAP дугаараа оруулна уу</span>
              <input
                value={sapCode}
                onChange={(event) => setSapCode(event.target.value)}
                placeholder="Жишээ: 9363643"
                inputMode="numeric"
                autoComplete="off"
                className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-950"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-full border border-neutral-950 bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300 disabled:text-white"
            >
              {isPending ? "Түр хүлээнэ үү" : "Нэвтрэх"}
            </button>
          </form>

          {message ? (
            <p className="mt-4 rounded-lg bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700 ring-1 ring-neutral-100">
              {message}
            </p>
          ) : null}

          <p className="mt-5 text-xs leading-5 text-neutral-400">
            Та насны ангилал тус бүрт нэг санал өгөх боломжтой.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto max-w-[1500px] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-950">
              Тавтай морилно уу, {employee.first_name} {employee.last_name}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              SAP: {employee.sap_code}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Гарах
          </button>
        </div>
      </section>
      <section className="mx-auto flex max-w-[1500px] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Gallery drawings={drawings} employee={employee} />
      </section>
    </>
  );
}

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAdmin } from "@/app/actions/admin";
import type { ActionState } from "@/types";

const initialState: ActionState = {
  status: "idle",
  message: ""
};

function LoginButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 w-full rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
    >
      {pending ? "Түр хүлээнэ үү" : "Нэвтрэх"}
    </button>
  );
}

export function AdminLoginForm() {
  const [state, action] = useActionState(loginAdmin, initialState);

  return (
    <form action={action}>
      <label className="block">
        <span className="text-sm font-medium text-neutral-700">Нууц үг</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          className="mt-2 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-base outline-none transition focus:border-neutral-950 focus:bg-white"
          required
        />
      </label>

      {state.message ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</p>
      ) : null}

      <LoginButton />
    </form>
  );
}

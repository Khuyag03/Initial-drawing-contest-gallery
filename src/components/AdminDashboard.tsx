"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { deleteDrawing, finalizeDrawingUpload, logoutAdmin, prepareDrawingUpload, updateDrawing } from "@/app/actions/admin";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { AGE_CATEGORIES, type ActionState, type AdminDrawingResult, type AgeCategory } from "@/types";

type SortKey = "created" | "votes" | "title";

type AdminDashboardProps = {
  drawings: AdminDrawingResult[];
};

const idleState: ActionState = { status: "idle", message: "" };

function escapeCsv(value: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function AdminDashboard({ drawings }: AdminDashboardProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<AgeCategory | "all">("all");
  const [sort, setSort] = useState<SortKey>("votes");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionState>(idleState);
  const [isPending, startTransition] = useTransition();

  const filteredDrawings = useMemo(() => {
    const rows = filter === "all" ? drawings : drawings.filter((drawing) => drawing.age_category === filter);
    return [...rows].sort((left, right) => {
      if (sort === "votes") {
        return right.vote_count - left.vote_count;
      }

      if (sort === "title") {
        return left.title.localeCompare(right.title);
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [drawings, filter, sort]);

  const totalVotes = drawings.reduce((sum, drawing) => sum + drawing.vote_count, 0);
  const votesByAgeCategory = AGE_CATEGORIES.map((category) => ({
    category,
    voteCount: drawings
      .filter((drawing) => drawing.age_category === category)
      .reduce((sum, drawing) => sum + drawing.vote_count, 0)
  }));

  function runAction(action: (formData: FormData) => Promise<ActionState>, formData: FormData, onSuccess?: () => void) {
    setNotice(idleState);
    startTransition(async () => {
      const result = await action(formData);
      setNotice(result);

      if (result.status === "success") {
        onSuccess?.();
        router.refresh();
      }
    });
  }

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const image = formData.get("image");

    if (!(image instanceof File) || image.size === 0) {
      setNotice({ status: "error", message: "Зургийн файл сонгоно уу." });
      return;
    }

    const uploadInput = {
      title: String(formData.get("title") || ""),
      childName: String(formData.get("childName") || ""),
      ageCategory: String(formData.get("ageCategory") || ""),
      fileName: image.name,
      contentType: image.type,
      size: image.size
    };

    setNotice(idleState);
    startTransition(async () => {
      try {
        const prepared = await prepareDrawingUpload(uploadInput);

        if (prepared.status !== "success" || !prepared.upload) {
          setNotice(prepared);
          return;
        }

        const supabase = createBrowserSupabaseClient();
        const { error: uploadError } = await supabase.storage
          .from("drawing-images")
          .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, image, {
            contentType: image.type,
            cacheControl: prepared.upload.cacheControl
          });

        if (uploadError) {
          setNotice({
            status: "error",
            message: `Зураг storage руу оруулахад алдаа гарлаа: ${uploadError.message}`
          });
          return;
        }

        const result = await finalizeDrawingUpload({
          title: uploadInput.title,
          childName: uploadInput.childName,
          ageCategory: uploadInput.ageCategory,
          filePath: prepared.upload.path
        });

        setNotice(result);

        if (result.status === "success") {
          form.reset();
          router.refresh();
        }
      } catch (error) {
        setNotice({
          status: "error",
          message: error instanceof Error ? error.message : "Зураг нэмэхэд алдаа гарлаа."
        });
      }
    });
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    runAction(updateDrawing, formData, () => setEditingId(null));
  }

  function handleDelete(drawingId: string, title: string) {
    if (!window.confirm(`"${title}" зургийг устгах уу?`)) {
      return;
    }

    const formData = new FormData();
    formData.set("id", drawingId);
    runAction(deleteDrawing, formData);
  }

  function exportCsv() {
    const header = ["Title", "Child name/code", "Age category", "Likes", "Created at"];
    const rows = filteredDrawings.map((drawing) => [
      drawing.title,
      drawing.child_name,
      drawing.age_category,
      drawing.vote_count,
      drawing.created_at
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `childrens-day-like-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-[1500px]">
        <header className="grid gap-6 border-b border-neutral-200 pb-8 pt-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              Админ хэсэг
            </p>
            <h1 className="text-4xl font-semibold leading-none text-neutral-950 sm:text-6xl">
              Like удирдлага
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/employees" className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-600 transition hover:border-neutral-950 hover:text-neutral-950">
              Ажилтны эрх
            </Link>
            <Link href="/admin/votes" className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-600 transition hover:border-neutral-950 hover:text-neutral-950">
              Like бүртгэл
            </Link>
            <form action={logoutAdmin}>
              <button
                type="submit"
                className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-600 transition hover:border-neutral-950 hover:text-neutral-950"
              >
                Гарах
              </button>
            </form>
          </div>
        </header>

        <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 sm:grid-cols-3">
          <div className="bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Нийт бүтээл</p>
            <p className="mt-3 text-4xl font-medium text-neutral-950">{drawings.length}</p>
          </div>
          <div className="bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Нийт like</p>
            <p className="mt-3 text-4xl font-medium text-neutral-950">{totalVotes}</p>
          </div>
          <div className="bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Ангилал</p>
            <p className="mt-3 text-4xl font-medium text-neutral-950">{AGE_CATEGORIES.length}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 sm:grid-cols-3">
          {votesByAgeCategory.map((item) => (
            <div key={item.category} className="bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                {item.category} нас
              </p>
              <p className="mt-2 text-2xl font-medium text-neutral-950">{item.voteCount} like</p>
            </div>
          ))}
        </div>

        {notice.message ? (
          <p
            className={clsx(
              "mt-5 rounded-lg px-4 py-3 text-sm font-medium",
              notice.status === "success"
                ? "bg-neutral-950 text-white"
                : "bg-red-50 text-red-700 ring-1 ring-red-100"
            )}
          >
            {notice.message}
          </p>
        ) : null}

        <section className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
          <aside className="h-fit rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-xl font-medium text-neutral-950">Шинэ зураг нэмэх</h2>
            <form className="mt-5 space-y-4" onSubmit={handleUpload}>
              <label className="block">
                <span className="text-sm font-medium text-neutral-600">Зургийн нэр</span>
                <input
                  name="title"
                  className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 outline-none transition focus:border-neutral-950"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-neutral-600">Хүүхдийн нэр эсвэл код</span>
                <input
                  name="childName"
                  className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 outline-none transition focus:border-neutral-950"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-neutral-600">Насны ангилал</span>
                <select
                  name="ageCategory"
                  className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 outline-none transition focus:border-neutral-950"
                  required
                >
                  {AGE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-neutral-600">Зураг</span>
                <input
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-neutral-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-neutral-950"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-full border border-neutral-950 bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300 disabled:text-white"
              >
                {isPending ? "Түр хүлээнэ үү" : "Нэмэх"}
              </button>
            </form>
          </aside>

          <section>
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="text-sm font-medium text-neutral-600">
                  Насны ангилал
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as AgeCategory | "all")}
                    className="mt-2 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-950 sm:w-36"
                  >
                    <option value="all">Бүгд</option>
                    {AGE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-neutral-600">
                  Эрэмбэлэх
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortKey)}
                    className="mt-2 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-950 sm:w-40"
                  >
                    <option value="votes">Like</option>
                    <option value="created">Огноо</option>
                    <option value="title">Нэр</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
              >
                Үр дүн татах
              </button>
            </div>

            <div className="space-y-4">
              {filteredDrawings.map((drawing) => (
                <article key={drawing.id} className="rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-300">
                  <div className="grid gap-4 sm:grid-cols-[112px_1fr_auto] sm:items-center">
                    <img
                      src={drawing.image_url}
                      alt={drawing.title}
                      className="h-32 w-full rounded-lg object-cover sm:h-28 sm:w-28"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-500">{drawing.child_name || "Оролцогч"}</p>
                      <h2 className="mt-1 text-xl font-medium leading-snug text-neutral-950">{drawing.title}</h2>
                      <p className="mt-2 text-sm text-neutral-500">Насны ангилал {drawing.age_category}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                      <p className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-950">
                        {drawing.vote_count} like
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(editingId === drawing.id ? null : drawing.id)}
                          className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950"
                        >
                          Засах
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(drawing.id, drawing.title)}
                          disabled={isPending}
                          className="rounded-full border border-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Устгах
                        </button>
                      </div>
                    </div>
                  </div>

                  {editingId === drawing.id ? (
                    <form className="mt-5 grid gap-4 border-t border-neutral-200 pt-5 md:grid-cols-2" onSubmit={handleUpdate}>
                      <input type="hidden" name="id" value={drawing.id} />
                      <label className="block">
                        <span className="text-sm font-medium text-neutral-600">Зургийн нэр</span>
                        <input
                          name="title"
                          defaultValue={drawing.title}
                          className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 outline-none focus:border-neutral-950"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-neutral-600">Хүүхдийн нэр эсвэл код</span>
                        <input
                          name="childName"
                          defaultValue={drawing.child_name || ""}
                          className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 outline-none focus:border-neutral-950"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-neutral-600">Насны ангилал</span>
                        <select
                          name="ageCategory"
                          defaultValue={drawing.age_category}
                          className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 outline-none focus:border-neutral-950"
                        >
                          {AGE_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-neutral-600">Шинэ зураг</span>
                        <input
                          name="image"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-neutral-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-neutral-950"
                        />
                      </label>
                      <div className="flex gap-3 md:col-span-2">
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded-full border border-neutral-950 bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300 disabled:text-white"
                        >
                          Хадгалах
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950"
                        >
                          Болих
                        </button>
                      </div>
                    </form>
                  ) : null}
                </article>
              ))}

              {filteredDrawings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-neutral-500">
                  Энэ шүүлтүүрт тохирох зураг алга.
                </div>
              ) : null}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

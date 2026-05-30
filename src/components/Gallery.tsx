"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { submitVote } from "@/app/actions/votes";
import { getVoteIdentity } from "@/lib/client-device";
import { AGE_CATEGORIES, type AgeCategory, type Drawing, type EmployeeAccess, type VoteResult } from "@/types";

const SUCCESS_MESSAGE = "Таны санал амжилттай бүртгэгдлээ.";
const ALREADY_VOTED_CATEGORY_MESSAGE = "Та энэ насны ангилалд аль хэдийн санал өгсөн байна.";

type GalleryProps = {
  drawings: Drawing[];
  employee: EmployeeAccess;
};

export function Gallery({ drawings, employee }: GalleryProps) {
  const [voteCountOverrides, setVoteCountOverrides] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Drawing | null>(null);
  const [message, setMessage] = useState<VoteResult | null>(null);
  const [sessionVotes, setSessionVotes] = useState<Partial<Record<AgeCategory, string>>>({});
  const [ageFilter, setAgeFilter] = useState<AgeCategory | "all">("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selected) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);

  const groupedDrawings = useMemo(
    () =>
      drawings
        .filter((drawing) => ageFilter === "all" || drawing.age_category === ageFilter)
        .map((drawing) => ({
          ...drawing,
          vote_count: voteCountOverrides[drawing.id] ?? drawing.vote_count
        })),
    [ageFilter, drawings, voteCountOverrides]
  );
  const selectedDrawing = selected
    ? (groupedDrawings.find((drawing) => drawing.id === selected.id) ?? selected)
    : null;

  function categoryHasVote(ageCategory: AgeCategory) {
    return Boolean(employee.votedCategories[ageCategory] || sessionVotes[ageCategory]);
  }

  function markCategoryVoted(ageCategory: AgeCategory, drawingId: string) {
    setSessionVotes((current) => ({ ...current, [ageCategory]: drawingId }));
  }

  function updateVoteCount(drawingId: string, voteCount?: number) {
    setVoteCountOverrides((current) => {
      const drawing = groupedDrawings.find((item) => item.id === drawingId);
      return {
        ...current,
        [drawingId]: voteCount ?? (drawing?.vote_count ?? 0) + 1
      };
    });
  }

  function vote(drawing: Drawing) {
    setMessage(null);

    if (categoryHasVote(drawing.age_category)) {
      setMessage({
        status: "already_voted_category",
        message: ALREADY_VOTED_CATEGORY_MESSAGE,
        ageCategory: drawing.age_category
      });
      return;
    }

    setPendingId(drawing.id);
    startTransition(async () => {
      const identity = await getVoteIdentity();
      const result = await submitVote(drawing.id, identity);

      if (result.status === "success") {
        markCategoryVoted(drawing.age_category, drawing.id);
        updateVoteCount(drawing.id, result.voteCount);
        setMessage({ status: "success", message: SUCCESS_MESSAGE });
      } else {
        if (result.status === "already_voted" || result.status === "already_voted_category") {
          markCategoryVoted(result.ageCategory ?? drawing.age_category, drawing.id);
        }

        setMessage(result);
      }

      setPendingId(null);
    });
  }

  const categoryVoteNotice = (
      <div className="mb-7 rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm leading-6 text-neutral-600">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>Та насны ангилал тус бүрт нэг санал өгөх боломжтой.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAgeFilter("all")}
            className={ageFilter === "all" ? "rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white" : "rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 transition hover:border-neutral-950"}
          >
            Бүгд
          </button>
          {AGE_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setAgeFilter(category)}
              className={ageFilter === category ? "rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white" : "rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 transition hover:border-neutral-950"}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (drawings.length === 0) {
    return (
      <>
        {categoryVoteNotice}
        <div className="flex min-h-[54vh] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white px-6 text-center">
          <div>
            <p className="text-xl font-medium text-neutral-950">Одоогоор зураг нэмэгдээгүй байна.</p>
            <p className="mt-3 text-sm text-neutral-500">Админ хэсгээс бүтээл нэмсний дараа энд харагдана.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {categoryVoteNotice}

      {message ? (
        <div
          role="status"
          className={clsx(
            "sticky top-4 z-20 mx-auto max-w-xl rounded-full px-5 py-3 text-center text-sm font-medium shadow-[0_16px_40px_rgba(0,0,0,0.08)]",
            message.status === "success"
              ? "bg-neutral-950 text-white"
              : message.status === "already_voted" || message.status === "already_voted_category"
                ? "bg-white text-neutral-950 ring-1 ring-neutral-200"
                : "bg-red-50 text-red-700 ring-1 ring-red-100"
          )}
        >
          {message.message}
        </div>
      ) : null}

      <section className="columns-1 gap-7 sm:columns-2 xl:columns-3">
        {groupedDrawings.map((drawing) => {
          const votedInCategory = categoryHasVote(drawing.age_category);
          return (
          <article
            key={drawing.id}
            className="group mb-8 break-inside-avoid"
          >
            <button
              type="button"
              onClick={() => setSelected(drawing)}
              className="block w-full overflow-hidden rounded-lg bg-neutral-100 text-left ring-1 ring-neutral-200/80 transition duration-500 group-hover:-translate-y-1 group-hover:ring-neutral-300"
              aria-label={`${drawing.title} томоор харах`}
            >
              <img
                src={drawing.image_url}
                alt={drawing.title}
                className="h-auto w-full object-cover transition duration-700 group-hover:scale-[1.018]"
                loading="lazy"
              />
            </button>

            <div className="flex items-start justify-between gap-4 px-1 pt-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
                  {drawing.child_name || "Оролцогч"} · {drawing.age_category}
                </p>
                <h2 className="mt-2 text-xl font-medium leading-tight text-neutral-950">
                  {drawing.title}
                </h2>
                <p className="mt-2 text-sm font-medium text-neutral-500">
                  {drawing.vote_count} санал
                </p>
              </div>
              <button
                type="button"
                onClick={() => vote(drawing)}
                disabled={votedInCategory || pendingId === drawing.id || isPending}
                className="shrink-0 rounded-full border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300 disabled:text-white"
              >
                {pendingId === drawing.id ? "Бүртгэж байна..." : votedInCategory ? "Санал өгсөн" : "Санал өгөх"}
              </button>
            </div>
          </article>
          );
        })}
      </section>

      {groupedDrawings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-neutral-500">
          Энэ насны ангилалд тохирох зураг алга.
        </div>
      ) : null}

      {selectedDrawing ? (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 p-3 sm:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="modal-panel flex max-h-full w-full max-w-7xl flex-col gap-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 text-white">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
                  {selectedDrawing.child_name || "Оролцогч"} · {selectedDrawing.age_category}
                </p>
                <h2 className="mt-1 truncate text-xl font-medium sm:text-2xl">{selectedDrawing.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-xl leading-none transition hover:bg-white/15"
                aria-label="Хаах"
              >
                ×
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-white/[0.03]">
              <img
                src={selectedDrawing.image_url}
                alt={selectedDrawing.title}
                className="max-h-[74vh] w-auto rounded-md object-contain"
              />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">
                  Насны ангилал <span className="text-neutral-950">{selectedDrawing.age_category}</span>
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-950">
                  {selectedDrawing.vote_count} санал
                </p>
              </div>
              <button
                type="button"
                onClick={() => vote(selectedDrawing)}
                disabled={categoryHasVote(selectedDrawing.age_category) || pendingId === selectedDrawing.id || isPending}
                className="rounded-full border border-neutral-950 bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300 disabled:text-white"
              >
                {pendingId === selectedDrawing.id
                  ? "Бүртгэж байна..."
                  : categoryHasVote(selectedDrawing.age_category)
                    ? "Санал өгсөн"
                    : "Санал өгөх"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import clsx from "clsx";
import { submitVote } from "@/app/actions/votes";
import { getVoteIdentity, hasLocalVote, markLocalVote, subscribeToLocalVote } from "@/lib/client-device";
import type { Drawing, VoteResult } from "@/types";

const SUCCESS_MESSAGE = "Таны санал амжилттай бүртгэгдлээ";
const ALREADY_VOTED_MESSAGE = "Та аль хэдийн санал өгсөн байна";

type GalleryProps = {
  drawings: Drawing[];
};

export function Gallery({ drawings }: GalleryProps) {
  const [selected, setSelected] = useState<Drawing | null>(null);
  const [message, setMessage] = useState<VoteResult | null>(null);
  const storedVote = useSyncExternalStore(subscribeToLocalVote, hasLocalVote, () => false);
  const [votedThisSession, setVotedThisSession] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const voted = storedVote || votedThisSession;

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

  const groupedDrawings = useMemo(() => drawings, [drawings]);

  function vote(drawing: Drawing) {
    setMessage(null);

    if (voted || hasLocalVote()) {
      setVotedThisSession(true);
      setMessage({ status: "already_voted", message: ALREADY_VOTED_MESSAGE });
      return;
    }

    setPendingId(drawing.id);
    startTransition(async () => {
      const identity = await getVoteIdentity();
      const result = await submitVote(drawing.id, identity);

      if (result.status === "success") {
        markLocalVote(drawing.id);
        setVotedThisSession(true);
        setMessage({ status: "success", message: SUCCESS_MESSAGE });
      } else {
        if (result.status === "already_voted") {
          markLocalVote(drawing.id);
          setVotedThisSession(true);
        }

        setMessage(result);
      }

      setPendingId(null);
    });
  }

  if (drawings.length === 0) {
    return (
      <div className="flex min-h-[52vh] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white/60 px-6 text-center">
        <div>
          <p className="text-lg font-medium text-neutral-950">Одоогоор зураг нэмэгдээгүй байна.</p>
          <p className="mt-2 text-sm text-neutral-500">Админ хэсгээс бүтээл нэмсний дараа энд харагдана.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {message ? (
        <div
          role="status"
          className={clsx(
            "sticky top-4 z-20 mx-auto max-w-xl rounded-full px-5 py-3 text-center text-sm font-medium shadow-soft",
            message.status === "success"
              ? "bg-neutral-950 text-white"
              : message.status === "already_voted"
                ? "bg-white text-neutral-950 ring-1 ring-neutral-200"
                : "bg-red-50 text-red-700 ring-1 ring-red-100"
          )}
        >
          {message.message}
        </div>
      ) : null}

      <section className="columns-1 gap-5 sm:columns-2 xl:columns-3">
        {groupedDrawings.map((drawing) => (
          <article
            key={drawing.id}
            className="mb-5 break-inside-avoid rounded-lg bg-white p-3 shadow-sm ring-1 ring-neutral-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-soft"
          >
            <button
              type="button"
              onClick={() => setSelected(drawing)}
              className="group block w-full overflow-hidden rounded-md bg-neutral-100 text-left"
              aria-label={`${drawing.title} томоор харах`}
            >
              <img
                src={drawing.image_url}
                alt={drawing.title}
                className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                loading="lazy"
              />
            </button>

            <div className="flex items-start justify-between gap-4 px-1 pb-1 pt-4">
              <div className="min-w-0">
                <p className="text-sm text-neutral-500">{drawing.child_name || "Оролцогч"}</p>
                <h2 className="mt-1 text-lg font-semibold leading-snug text-neutral-950">
                  {drawing.title}
                </h2>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">
                  Насны ангилал {drawing.age_category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => vote(drawing)}
                disabled={pendingId === drawing.id || isPending}
                className="shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
              >
                {pendingId === drawing.id ? "..." : voted ? "Санал өгсөн" : "Санал өгөх"}
              </button>
            </div>
          </article>
        ))}
      </section>

      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/92 p-3 sm:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="modal-panel flex max-h-full w-full max-w-6xl flex-col gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 text-white">
              <div className="min-w-0">
                <p className="text-sm text-white/65">{selected.child_name || "Оролцогч"}</p>
                <h2 className="truncate text-xl font-semibold sm:text-2xl">{selected.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl leading-none transition hover:bg-white/20"
                aria-label="Хаах"
              >
                ×
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-white/5">
              <img
                src={selected.image_url}
                alt={selected.title}
                className="max-h-[72vh] w-auto rounded-md object-contain"
              />
            </div>

            <div className="flex flex-col gap-3 rounded-lg bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-neutral-600">
                Насны ангилал <span className="text-neutral-950">{selected.age_category}</span>
              </p>
              <button
                type="button"
                onClick={() => vote(selected)}
                disabled={pendingId === selected.id || isPending}
                className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
              >
                {pendingId === selected.id ? "Түр хүлээнэ үү" : voted ? "Санал өгсөн" : "Санал өгөх"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

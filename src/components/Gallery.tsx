"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import clsx from "clsx";
import { submitVote } from "@/app/actions/votes";
import { getVoteIdentity } from "@/lib/client-device";
import { AGE_CATEGORIES, type AgeCategory, type Drawing, type EmployeeAccess, type VoteResult } from "@/types";

const SUCCESS_MESSAGE = "Таны like бүртгэгдлээ.";
const ALREADY_LIKED_MESSAGE = "Та энэ зурагт аль хэдийн like дарсан байна.";
const IMAGE_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAxNiAyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB4Mj0iMSIgeTE9IjAiIHkyPSIxIj48c3RvcCBzdG9wLWNvbG9yPSIjZjVmNWY0Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZTdlNWUyIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjE2IiBoZWlnaHQ9IjIwIi8+PC9zdmc+";

type GalleryProps = {
  drawings: Drawing[];
  employee: EmployeeAccess;
};

type DrawingImageProps = {
  drawing: Drawing;
  variant: "thumbnail" | "lightbox";
};

function DrawingImage({ drawing, variant }: DrawingImageProps) {
  const [loaded, setLoaded] = useState(false);
  const isLightbox = variant === "lightbox";

  return (
    <div
      className={clsx(
        "relative overflow-hidden bg-neutral-100",
        isLightbox
          ? "h-[80vh] max-h-[80vh] w-[90vw] max-w-6xl rounded-md"
          : "aspect-video w-full rounded-lg"
      )}
    >
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-100" />
      ) : null}
      <Image
        src={drawing.image_url}
        alt={drawing.title}
        fill
        sizes={
          isLightbox
            ? "100vw"
            : "(min-width: 1280px) 13vw, (min-width: 640px) 20vw, 40vw"
        }
        quality={isLightbox ? 90 : 68}
        placeholder="blur"
        blurDataURL={IMAGE_BLUR_DATA_URL}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={clsx(
          "transition duration-700",
          isLightbox ? "object-contain" : "object-cover",
          loaded ? "opacity-100" : "opacity-0",
          !isLightbox && "group-hover:scale-[1.018]"
        )}
      />
    </div>
  );
}

export function Gallery({ drawings, employee }: GalleryProps) {
  const [voteCountOverrides, setVoteCountOverrides] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<VoteResult | null>(null);
  const [sessionLikes, setSessionLikes] = useState<string[]>([]);
  const [ageFilter, setAgeFilter] = useState<AgeCategory | "all">("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [isPending, startTransition] = useTransition();

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
  const selectedIndex = selectedId
    ? groupedDrawings.findIndex((drawing) => drawing.id === selectedId)
    : -1;
  const selectedDrawing = selectedIndex >= 0 ? groupedDrawings[selectedIndex] : null;

  const closeLightbox = useCallback(() => {
    setSelectedId(null);
  }, []);

  const showPrevious = useCallback(() => {
    setSelectedId((current) => {
      const currentIndex = current
        ? groupedDrawings.findIndex((drawing) => drawing.id === current)
        : -1;

      if (currentIndex < 0 || groupedDrawings.length === 0) {
        return current;
      }

      const previousIndex = currentIndex === 0 ? groupedDrawings.length - 1 : currentIndex - 1;
      return groupedDrawings[previousIndex]?.id ?? current;
    });
  }, [groupedDrawings]);

  const showNext = useCallback(() => {
    setSelectedId((current) => {
      const currentIndex = current
        ? groupedDrawings.findIndex((drawing) => drawing.id === current)
        : -1;

      if (currentIndex < 0 || groupedDrawings.length === 0) {
        return current;
      }

      const nextIndex = currentIndex === groupedDrawings.length - 1 ? 0 : currentIndex + 1;
      return groupedDrawings[nextIndex]?.id ?? current;
    });
  }, [groupedDrawings]);

  useEffect(() => {
    if (selectedDrawing === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevious();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNext();
        return;
      }

      if (event.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusable.length === 0) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    modalRef.current?.focus();

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeLightbox, selectedDrawing, showNext, showPrevious]);

  function hasLiked(drawingId: string) {
    return employee.likedDrawingIds.includes(drawingId) || sessionLikes.includes(drawingId);
  }

  function markLiked(drawingId: string) {
    setSessionLikes((current) => (current.includes(drawingId) ? current : [...current, drawingId]));
  }

  function updateVoteCount(drawingId: string, voteCount?: number) {
    setVoteCountOverrides((current) => {
      const drawing = groupedDrawings.find((item) => item.id === drawingId);
      const optimisticCount = (drawing?.vote_count ?? 0) + 1;
      return {
        ...current,
        [drawingId]: Math.max(voteCount ?? optimisticCount, optimisticCount)
      };
    });
  }

  function vote(drawing: Drawing) {
    setMessage(null);

    if (hasLiked(drawing.id)) {
      setMessage({
        status: "already_liked",
        message: ALREADY_LIKED_MESSAGE,
        drawingId: drawing.id
      });
      return;
    }

    setPendingId(drawing.id);
    startTransition(async () => {
      const identity = await getVoteIdentity();
      const result = await submitVote(drawing.id, identity);

      if (result.status === "success") {
        markLiked(drawing.id);
        updateVoteCount(drawing.id, result.voteCount);
        setMessage({ status: "success", message: SUCCESS_MESSAGE });
      } else {
        if (result.status === "already_liked") {
          markLiked(result.drawingId ?? drawing.id);
        }

        setMessage(result);
      }

      setPendingId(null);
    });
  }

  const categoryVoteNotice = (
      <div className="mb-7 rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm leading-6 text-neutral-600">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>Таалагдсан зургууддаа like дараарай.</p>
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
              : message.status === "already_liked"
                ? "bg-white text-neutral-950 ring-1 ring-neutral-200"
                : "bg-red-50 text-red-700 ring-1 ring-red-100"
          )}
        >
          {message.message}
        </div>
      ) : null}

      <section className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {groupedDrawings.map((drawing, index) => {
          const liked = hasLiked(drawing.id);
          return (
          <article
            key={drawing.id}
            className="home-card-reveal group"
            style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
          >
            <button
              type="button"
              onClick={() => setSelectedId(drawing.id)}
              className="block w-full overflow-hidden rounded-lg bg-neutral-100 text-left ring-1 ring-neutral-200/80 transition duration-500 group-hover:-translate-y-1 group-hover:ring-neutral-300"
              aria-label={`${drawing.title} томоор харах`}
            >
              <DrawingImage drawing={drawing} variant="thumbnail" />
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
                  {drawing.vote_count} таалагдсан
                </p>
              </div>
              <button
                type="button"
                onClick={() => vote(drawing)}
                disabled={liked || pendingId === drawing.id || isPending}
                aria-label={liked ? "Like дарсан" : "Like дарах"}
                className={clsx(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-full border text-xl leading-none transition disabled:cursor-not-allowed",
                  liked
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-950 hover:text-neutral-950",
                  pendingId === drawing.id && "opacity-60"
                )}
              >
                {pendingId === drawing.id ? "…" : liked ? "♥" : "♡"}
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
          onClick={closeLightbox}
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            className="modal-panel flex max-h-full w-full max-w-7xl flex-col gap-5 outline-none"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (touchStartX.current === null) {
                return;
              }

              const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX.current;
              const delta = touchEndX - touchStartX.current;
              touchStartX.current = null;

              if (Math.abs(delta) < 50) {
                return;
              }

              if (delta > 0) {
                showPrevious();
              } else {
                showNext();
              }
            }}
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
                onClick={closeLightbox}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-xl leading-none transition hover:bg-white/15"
                aria-label="Хаах"
              >
                ×
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-white/[0.03]">
              {groupedDrawings.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPrevious}
                    className="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-neutral-950/45 text-2xl leading-none text-white backdrop-blur transition hover:bg-neutral-950/70 sm:left-4"
                    aria-label="Өмнөх зураг"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={showNext}
                    className="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-neutral-950/45 text-2xl leading-none text-white backdrop-blur transition hover:bg-neutral-950/70 sm:right-4"
                    aria-label="Дараагийн зураг"
                  >
                    ›
                  </button>
                </>
              ) : null}
              <DrawingImage drawing={selectedDrawing} variant="lightbox" />
            </div>

            {groupedDrawings.length > 1 ? (
              <div className="hidden gap-2 overflow-x-auto pb-1 sm:flex">
                {groupedDrawings.map((drawing) => (
                  <button
                    key={drawing.id}
                    type="button"
                    onClick={() => setSelectedId(drawing.id)}
                    className={clsx(
                      "relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-white/10 ring-1 transition",
                      selectedDrawing.id === drawing.id
                        ? "ring-white"
                        : "ring-white/10 hover:ring-white/45"
                    )}
                    aria-label={`${drawing.title} сонгох`}
                  >
                    <Image
                      src={drawing.image_url}
                      alt={drawing.title}
                      fill
                      sizes="96px"
                      quality={42}
                      placeholder="blur"
                      blurDataURL={IMAGE_BLUR_DATA_URL}
                      loading="lazy"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">
                  Насны ангилал <span className="text-neutral-950">{selectedDrawing.age_category}</span>
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-950">
                  {selectedDrawing.vote_count} таалагдсан
                </p>
              </div>
              <button
                type="button"
                onClick={() => vote(selectedDrawing)}
                disabled={hasLiked(selectedDrawing.id) || pendingId === selectedDrawing.id || isPending}
                aria-label={hasLiked(selectedDrawing.id) ? "Like дарсан" : "Like дарах"}
                className={clsx(
                  "grid h-12 w-12 place-items-center rounded-full border text-2xl leading-none transition disabled:cursor-not-allowed",
                  hasLiked(selectedDrawing.id)
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-950 hover:text-neutral-950",
                  pendingId === selectedDrawing.id && "opacity-60"
                )}
              >
                {pendingId === selectedDrawing.id ? "…" : hasLiked(selectedDrawing.id) ? "♥" : "♡"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

import { Gallery } from "@/components/Gallery";
import { getDrawings } from "@/app/actions/public";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const drawings = await getDrawings();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-7">
        <header className="flex flex-col gap-5 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
              Children&apos;s Day Drawing Contest
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-neutral-950 sm:text-5xl">
              Хүүхдийн баярын гар зургийн санал хураалт
            </h1>
          </div>
          <a
            href="/admin/login"
            className="text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
          >
            Админ хэсэг
          </a>
        </header>

        <Gallery drawings={drawings} />
      </section>
    </main>
  );
}

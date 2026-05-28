import { Gallery } from "@/components/Gallery";
import { getDrawings } from "@/app/actions/public";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const drawings = await getDrawings();

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-10">
        <header className="grid gap-8 border-b border-neutral-200 pb-8 pt-2 sm:grid-cols-[1fr_auto] sm:items-end lg:pb-12">
          <div className="max-w-5xl">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              Children&apos;s Day Drawing Contest
            </p>
            <h1 className="text-4xl font-semibold leading-[0.98] text-neutral-950 sm:text-6xl lg:text-7xl">
              Хүүхдийн баярын гар зургийн санал хураалт
            </h1>
          </div>
          <a
            href="/admin/login"
            className="w-fit rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-500 transition hover:border-neutral-950 hover:text-neutral-950"
          >
            Админ хэсэг
          </a>
        </header>

        <Gallery drawings={drawings} />
      </section>
    </main>
  );
}

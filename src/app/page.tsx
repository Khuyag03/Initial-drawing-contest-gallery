import { getDrawings } from "@/app/actions/public";
import { getCurrentEmployeeAccess } from "@/app/actions/employee";
import { PublicVotingApp } from "@/components/PublicVotingApp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const drawings = await getDrawings();
  const employee = await getCurrentEmployeeAccess();

  if (!employee) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <PublicVotingApp drawings={drawings} initialEmployee={null} />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="relative mx-3 mt-3 min-h-[72svh] overflow-hidden rounded-lg bg-neutral-200 sm:mx-4 lg:mx-5">
        <img
          src="/hero-drawing-contest.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-white/68" />
        <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-500">
            Хүүхдийн баярын гар зургийн санал хураалт
          </p>
          <a
            href="/admin/login"
            className="rounded-full border border-neutral-950/10 bg-white/70 px-4 py-2 text-sm font-medium text-neutral-600 backdrop-blur transition hover:border-neutral-950 hover:text-neutral-950"
          >
            Админ хэсэг
          </a>
        </header>

        <div className="relative z-10 flex min-h-[calc(72svh-84px)] items-end px-5 pb-8 sm:px-8 sm:pb-10 lg:px-12 lg:pb-14">
          <div className="max-w-5xl">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-500">
              Children&apos;s Day Drawing Contest
            </p>
            <h1 className="text-4xl font-semibold leading-[0.96] text-neutral-950 sm:text-6xl lg:text-7xl">
              “МИНИЙ ЕРТӨНЦ” хүүхдийн гар зургийн уралдаан
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-neutral-700 sm:text-lg sm:leading-8">
              Таалагдсан зургууддаа like дарж дэмжээрэй.
            </p>
            <div className="mt-8 grid max-w-4xl gap-3 border-t border-neutral-950/15 pt-5 sm:grid-cols-[120px_1fr]">
              <p className="text-sm font-semibold text-neutral-950">Зорилго</p>
              <p className="text-base leading-7 text-neutral-700 sm:text-lg sm:leading-8">
                Хүүхдийн бүтээлч сэтгэлгээг дэмжих, өөрийн ертөнцийг зургаар дамжуулан
                илэрхийлэх, аз жаргалтай дурсамж, сайхан мөчүүдээ хуваалцахад оршино.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1500px] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
              Gallery
            </p>
            <h2 className="text-2xl font-medium text-neutral-950 sm:text-3xl">Бүтээлүүд</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-neutral-500">
            Like-ийн тоо бүтээл бүр дээр харагдах бөгөөд нэг SAP код нэг зураг дээр нэг удаа like дарна.
          </p>
        </header>
      </section>

      <PublicVotingApp drawings={drawings} initialEmployee={employee} />
    </main>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10">
      <section className="space-y-2">
        <div className="h-10 w-48 animate-pulse rounded-2xl bg-slate-200/80" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded-2xl bg-slate-100" />
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="h-[138px] animate-pulse rounded-2xl border border-slate-100 bg-white" />
        <div className="h-[138px] animate-pulse rounded-2xl border border-slate-100 bg-white" />
        <div className="h-[138px] animate-pulse rounded-2xl border border-slate-100 bg-white" />
      </section>

      <section className="space-y-4">
        <div className="h-7 w-36 animate-pulse rounded-2xl bg-slate-200/80" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="h-[168px] animate-pulse rounded-2xl border border-slate-100 bg-white" />
          <div className="h-[168px] animate-pulse rounded-2xl border border-slate-100 bg-white" />
          <div className="h-[168px] animate-pulse rounded-2xl border border-slate-100 bg-white" />
          <div className="h-[168px] animate-pulse rounded-2xl border border-slate-100 bg-white" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="h-[330px] animate-pulse rounded-2xl border border-slate-100 bg-white" />
        <div className="h-[330px] animate-pulse rounded-2xl border border-slate-100 bg-white" />
      </section>
    </div>
  );
}

export function PageTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-[2.5rem] font-bold tracking-tight text-slate-950">{title}</h2>
      <p className="max-w-3xl text-lg leading-7 text-slate-500">{description}</p>
    </section>
  );
}

export function PageTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600">{description}</p>
    </section>
  );
}

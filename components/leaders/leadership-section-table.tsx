import type { ReactNode } from "react";

type TableColumn = {
  label: string;
  className?: string;
};

type LeadershipSectionTableProps<T> = {
  title: string;
  description: string;
  accentClassName?: string;
  columns: TableColumn[];
  items: T[];
  emptyMessage: string;
  footer?: ReactNode;
  tableClassName?: string;
  renderRow: (item: T, index: number) => ReactNode;
};

export function LeadershipSectionTable<T>({
  title,
  description,
  accentClassName = "bg-slate-50",
  columns,
  items,
  emptyMessage,
  footer,
  tableClassName = "min-w-full text-sm",
  renderRow,
}: LeadershipSectionTableProps<T>) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={["border-b border-slate-200 px-5 py-4", accentClassName].join(" ")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
            <p className="text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {items.length}건
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={tableClassName}>
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.label} className={["px-4 py-3", column.className].join(" ")}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.length > 0 ? (
              items.map((item, index) => renderRow(item, index))
            ) : (
              <tr>
                <td className="px-4 py-5 text-sm text-slate-500" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {footer ? <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-4">{footer}</div> : null}
    </section>
  );
}

"use client";

type PrintTriggerProps = {
  label?: string;
  className?: string;
};

export function PrintTrigger({ label = "인쇄", className }: PrintTriggerProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className ?? "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"}
    >
      {label}
    </button>
  );
}


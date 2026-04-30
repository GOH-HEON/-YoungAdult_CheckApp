export function isDateInputValue(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function normalizeDateRange({
  fromCandidate,
  toCandidate,
  defaultFrom,
  defaultTo,
}: {
  fromCandidate?: string | null;
  toCandidate?: string | null;
  defaultFrom: string;
  defaultTo: string;
}) {
  const from = isDateInputValue(fromCandidate) ? fromCandidate : defaultFrom;
  const to = isDateInputValue(toCandidate) ? toCandidate : defaultTo;

  if (to < from) {
    return {
      from,
      to: from,
      wasReversed: true,
    };
  }

  return {
    from,
    to,
    wasReversed: false,
  };
}

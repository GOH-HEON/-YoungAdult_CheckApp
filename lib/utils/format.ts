const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDate(date: string | Date | null | undefined) {
  if (!date) {
    return "-";
  }

  const normalized = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(normalized.getTime())) {
    return "-";
  }

  return dateFormatter.format(normalized);
}

export function formatDateInputValue(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone) {
    return "-";
  }

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) {
    return phone;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 4)}***-${digits.slice(7)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 4)}**-${digits.slice(-4)}`;
}

export function toInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function toBoolean(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return false;
  }

  return value === "true" || value === "on" || value === "1";
}

export function cleanText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function sanitizeRedirectPath(path: string | null | undefined, fallback: string) {
  if (!path) {
    return fallback;
  }

  if (!path.startsWith("/")) {
    return fallback;
  }

  if (path.startsWith("//")) {
    return fallback;
  }

  return path;
}

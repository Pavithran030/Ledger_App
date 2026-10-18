import { format, parseISO, isValid, isBefore, startOfDay } from "date-fns";

/**
 * Returns the current date and time as an ISO string.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Returns today's date formatted as YYYY-MM-DD.
 */
export function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Formats an ISO string or Date into a human-readable format.
 * Default: "dd MMM yyyy" (e.g. 17 Oct 2026)
 */
export function formatDate(date: string | Date | null | undefined, formatStr = "dd MMM yyyy"): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    if (!isValid(d)) return "-";
    return format(d, formatStr);
  } catch {
    return "-";
  }
}

/**
 * Formats an ISO date with time: "dd MMM yyyy, hh:mm a"
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, "dd MMM yyyy, hh:mm a");
}

/**
 * Checks if a given date string is past due (strictly before today).
 */
export function isOverdue(dueDateString: string | null | undefined): boolean {
  if (!dueDateString) return false;
  try {
    const dueDate = parseISO(dueDateString);
    if (!isValid(dueDate)) return false;
    return isBefore(dueDate, startOfDay(new Date()));
  } catch {
    return false;
  }
}

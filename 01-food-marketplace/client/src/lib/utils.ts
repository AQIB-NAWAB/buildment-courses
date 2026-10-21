import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number, currency = "inr"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2
  }).format(cents / 100);
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Order received";
    case "packed":
      return "Packed";
    case "dispatched":
      return "Dispatched";
    case "cancelled":
      return "Cancelled";
    case "paid":
      return "Paid";
    case "failed":
      return "Payment failed";
    default:
      return "Status unavailable";
  }
}

export function nextStatus(status: string): "packed" | "dispatched" | null {
  if (status === "pending") return "packed";
  if (status === "packed") return "dispatched";
  return null;
}

export function unitLabel(unit: string): string {
  return unit === "each" ? "each" : `per ${unit}`;
}

export function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** true на локалке (dev/preview) — для дев-подсказок. В проде (Vercel) всегда false. */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

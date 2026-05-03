import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind CSS class names, resolving conflicts via tailwind-merge.
 * @param inputs - Any number of clsx-compatible class values.
 * @returns A single merged class string with conflicting Tailwind classes resolved.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

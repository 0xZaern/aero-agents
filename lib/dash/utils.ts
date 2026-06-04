import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a cost number to a human-readable string, e.g. "$0.0034" */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/** Group conversations by relative date bucket */
export function groupByDate<T extends { createdAt: string }>(
  items: T[]
): { label: string; items: T[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, T[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  };

  for (const item of items) {
    const date = new Date(item.createdAt);
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (day >= today) {
      groups['Today'].push(item);
    } else if (day >= yesterday) {
      groups['Yesterday'].push(item);
    } else if (day >= weekAgo) {
      groups['This Week'].push(item);
    } else {
      groups['Older'].push(item);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

/** Truncate a string to a max length, appending ellipsis */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

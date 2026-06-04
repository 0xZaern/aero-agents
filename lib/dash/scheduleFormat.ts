// Shared formatters for scheduled-task time labels.

export function formatRelativePast(iso: string | null | undefined): string {
  if (!iso) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export function formatNextRun(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return 'overdue';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `in ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `in ${diffH}h ${diffMin % 60}m`;
  const msPerDay = 86_400_000;
  if (diffMs < 2 * msPerDay) {
    const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `tomorrow ${timeStr}`;
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

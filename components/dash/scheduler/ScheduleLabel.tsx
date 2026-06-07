'use client';

import type { ScheduleConfig } from '@/lib/dash/scheduler';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Renders a compact one-line description of a ScheduleConfig. */
export function ScheduleLabel({ schedule }: { schedule: ScheduleConfig }) {
  if (schedule.mode === 'time') {
    if (schedule.frequency === 'hourly') return <>every hour</>;
    const t = schedule.time_of_day ?? '';
    if (schedule.frequency === 'daily') return <>daily {t}</>;
    if (schedule.frequency === 'weekly') {
      const dow = schedule.day_of_week;
      let dayLabel = '';
      if (Array.isArray(dow)) {
        dayLabel = dow.map((d) => DAYS[d] ?? '').join('/');
      } else if (typeof dow === 'number') {
        dayLabel = DAYS[dow] ?? '';
      }
      return <>weekly {dayLabel} {t}</>;
    }
  }
  if (schedule.mode === 'watch') {
    const mins = schedule.poll_interval_minutes;
    const label = mins >= 60 ? `${mins / 60}h` : `${mins}min`;
    const src = schedule.source_type;
    return <>watch:{src} / {label}</>;
  }
  return <>custom</>;
}

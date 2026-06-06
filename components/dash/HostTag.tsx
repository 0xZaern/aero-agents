'use client';

import { useState } from 'react';

interface Props {
  host: string;
  model?: string;
  inTok?: number;
  outTok?: number;
  time?: string; // ISO
}

// Parse an ISO timestamp into the viewer's LOCAL time. Backend timestamps are
// UTC but may arrive without a timezone designator (naive) - treat those as UTC.
function toLocal(iso?: string): string | null {
  if (!iso) return null;
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasTz ? iso : iso + 'Z');
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function HostTag({ host, model, inTok, outTok, time }: Props) {
  const [show, setShow] = useState(false);

  const localTime = toLocal(time);
  const tokens = inTok != null || outTok != null ? `in ${inTok ?? 0} · out ${outTok ?? 0}` : null;

  return (
    <span
      style={{ position: 'relative' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="ps1" style={{ cursor: 'help' }}>{host}@aero</span>
      {show && (
        <span className="term-tip">
          <span className="row"><span className="k">model</span><span className="v">{model ?? '-'}</span></span>
          <span className="row"><span className="k">tokens</span><span className="v">{tokens ?? '-'}</span></span>
          <span className="row"><span className="k">time</span><span className="v">{localTime ?? '-'}</span></span>
        </span>
      )}
    </span>
  );
}

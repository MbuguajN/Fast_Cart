'use client';

import { useEffect, useState, useCallback } from 'react';

const FRESH_LIMIT_MS = 10 * 60 * 1000;

function Pill({ ok, children }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {children}
    </span>
  );
}

function Stat({ value, label, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}

export default function HealthPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/health', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Could not load health data');
      const next = await res.json();
      setError('');
      setData(next);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-500">Loading…</p>;

  const cacheFresh = data.sync.cacheAgeMs !== null && data.sync.cacheAgeMs < FRESH_LIMIT_MS;
  const cacheAgeLabel =
    data.sync.cacheAgeMs === null ? '—' : `${Math.round(data.sync.cacheAgeMs / 60000)}m`;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-extrabold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          System Health
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          Integration failures are usually silent. This is where they show up.
        </p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat value={data.catalogue.sellable} label="Sellable products" />
        <Stat value={data.catalogue.outOfStock} label="Out of stock" />
        <Stat value={cacheAgeLabel} label="Cache age">
          <Pill ok={cacheFresh}>{cacheFresh ? 'Fresh' : 'Stale'}</Pill>
        </Stat>
        <Stat value={`${Math.round(data.summary.failureRate * 100)}%`} label="Failure rate" />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <h2 className="text-sm font-bold">Configuration</h2>
        {Object.entries(data.configured).map(([key, value]) => (
          <div key={key} className="flex justify-between items-center text-xs">
            <span className="text-gray-700 font-mono">{key}</span>
            {typeof value === 'boolean' ? (
              <Pill ok={value}>{value ? 'Set' : 'Missing'}</Pill>
            ) : (
              <span className="font-mono text-[11px] text-gray-600">{value}</span>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <h2 className="text-sm font-bold">By integration</h2>
        {Object.keys(data.summary.byKind).length === 0 ? (
          <p className="text-xs text-gray-500">No activity recorded since the last restart.</p>
        ) : (
          Object.entries(data.summary.byKind).map(([kind, stats]) => (
            <div key={kind} className="flex justify-between items-center text-xs">
              <span className="font-mono">{kind}</span>
              <span className="text-gray-600 tabular-nums">
                {stats.total} calls · {stats.failed} failed · {stats.avgMs}ms avg
              </span>
            </div>
          ))
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <h2 className="text-sm font-bold">Recent failures</h2>
        {data.recentFailures.length === 0 ? (
          <p className="text-xs text-gray-500">None recorded.</p>
        ) : (
          data.recentFailures.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="text-xs border-l-2 border-red-400 pl-2 py-0.5">
              <div className="font-mono text-[11px] text-gray-500">
                {new Date(e.ts).toLocaleString()} · {e.kind}
              </div>
              <div className="text-gray-800 break-words">{e.detail}</div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

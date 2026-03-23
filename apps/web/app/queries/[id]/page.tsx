import Link from "next/link";

import { fetchQueryById } from "../../lib/api";

export default async function QueryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const query = await fetchQueryById(resolved.id);

  return (
    <main className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Query Detail</h1>
        <Link
          href={`/replay?query=${encodeURIComponent(JSON.stringify(query.queryPayload))}`}
          className="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-900"
        >
          Replay Query
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded border border-zinc-800 p-3">
          <p className="text-zinc-400">Query Hash</p>
          <p className="font-mono">{query.queryHash}</p>
        </div>
        <div className="rounded border border-zinc-800 p-3">
          <p className="text-zinc-400">Latency</p>
          <p>{query.latencyMs}ms</p>
        </div>
        <div className="rounded border border-zinc-800 p-3">
          <p className="text-zinc-400">Response Size</p>
          <p>{query.responseSize}</p>
        </div>
        <div className="rounded border border-zinc-800 p-3">
          <p className="text-zinc-400">Risk / Cost</p>
          <p>
            {query.risk} / ${query.cost}
          </p>
        </div>
      </div>

      <section className="rounded border border-zinc-800 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Pattern Flags</h2>
        <div className="flex flex-wrap gap-2">
          {query.flags.length === 0 ? (
            <span className="text-xs text-zinc-500">No flags</span>
          ) : (
            query.flags.map((flag) => (
              <span key={flag} className="rounded bg-amber-500/20 px-2 py-1 text-[11px] text-amber-200">
                {flag}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="rounded border border-zinc-800 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Query Payload</h2>
        <pre className="overflow-auto rounded bg-zinc-900 p-3 text-xs">
          {JSON.stringify(query.queryPayload, null, 2)}
        </pre>
      </section>
    </main>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { replayQuery } from "../lib/api";

function ReplayPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("query");
  const [queryJson, setQueryJson] = useState(initialQuery ?? '{"prompt":"List active users"}');
  const [iterations, setIterations] = useState(10);
  const [result, setResult] = useState<null | {
    iterations: number;
    avgLatencyMs: number;
    avgResponseSize: number;
    risk: number;
    cost: number;
    flags: string[];
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onReplay() {
    setLoading(true);
    setError(null);
    try {
      const parsed = JSON.parse(queryJson);
      const replayResult = await replayQuery({ query: parsed, iterations });
      setResult(replayResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to replay");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-4 text-sm">
      <h1 className="text-lg font-semibold">Replay Runner</h1>

      <div className="space-y-3 rounded border border-zinc-800 p-4">
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Query JSON</span>
          <textarea
            className="h-40 w-full rounded border border-zinc-700 bg-zinc-900 p-2 font-mono text-xs outline-none ring-sky-400 focus:ring-1"
            value={queryJson}
            onChange={(e) => setQueryJson(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Iterations (max 50)</span>
          <input
            type="number"
            min={1}
            max={50}
            className="w-40 rounded border border-zinc-700 bg-zinc-900 p-2 text-xs outline-none ring-sky-400 focus:ring-1"
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={onReplay}
          disabled={loading}
          className="rounded border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-900 disabled:opacity-50"
        >
          {loading ? "Running..." : "Run Replay"}
        </button>
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {result ? (
        <div className="space-y-1 rounded border border-zinc-800 p-4 text-xs">
          <p>iterations: {result.iterations}</p>
          <p>avg_latency_ms: {result.avgLatencyMs}</p>
          <p>avg_response_size: {result.avgResponseSize}</p>
          <p>risk: {result.risk}</p>
          <p>cost: ${result.cost}</p>
          <p>flags: {result.flags.join(", ") || "none"}</p>
        </div>
      ) : null}
    </main>
  );
}

export default function ReplayPage() {
  return (
    <Suspense fallback={<main className="text-sm">Loading replay tools...</main>}>
      <ReplayPageContent />
    </Suspense>
  );
}

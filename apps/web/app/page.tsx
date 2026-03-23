import Link from "next/link";

import { fetchQueries } from "./lib/api";

export default async function DashboardPage() {
  const data = await fetchQueries(1, 50);

  return (
    <main className="space-y-4">
      <h1 className="text-lg font-semibold">Query Dashboard</h1>
      <div className="overflow-hidden rounded border border-zinc-800">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-zinc-900 text-zinc-300">
            <tr>
              <th className="px-3 py-2">query_hash</th>
              <th className="px-3 py-2">response_size</th>
              <th className="px-3 py-2">latency</th>
              <th className="px-3 py-2">risk</th>
              <th className="px-3 py-2">cost</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                <td className="truncate px-3 py-2 font-mono text-[11px]">
                  <Link href={`/queries/${item.id}`} className="hover:text-sky-300">
                    {item.queryHash}
                  </Link>
                </td>
                <td className="px-3 py-2">{item.responseSize}</td>
                <td className="px-3 py-2">{item.latencyMs}ms</td>
                <td className="px-3 py-2">{item.risk}</td>
                <td className="px-3 py-2">${item.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">Showing {data.items.length} of {data.total} queries.</p>
    </main>
  );
}

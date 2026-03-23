export interface QueryLog {
  id: string;
  queryHash: string;
  queryPayload: unknown;
  responseSize: number;
  latencyMs: number;
  risk: number;
  cost: number;
  flags: string[];
  createdAt: string;
}

interface QueryListResponse {
  items: QueryLog[];
  page: number;
  pageSize: number;
  total: number;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchQueries(page = 1, pageSize = 20): Promise<QueryListResponse> {
  return apiFetch<QueryListResponse>(`/queries?page=${page}&pageSize=${pageSize}`);
}

export async function fetchQueryById(id: string): Promise<QueryLog> {
  return apiFetch<QueryLog>(`/queries/${id}`);
}

export async function replayQuery(input: { query: unknown; iterations: number }): Promise<{
  iterations: number;
  avgLatencyMs: number;
  avgResponseSize: number;
  risk: number;
  cost: number;
  flags: string[];
}> {
  return apiFetch("/replay", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

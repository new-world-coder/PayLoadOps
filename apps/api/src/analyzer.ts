interface AnalysisOutput {
  queryHash: string;
  risk: number;
  cost: number;
  flags: string[];
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const inner = entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",");
  return `{${inner}}`;
}

export function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `q_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function analyzeQuery(queryPayload: unknown, responseSize: number): AnalysisOutput {
  const serialized = stableStringify(queryPayload);
  const queryHash = hashString(serialized);
  const tokenEstimate = Math.max(1, Math.ceil(serialized.length / 4));
  const risk = Number(Math.min(1, (serialized.length % 700) / 700 + responseSize / 10000).toFixed(3));
  const cost = Number((tokenEstimate * 0.00001 + responseSize * 0.000001).toFixed(6));

  const flags: string[] = [];
  const lowered = serialized.toLowerCase();
  if (lowered.includes("drop") || lowered.includes("delete") || lowered.includes("truncate")) {
    flags.push("destructive_intent");
  }
  if (lowered.includes("password") || lowered.includes("secret") || lowered.includes("token")) {
    flags.push("sensitive_data_pattern");
  }
  if (serialized.length > 600) {
    flags.push("large_payload");
  }
  if (responseSize > 2500) {
    flags.push("large_response");
  }

  return {
    queryHash,
    risk,
    cost,
    flags
  };
}

export function deterministicReplayMetrics(queryPayload: unknown, iterations: number): {
  avgLatencyMs: number;
  avgResponseSize: number;
} {
  const serialized = stableStringify(queryPayload);
  const baseHashNumber = Number.parseInt(hashString(serialized).slice(2), 16);
  let latencyTotal = 0;
  let responseTotal = 0;

  for (let i = 0; i < iterations; i += 1) {
    const latency = 20 + ((baseHashNumber + i * 31) % 180);
    const responseSize = 200 + ((serialized.length * 13 + i * 17) % 2200);
    latencyTotal += latency;
    responseTotal += responseSize;
  }

  return {
    avgLatencyMs: Number((latencyTotal / iterations).toFixed(2)),
    avgResponseSize: Number((responseTotal / iterations).toFixed(2))
  };
}

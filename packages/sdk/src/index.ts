import { Client, type ClientOptions } from "@elastic/elasticsearch";
import { createHash } from "node:crypto";

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<unknown>;

export interface PayloadOpsClientConfig {
  elasticsearch: ClientOptions;
  telemetryEndpoint: string;
  telemetryHeaders?: Record<string, string>;
  fetchImpl?: FetchLike;
}

interface TelemetryPayload {
  operation: string;
  latency_ms: number;
  response_size_bytes: number;
  query_hash: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}

export function computeQueryHash(params: unknown): string {
  const request = (params ?? {}) as Record<string, unknown>;
  const indexPart = request.index ?? "";
  const queryPart = request.body ?? request.path ?? "";
  const normalized = `${String(indexPart)}|${stableStringify(queryPart)}`;
  return createHash("sha256").update(normalized).digest("hex");
}

function getResponseSizeBytes(response: unknown): number {
  if (response === undefined) {
    return 0;
  }
  return Buffer.byteLength(JSON.stringify(response), "utf8");
}

function createTelemetryEmitter(config: PayloadOpsClientConfig) {
  const fetchImpl: FetchLike | undefined =
    config.fetchImpl ??
    (typeof globalThis.fetch === "function"
      ? ((input: string, init?: Record<string, unknown>) =>
          globalThis.fetch(input, init as RequestInit)) as FetchLike
      : undefined);

  return (payload: TelemetryPayload) => {
    if (!fetchImpl) {
      return;
    }

    void fetchImpl(config.telemetryEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...config.telemetryHeaders
      },
      body: JSON.stringify(payload)
    }).catch(() => {
      // Best effort telemetry; failures should never affect Elasticsearch calls.
    });
  };
}

function createProxy<T extends object>(
  target: T,
  emitTelemetry: (payload: TelemetryPayload) => void,
  path: string[] = []
): T {
  return new Proxy(target, {
    get(currentTarget, prop, receiver) {
      const value = Reflect.get(currentTarget, prop, receiver);
      const nextPath = [...path, String(prop)];

      if (typeof value === "function") {
        return (...args: unknown[]) => {
          const started = process.hrtime.bigint();
          const report = (resolved: unknown) => {
            const ended = process.hrtime.bigint();
            const latencyMs = Number(ended - started) / 1_000_000;
            const params = args[0];
            emitTelemetry({
              operation: nextPath.join("."),
              latency_ms: latencyMs,
              response_size_bytes: getResponseSizeBytes(resolved),
              query_hash: computeQueryHash(params)
            });
          };

          const result = value.apply(currentTarget, args);
          if (result && typeof (result as Promise<unknown>).then === "function") {
            return (result as Promise<unknown>).then((resolved) => {
              report(resolved);
              return resolved;
            });
          }

          report(result);
          return result;
        };
      }

      if (value && typeof value === "object") {
        return createProxy(value as Record<string, unknown>, emitTelemetry, nextPath);
      }

      return value;
    }
  });
}

export function createPayloadOpsClient(config: PayloadOpsClientConfig): Client {
  const client = new Client(config.elasticsearch);
  const emitTelemetry = createTelemetryEmitter(config);
  return createProxy(client, emitTelemetry);
}

import { describe, expect, it, vi } from "vitest";
import { computeQueryHash, createPayloadOpsClient } from "../src/index.js";

vi.mock("@elastic/elasticsearch", () => {
  class MockClient {
    async search(params: { index: string; body: unknown }) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        ok: true,
        hits: [{ id: "1" }],
        requestEcho: params
      };
    }
  }

  return { Client: MockClient };
});

describe("createPayloadOpsClient", () => {
  it("reports response size and latency", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const client = createPayloadOpsClient({
      elasticsearch: { node: "http://localhost:9200" },
      telemetryEndpoint: "http://telemetry.local/telemetry",
      fetchImpl
    });

    const response = await client.search({
      index: "events",
      body: { query: { match_all: {} } }
    });

    expect(response).toHaveProperty("ok", true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, payload] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://telemetry.local/telemetry");
    const body = JSON.parse(String(payload.body)) as {
      latency_ms: number;
      response_size_bytes: number;
    };
    expect(body.latency_ms).toBeGreaterThanOrEqual(10);
    expect(body.response_size_bytes).toBe(
      Buffer.byteLength(JSON.stringify(response), "utf8")
    );
  });

  it("computes deterministic query hash", () => {
    const left = computeQueryHash({
      index: "events",
      body: {
        query: { term: { a: 1, b: 2 } },
        size: 10
      }
    });
    const right = computeQueryHash({
      index: "events",
      body: {
        size: 10,
        query: { term: { b: 2, a: 1 } }
      }
    });

    expect(left).toBe(right);
  });
});

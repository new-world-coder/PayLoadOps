import { describe, expect, it } from "vitest";

import {
  analyzePayload,
  computeCost,
  detectQueryPatterns,
  determineRiskLevel
} from "../src/index.js";
import type { TelemetryPayload } from "@payloadops/types";

const createPayload = (overrides: Partial<TelemetryPayload> = {}): TelemetryPayload => ({
  payloadSizeBytes: 100,
  latencyMs: 10,
  query: {
    query: "SELECT id FROM users LIMIT 10",
    resultSize: 10,
    executionTimeMs: 10
  },
  receivedAt: "2026-03-23T00:00:00.000Z",
  ...overrides
});

describe("determineRiskLevel", () => {
  it("returns LOW when payload is below low thresholds", () => {
    const result = determineRiskLevel(
      createPayload({ payloadSizeBytes: 499 * 1024, latencyMs: 299 })
    );
    expect(result).toBe("LOW");
  });

  it("returns MEDIUM when payload is not LOW but below medium thresholds", () => {
    const result = determineRiskLevel(
      createPayload({ payloadSizeBytes: 500 * 1024, latencyMs: 300 })
    );
    expect(result).toBe("MEDIUM");
  });

  it("returns HIGH when size is at medium threshold", () => {
    const result = determineRiskLevel(createPayload({ payloadSizeBytes: 2 * 1024 * 1024 }));
    expect(result).toBe("HIGH");
  });

  it("returns HIGH when latency is at medium threshold", () => {
    const result = determineRiskLevel(createPayload({ latencyMs: 800 }));
    expect(result).toBe("HIGH");
  });

  it("returns MEDIUM when only latency reaches LOW threshold", () => {
    const result = determineRiskLevel(
      createPayload({ payloadSizeBytes: 128, latencyMs: 300 })
    );
    expect(result).toBe("MEDIUM");
  });

  it("returns HIGH when latency exceeds medium threshold", () => {
    const result = determineRiskLevel(
      createPayload({ payloadSizeBytes: 64, latencyMs: 801 })
    );
    expect(result).toBe("HIGH");
  });
});

describe("computeCost", () => {
  it("uses exact size and latency formula", () => {
    const payloadSizeBytes = 1024 * 1024 * 1024;
    const latencyMs = 200;
    const result = computeCost(payloadSizeBytes, latencyMs);
    expect(result).toBe(0.09 + 0.0002);
  });

  it("returns zero cost when size and latency are zero", () => {
    const result = computeCost(0, 0);
    expect(result).toBe(0);
  });
});

describe("detectQueryPatterns", () => {
  it("does not flag large result sets when result size is exactly 1000", () => {
    const result = detectQueryPatterns({
      query: "SELECT * FROM events LIMIT 100",
      resultSize: 1000,
      executionTimeMs: 100
    });
    expect(result.hasLargeResultSet).toBe(false);
  });

  it("flags large result sets when result size is greater than 1000", () => {
    const result = detectQueryPatterns({
      query: "SELECT * FROM events LIMIT 100",
      resultSize: 1001,
      executionTimeMs: 100
    });
    expect(result.hasLargeResultSet).toBe(true);
  });

  it("detects aggregations with common SQL aggregation operators", () => {
    const result = detectQueryPatterns({
      query: "SELECT user_id, COUNT(*) FROM events GROUP BY user_id",
      resultSize: 10,
      executionTimeMs: 50
    });
    expect(result.hasAggregation).toBe(true);
  });

  it("does not mark aggregation for non-aggregate query text", () => {
    const result = detectQueryPatterns({
      query: "SELECT id, email FROM users LIMIT 50",
      resultSize: 50,
      executionTimeMs: 50
    });
    expect(result.hasAggregation).toBe(false);
  });

  it("flags missing pagination when no pagination tokens are present", () => {
    const result = detectQueryPatterns({
      query: "SELECT id FROM users",
      resultSize: 20,
      executionTimeMs: 10
    });
    expect(result.missingPagination).toBe(true);
  });

  it("does not flag missing pagination when offset is present", () => {
    const result = detectQueryPatterns({
      query: "SELECT id FROM users LIMIT 25 OFFSET 25",
      resultSize: 25,
      executionTimeMs: 10
    });
    expect(result.missingPagination).toBe(false);
  });

  it("does not flag missing pagination when query uses FETCH FIRST", () => {
    const result = detectQueryPatterns({
      query: "SELECT id FROM users ORDER BY id FETCH FIRST 20 ROWS ONLY",
      resultSize: 20,
      executionTimeMs: 10
    });
    expect(result.missingPagination).toBe(false);
  });
});

describe("analyzePayload", () => {
  it("combines risk, cost and query pattern outputs deterministically", () => {
    const input = createPayload({
      payloadSizeBytes: 2 * 1024 * 1024 - 1,
      latencyMs: 799,
      query: {
        query: "SELECT id FROM users",
        resultSize: 1500,
        executionTimeMs: 250
      }
    });

    const result = analyzePayload(input);

    expect(result.riskLevel).toBe("MEDIUM");
    expect(result.estimatedCostUsd).toBe(computeCost(input.payloadSizeBytes, input.latencyMs));
    expect(result.queryPatterns).toEqual({
      hasLargeResultSet: true,
      hasAggregation: false,
      missingPagination: true
    });
  });
});

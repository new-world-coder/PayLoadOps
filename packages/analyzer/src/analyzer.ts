import type {
  AnalysisResult,
  QueryLog,
  QueryPatternFlags,
  RiskLevel,
  TelemetryPayload
} from "@payloadops/types";

const LOW_SIZE_THRESHOLD_BYTES = 500 * 1024;
const LOW_LATENCY_THRESHOLD_MS = 300;
const MEDIUM_SIZE_THRESHOLD_BYTES = 2 * 1024 * 1024;
const MEDIUM_LATENCY_THRESHOLD_MS = 800;

const BYTES_PER_GB = 1024 * 1024 * 1024;
const SIZE_COST_PER_GB_USD = 0.09;
const LATENCY_COST_PER_MS_USD = 0.000001;

const AGGREGATION_PATTERN = /\b(group\s+by|having|sum|avg|count|min|max)\b/i;
const PAGINATION_PATTERN = /\b(limit|offset|fetch\s+first|top\s+\d+|page)\b/i;

export function determineRiskLevel(payload: TelemetryPayload): RiskLevel {
  const { payloadSizeBytes, latencyMs } = payload;

  if (payloadSizeBytes < LOW_SIZE_THRESHOLD_BYTES && latencyMs < LOW_LATENCY_THRESHOLD_MS) {
    return "LOW";
  }

  if (payloadSizeBytes < MEDIUM_SIZE_THRESHOLD_BYTES && latencyMs < MEDIUM_LATENCY_THRESHOLD_MS) {
    return "MEDIUM";
  }

  return "HIGH";
}

export function computeCost(payloadSizeBytes: number, latencyMs: number): number {
  const sizeInGb = payloadSizeBytes / BYTES_PER_GB;
  return sizeInGb * SIZE_COST_PER_GB_USD + latencyMs * LATENCY_COST_PER_MS_USD;
}

export function detectQueryPatterns(query: QueryLog): QueryPatternFlags {
  const queryText = query.query.trim();
  return {
    hasLargeResultSet: query.resultSize > 1000,
    hasAggregation: AGGREGATION_PATTERN.test(queryText),
    missingPagination: !PAGINATION_PATTERN.test(queryText)
  };
}

export function analyzePayload(input: TelemetryPayload): AnalysisResult {
  return {
    riskLevel: determineRiskLevel(input),
    estimatedCostUsd: computeCost(input.payloadSizeBytes, input.latencyMs),
    queryPatterns: detectQueryPatterns(input.query)
  };
}

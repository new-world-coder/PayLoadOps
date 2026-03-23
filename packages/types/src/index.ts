export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface QueryPatternFlags {
  hasLargeResultSet: boolean;
  hasAggregation: boolean;
  missingPagination: boolean;
}

export interface QueryLog {
  query: string;
  resultSize: number;
  executionTimeMs: number;
}

export interface TelemetryPayload {
  payloadSizeBytes: number;
  latencyMs: number;
  query: QueryLog;
  receivedAt: string;
}

export interface AnalysisResult {
  riskLevel: RiskLevel;
  estimatedCostUsd: number;
  queryPatterns: QueryPatternFlags;
}

export interface ReplayRequest {
  payload: TelemetryPayload;
  reason: string;
}

export interface ReplayResult {
  accepted: boolean;
  replayId?: string;
  message: string;
}

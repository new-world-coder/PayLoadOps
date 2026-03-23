import { Queue, Worker, type ConnectionOptions } from "bullmq";

export const RISK_AGENT_QUEUE = "risk-agent";
export const PATTERN_AGENT_QUEUE = "pattern-agent";

export interface AgentJobPayload {
  queryId: string;
  queryHash: string;
  payload: unknown;
}

export interface RiskAnalyzer {
  analyze(payload: unknown): Promise<unknown>;
}

export interface PatternAnalyzer {
  analyze(payload: unknown): Promise<unknown>;
}

export interface AgentRepository {
  hasProcessed(idempotencyKey: string): Promise<boolean>;
  markProcessed(idempotencyKey: string): Promise<void>;
  updateRiskAnalysis(queryId: string, result: unknown): Promise<void>;
  updatePatternAnalysis(queryId: string, result: unknown): Promise<void>;
}

export interface AgentProcessorsConfig {
  connection: ConnectionOptions;
  analyzers: {
    risk: RiskAnalyzer;
    pattern: PatternAnalyzer;
  };
  repository: AgentRepository;
  prefix?: string;
}

export interface AgentProcessors {
  riskQueue: Queue<AgentJobPayload>;
  patternQueue: Queue<AgentJobPayload>;
  riskWorker: Worker<AgentJobPayload>;
  patternWorker: Worker<AgentJobPayload>;
  enqueueRisk(data: AgentJobPayload): Promise<void>;
  enqueuePattern(data: AgentJobPayload): Promise<void>;
  close(): Promise<void>;
}

function buildIdempotencyKey(data: AgentJobPayload): string {
  return `${data.queryId}:${data.queryHash}`;
}

const MAX_ATTEMPTS = 3;

export function createAgentProcessors(config: AgentProcessorsConfig): AgentProcessors {
  const queueName = (name: string) =>
    config.prefix ? `${config.prefix}-${name}` : name;

  const queueOptions = {
    connection: config.connection,
    defaultJobOptions: {
      attempts: MAX_ATTEMPTS
    }
  };

  const riskQueue = new Queue<AgentJobPayload>(
    queueName(RISK_AGENT_QUEUE),
    queueOptions
  );
  const patternQueue = new Queue<AgentJobPayload>(
    queueName(PATTERN_AGENT_QUEUE),
    queueOptions
  );

  const riskWorker = new Worker<AgentJobPayload>(
    queueName(RISK_AGENT_QUEUE),
    async (job) => {
      const key = buildIdempotencyKey(job.data);
      const alreadyProcessed = await config.repository.hasProcessed(key);
      if (alreadyProcessed) {
        return;
      }

      const result = await config.analyzers.risk.analyze(job.data.payload);
      await config.repository.updateRiskAnalysis(job.data.queryId, result);
      await config.repository.markProcessed(key);
    },
    { connection: config.connection }
  );

  const patternWorker = new Worker<AgentJobPayload>(
    queueName(PATTERN_AGENT_QUEUE),
    async (job) => {
      const key = buildIdempotencyKey(job.data);
      const alreadyProcessed = await config.repository.hasProcessed(key);
      if (alreadyProcessed) {
        return;
      }

      const result = await config.analyzers.pattern.analyze(job.data.payload);
      await config.repository.updatePatternAnalysis(job.data.queryId, result);
      await config.repository.markProcessed(key);
    },
    { connection: config.connection }
  );

  return {
    riskQueue,
    patternQueue,
    riskWorker,
    patternWorker,
    async enqueueRisk(data) {
      await riskQueue.add(data.queryId, data, {
        attempts: MAX_ATTEMPTS,
        jobId: buildIdempotencyKey(data)
      });
    },
    async enqueuePattern(data) {
      await patternQueue.add(data.queryId, data, {
        attempts: MAX_ATTEMPTS,
        jobId: buildIdempotencyKey(data)
      });
    },
    async close() {
      await Promise.all([
        riskWorker.close(),
        patternWorker.close(),
        riskQueue.close(),
        patternQueue.close()
      ]);
    }
  };
}

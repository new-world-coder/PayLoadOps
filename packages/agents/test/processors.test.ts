import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgentProcessors,
  PATTERN_AGENT_QUEUE,
  RISK_AGENT_QUEUE,
  type AgentJobPayload
} from "../src/index.js";

type WorkerProcessor = (job: { data: AgentJobPayload }) => Promise<void>;

const queueAddCalls: Array<{
  queueName: string;
  name: string;
  data: AgentJobPayload;
  options?: Record<string, unknown>;
}> = [];
const queueCtorCalls: Array<{
  queueName: string;
  options?: Record<string, unknown>;
}> = [];
const workerProcessors = new Map<string, WorkerProcessor>();

vi.mock("bullmq", () => {
  class Queue<TData> {
    queueName: string;
    options?: Record<string, unknown>;

    constructor(queueName: string, options?: Record<string, unknown>) {
      this.queueName = queueName;
      this.options = options;
      queueCtorCalls.push({ queueName, options });
    }

    async add(name: string, data: TData, options?: Record<string, unknown>) {
      queueAddCalls.push({
        queueName: this.queueName,
        name,
        data: data as AgentJobPayload,
        options
      });
    }

    async close() {
      return;
    }
  }

  class Worker<TData> {
    constructor(
      queueName: string,
      processor: (job: { data: TData }) => Promise<void>
    ) {
      workerProcessors.set(queueName, processor as WorkerProcessor);
    }

    async close() {
      return;
    }
  }

  return { Queue, Worker };
});

describe("createAgentProcessors", () => {
  beforeEach(() => {
    queueAddCalls.length = 0;
    queueCtorCalls.length = 0;
    workerProcessors.clear();
  });

  it("configures retries and stable idempotent job ids", async () => {
    const repository = {
      hasProcessed: vi.fn().mockResolvedValue(false),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      updateRiskAnalysis: vi.fn().mockResolvedValue(undefined),
      updatePatternAnalysis: vi.fn().mockResolvedValue(undefined)
    };
    const analyzers = {
      risk: { analyze: vi.fn().mockResolvedValue({ risk: "HIGH" }) },
      pattern: { analyze: vi.fn().mockResolvedValue({ pattern: "BROAD" }) }
    };

    const processors = createAgentProcessors({
      connection: { host: "localhost", port: 6379 },
      analyzers,
      repository
    });

    await processors.enqueueRisk({
      queryId: "q-1",
      queryHash: "hash-1",
      payload: { query: { match_all: {} } }
    });
    await processors.enqueuePattern({
      queryId: "q-2",
      queryHash: "hash-2",
      payload: { query: { term: { x: 1 } } }
    });

    expect(queueCtorCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queueName: RISK_AGENT_QUEUE,
          options: expect.objectContaining({
            defaultJobOptions: expect.objectContaining({ attempts: 3 })
          })
        }),
        expect.objectContaining({
          queueName: PATTERN_AGENT_QUEUE,
          options: expect.objectContaining({
            defaultJobOptions: expect.objectContaining({ attempts: 3 })
          })
        })
      ])
    );

    const riskAdd = queueAddCalls.find((call) => call.queueName === RISK_AGENT_QUEUE);
    const patternAdd = queueAddCalls.find(
      (call) => call.queueName === PATTERN_AGENT_QUEUE
    );
    expect(riskAdd?.options).toMatchObject({ attempts: 3, jobId: "q-1:hash-1" });
    expect(patternAdd?.options).toMatchObject({ attempts: 3, jobId: "q-2:hash-2" });
  });

  it("guards idempotent processing by query id/hash", async () => {
    const repository = {
      hasProcessed: vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      updateRiskAnalysis: vi.fn().mockResolvedValue(undefined),
      updatePatternAnalysis: vi.fn().mockResolvedValue(undefined)
    };
    const analyzers = {
      risk: { analyze: vi.fn().mockResolvedValue({ risk: "LOW" }) },
      pattern: { analyze: vi.fn().mockResolvedValue({ pattern: "OK" }) }
    };

    createAgentProcessors({
      connection: { host: "localhost", port: 6379 },
      analyzers,
      repository
    });

    const riskProcessor = workerProcessors.get(RISK_AGENT_QUEUE);
    expect(riskProcessor).toBeTypeOf("function");

    const data: AgentJobPayload = {
      queryId: "query-123",
      queryHash: "abc123",
      payload: { sample: true }
    };

    await riskProcessor!({ data });
    await riskProcessor!({ data });

    expect(repository.hasProcessed).toHaveBeenCalledWith("query-123:abc123");
    expect(analyzers.risk.analyze).toHaveBeenCalledTimes(1);
    expect(repository.updateRiskAnalysis).toHaveBeenCalledTimes(1);
    expect(repository.markProcessed).toHaveBeenCalledTimes(1);
  });
});

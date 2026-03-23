import Fastify, { type FastifyInstance } from "fastify";

import { analyzeQuery, deterministicReplayMetrics } from "./analyzer.js";
import { createRepositoryWithFallback, InMemoryQueryRepository } from "./repository.js";
import type { QueryRepository } from "./types.js";

interface BuildAppOptions {
  repository?: QueryRepository;
}

function parsePageNumber(input: unknown, fallback: number): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });
  const repository = options.repository ?? (await createRepositoryWithFallback()).repository;

  fastify.post("/telemetry", async (request, reply) => {
    const body = request.body as {
      query?: unknown;
      response?: unknown;
      latencyMs?: number;
    };

    if (body?.query === undefined) {
      return reply.status(400).send({ error: "query is required" });
    }

    const responseSize = Buffer.byteLength(JSON.stringify(body.response ?? {}), "utf8");
    const latencyMs = Math.max(1, Math.floor(body.latencyMs ?? 0));
    const analysis = analyzeQuery(body.query, responseSize);

    const created = await repository.create({
      queryPayload: body.query,
      responseSize,
      latencyMs,
      risk: analysis.risk,
      cost: analysis.cost,
      flags: analysis.flags
    });

    return reply.status(201).send(created);
  });

  fastify.get("/queries", async (request) => {
    const query = request.query as { page?: string; pageSize?: string };
    const page = parsePageNumber(query.page, 1);
    const pageSize = Math.min(parsePageNumber(query.pageSize, 10), 100);
    return repository.list({ page, pageSize });
  });

  fastify.get("/queries/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const row = await repository.getById(params.id);
    if (!row) {
      return reply.status(404).send({ error: "query not found" });
    }
    return row;
  });

  fastify.post("/replay", async (request, reply) => {
    const body = request.body as {
      query?: unknown;
      iterations?: number;
    };

    if (body?.query === undefined) {
      return reply.status(400).send({ error: "query is required" });
    }

    const iterations = Math.floor(body.iterations ?? 1);
    if (iterations < 1 || iterations > 50) {
      return reply.status(400).send({ error: "iterations must be between 1 and 50" });
    }

    const metrics = deterministicReplayMetrics(body.query, iterations);
    const analysis = analyzeQuery(body.query, metrics.avgResponseSize);

    return reply.send({
      iterations,
      avgLatencyMs: metrics.avgLatencyMs,
      avgResponseSize: metrics.avgResponseSize,
      risk: analysis.risk,
      cost: analysis.cost,
      flags: analysis.flags
    });
  });

  return fastify;
}

export { InMemoryQueryRepository };

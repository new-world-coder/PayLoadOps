import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { analyzeQuery, hashString, stableStringify } from "./analyzer.js";
import type { NewQueryLogInput, PaginatedResult, PaginationInput, QueryLog, QueryRepository } from "./types.js";

function toQueryLog(row: {
  id: string;
  queryHash: string;
  queryPayload: unknown;
  responseSize: number;
  latencyMs: number;
  risk: number;
  cost: number;
  flags: unknown;
  createdAt: Date;
}): QueryLog {
  return {
    id: row.id,
    queryHash: row.queryHash,
    queryPayload: row.queryPayload,
    responseSize: row.responseSize,
    latencyMs: row.latencyMs,
    risk: row.risk,
    cost: row.cost,
    flags: Array.isArray(row.flags) ? (row.flags as string[]) : [],
    createdAt: row.createdAt
  };
}

export class PrismaQueryRepository implements QueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewQueryLogInput): Promise<QueryLog> {
    const queryHash = hashString(stableStringify(input.queryPayload));
    const row = await this.prisma.queryLog.create({
      data: {
        queryHash,
        queryPayload: input.queryPayload as object,
        responseSize: input.responseSize,
        latencyMs: input.latencyMs,
        risk: input.risk,
        cost: input.cost,
        flags: input.flags
      }
    });
    return toQueryLog(row);
  }

  async list(input: PaginationInput): Promise<PaginatedResult<QueryLog>> {
    const skip = (input.page - 1) * input.pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.queryLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: input.pageSize
      }),
      this.prisma.queryLog.count()
    ]);

    return {
      items: rows.map((row: any) => toQueryLog(row)),
      page: input.page,
      pageSize: input.pageSize,
      total
    };
  }

  async getById(id: string): Promise<QueryLog | null> {
    const row = await this.prisma.queryLog.findUnique({ where: { id } });
    return row ? toQueryLog(row) : null;
  }
}

export class InMemoryQueryRepository implements QueryRepository {
  private readonly rows: QueryLog[] = [];

  async create(input: NewQueryLogInput): Promise<QueryLog> {
    const queryHash = hashString(stableStringify(input.queryPayload));
    const row: QueryLog = {
      id: randomUUID(),
      queryHash,
      queryPayload: input.queryPayload,
      responseSize: input.responseSize,
      latencyMs: input.latencyMs,
      risk: input.risk,
      cost: input.cost,
      flags: input.flags,
      createdAt: new Date()
    };
    this.rows.unshift(row);
    return row;
  }

  async list(input: PaginationInput): Promise<PaginatedResult<QueryLog>> {
    const start = (input.page - 1) * input.pageSize;
    const end = start + input.pageSize;
    return {
      items: this.rows.slice(start, end),
      page: input.page,
      pageSize: input.pageSize,
      total: this.rows.length
    };
  }

  async getById(id: string): Promise<QueryLog | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
}

export async function createRepositoryWithFallback(): Promise<{
  repository: QueryRepository;
  mode: "prisma" | "memory";
}> {
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    return {
      repository: new PrismaQueryRepository(prisma),
      mode: "prisma"
    };
  } catch {
    return {
      repository: new InMemoryQueryRepository(),
      mode: "memory"
    };
  }
}

export function enrichTelemetryInput(input: {
  queryPayload: unknown;
  responseSize: number;
}): { risk: number; cost: number; flags: string[] } {
  const analysis = analyzeQuery(input.queryPayload, input.responseSize);
  return {
    risk: analysis.risk,
    cost: analysis.cost,
    flags: analysis.flags
  };
}

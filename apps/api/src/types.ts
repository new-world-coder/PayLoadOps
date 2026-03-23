export interface QueryLog {
  id: string;
  queryHash: string;
  queryPayload: unknown;
  responseSize: number;
  latencyMs: number;
  risk: number;
  cost: number;
  flags: string[];
  createdAt: Date;
}

export interface NewQueryLogInput {
  queryPayload: unknown;
  responseSize: number;
  latencyMs: number;
  risk: number;
  cost: number;
  flags: string[];
}

export interface PaginationInput {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface QueryRepository {
  create(input: NewQueryLogInput): Promise<QueryLog>;
  list(input: PaginationInput): Promise<PaginatedResult<QueryLog>>;
  getById(id: string): Promise<QueryLog | null>;
}

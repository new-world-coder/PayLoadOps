import { describe, expect, it } from "vitest";

import { buildApp, InMemoryQueryRepository } from "../src/app.js";

describe("api endpoints", () => {
  it("creates and lists telemetry entries with pagination", async () => {
    const app = await buildApp({ repository: new InMemoryQueryRepository() });

    const createResponse = await app.inject({
      method: "POST",
      url: "/telemetry",
      payload: {
        query: { sql: "select * from users" },
        response: { rows: [{ id: 1 }] },
        latencyMs: 22
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created.id).toBeTruthy();
    expect(created.risk).toBeTypeOf("number");
    expect(Array.isArray(created.flags)).toBe(true);

    const listResponse = await app.inject({
      method: "GET",
      url: "/queries?page=1&pageSize=5"
    });
    expect(listResponse.statusCode).toBe(200);
    const list = listResponse.json();
    expect(list.total).toBe(1);
    expect(list.items[0].id).toBe(created.id);

    await app.close();
  });

  it("returns query by id and 404 for unknown id", async () => {
    const app = await buildApp({ repository: new InMemoryQueryRepository() });
    const created = await app.inject({
      method: "POST",
      url: "/telemetry",
      payload: {
        query: { prompt: "hello" },
        response: { ok: true },
        latencyMs: 11
      }
    });
    const createdBody = created.json();

    const getOk = await app.inject({
      method: "GET",
      url: `/queries/${createdBody.id}`
    });
    expect(getOk.statusCode).toBe(200);
    expect(getOk.json().id).toBe(createdBody.id);

    const getMissing = await app.inject({
      method: "GET",
      url: "/queries/not-found"
    });
    expect(getMissing.statusCode).toBe(404);

    await app.close();
  });

  it("runs replay with deterministic averages and validates limits", async () => {
    const app = await buildApp({ repository: new InMemoryQueryRepository() });
    const payload = { query: { prompt: "demo replay" }, iterations: 10 };

    const first = await app.inject({ method: "POST", url: "/replay", payload });
    const second = await app.inject({ method: "POST", url: "/replay", payload });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json()).toEqual(second.json());

    const invalid = await app.inject({
      method: "POST",
      url: "/replay",
      payload: { query: { a: 1 }, iterations: 51 }
    });
    expect(invalid.statusCode).toBe(400);

    await app.close();
  });
});

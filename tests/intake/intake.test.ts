import { describe, expect, it, vi } from "vitest";
import { createMemoryStore, createRedisStore, type Pick } from "@/lib/intake/store";
import {
  handleCreateIntake,
  handleGetIntake,
  handleSubmitIntake,
} from "@/lib/server/intake-handlers";

const pick = (id: string, name = id): Pick => ({
  entityId: id,
  name,
  type: "urn:entity:artist",
  imageUrl: null,
  popularity: 0.5,
});

const freshMemory = () =>
  createMemoryStore({ sessions: new Map(), hashes: new Map(), counters: new Map() });

const post = (body: unknown) =>
  new Request("http://test.local/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("memory intake store", () => {
  it("counts picks per entity and participants, deduplicating within one submission", async () => {
    const s = freshMemory();
    await s.createSession({ id: "abc12345", title: "T", labels: { a: "A", b: "B" }, createdAt: 1 });
    await s.addPicks("abc12345", "a", [pick("E1"), pick("E2"), pick("E1")]);
    await s.addPicks("abc12345", "a", [pick("E1")]);
    const sum = await s.summary("abc12345", "a");
    expect(sum.participants).toBe(2);
    expect(sum.entities.map((e) => [e.entityId, e.count])).toEqual([
      ["E1", 2],
      ["E2", 1],
    ]);
    expect((await s.summary("abc12345", "b")).participants).toBe(0);
  });
});

describe("redis intake store", () => {
  it("sends pipelined commands with the bearer token and parses HGETALL replies", async () => {
    const calls: { url: string; body: unknown; auth: string | null }[] = [];
    const doFetch = vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as string[][];
      calls.push({ url, body, auth: new Headers(init.headers).get("authorization") });
      if (body[0][0] === "GET" && body.length === 3) {
        return Response.json([
          { result: "3" },
          { result: ["E1", "2"] },
          { result: ["E1", JSON.stringify(pick("E1", "Example"))] },
        ]);
      }
      return Response.json(body.map(() => ({ result: "OK" })));
    });
    const s = createRedisStore(
      { url: "https://redis.example.test/", token: "tok" },
      doFetch as unknown as typeof fetch,
    );
    await s.addPicks("abc12345", "b", [pick("E1")]);
    const sum = await s.summary("abc12345", "b");

    expect(calls[0].url).toBe("https://redis.example.test/pipeline");
    expect(calls[0].auth).toBe("Bearer tok");
    expect(calls[0].body).toContainEqual(["HINCRBY", "cg:intake:abc12345:b:counts", "E1", 1]);
    expect(sum).toEqual({ participants: 3, entities: [{ ...pick("E1", "Example"), count: 2 }] });
  });
});

describe("intake handlers", () => {
  it("creates a session, accepts picks and returns aggregated sides", async () => {
    const s = freshMemory();
    const created = await (
      await handleCreateIntake(
        post({ title: "Campus ↔ City", labels: { a: "Club", b: "Assoc" } }),
        () => s,
      )
    ).json();
    expect(created.links).toEqual({ a: `/join/${created.id}/a`, b: `/join/${created.id}/b` });
    expect(created.storage).toBe("memory");

    const ok = await handleSubmitIntake(post({ picks: [pick("E1")] }), created.id, "a", () => s);
    expect(ok.status).toBe(200);
    const got = await (await handleGetIntake(created.id, () => s)).json();
    expect(got.session.labels.a).toBe("Club");
    expect(got.sides.a.participants).toBe(1);
  });

  it("rejects unknown sessions, bad sides and too many picks", async () => {
    const s = freshMemory();
    const { id } = await (
      await handleCreateIntake(post({ title: "T", labels: { a: "A", b: "B" } }), () => s)
    ).json();
    expect(
      (await handleSubmitIntake(post({ picks: [pick("E1")] }), "missing00", "a", () => s)).status,
    ).toBe(404);
    expect((await handleSubmitIntake(post({ picks: [pick("E1")] }), id, "c", () => s)).status).toBe(
      404,
    );
    const four = [pick("1"), pick("2"), pick("3"), pick("4")];
    expect((await handleSubmitIntake(post({ picks: four }), id, "a", () => s)).status).toBe(400);
    expect((await handleGetIntake("bad id!", () => s)).status).toBe(404);
  });
});

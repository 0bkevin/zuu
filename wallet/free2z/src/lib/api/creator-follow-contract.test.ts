// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { discover, tuzi } from "./free2z";
import { ApiError, setToken } from "./http";
import { mockCreatorFollow } from "./mock-data";

const fetchMock = vi.fn();
function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}
beforeAll(() => {
  Object.defineProperty(window, "fetch", {
    configurable: true,
    value: fetchMock,
  });
  setToken("test-token");
});
afterAll(() => {
  setToken(null);
});

describe("public creator follow HTTP contract", () => {
  it("keeps mock follows separate per account and creator", () => {
    expect(mockCreatorFollow("star-a", "follow", "mock-alice")).toBe(true);
    expect(mockCreatorFollow("star-a", "state", "mock-bob")).toBe(false);
    expect(mockCreatorFollow("star-b", "state", "mock-alice")).toBe(false);
    expect(mockCreatorFollow("star-a", "state", "mock-alice")).toBe(true);
    expect(mockCreatorFollow("star-a", "unfollow", "mock-alice")).toBe(false);
  });
  it("uses authenticated GET, PUT and DELETE, validates the creator and reads following", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        reply(200, { username: "Alice.Smith", following: false }),
      )
      .mockResolvedValueOnce(
        reply(200, { username: "Alice.Smith", following: true }),
      )
      .mockResolvedValueOnce(
        reply(200, { username: "Alice.Smith", following: false }),
      );
    await expect(tuzi.creatorFollow("alice.smith", "state")).resolves.toBe(
      false,
    );
    await expect(tuzi.creatorFollow("alice.smith", "follow")).resolves.toBe(
      true,
    );
    await expect(tuzi.creatorFollow("alice.smith", "unfollow")).resolves.toBe(
      false,
    );
    expect(
      fetchMock.mock.calls.map(([url, options]) => [
        new URL(url).pathname,
        options.method,
        options.headers.Authorization,
        options.cache,
      ]),
    ).toEqual([
      [
        "/api/creator/alice.smith/follow/",
        "GET",
        "Token test-token",
        "no-store",
      ],
      [
        "/api/creator/alice.smith/follow/",
        "PUT",
        "Token test-token",
        "no-store",
      ],
      [
        "/api/creator/alice.smith/follow/",
        "DELETE",
        "Token test-token",
        "no-store",
      ],
    ]);
  });
  it("rejects malformed, wrong-creator, and HTTP failure replies", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        reply(200, { username: "alice", following: "false" }),
      )
      .mockResolvedValueOnce(reply(200, { username: "other", following: true }))
      .mockResolvedValueOnce(reply(401, { detail: "Authentication required" }));
    await expect(tuzi.creatorFollow("alice", "state")).rejects.toThrow(
      "Invalid creator follow state",
    );
    await expect(tuzi.creatorFollow("alice", "state")).rejects.toThrow(
      "Invalid creator follow state",
    );
    await expect(tuzi.creatorFollow("alice", "follow")).rejects.toBeInstanceOf(
      ApiError,
    );
  });
  it.each(["", " ", "-1", "01", true, null, "Infinity"])(
    "does not coerce invalid wire price %s into a free tier",
    async (price) => {
      fetchMock
        .mockReset()
        .mockResolvedValueOnce(
          reply(200, { username: "alice", member_price: price }),
        );
      expect((await discover.creator("alice")).member_price).toBeNull();
    },
  );
  it("maps valid backend decimal prices without rounding", async () => {
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(
        reply(200, { username: "alice", member_price: "0" }),
      )
      .mockResolvedValueOnce(
        reply(200, { username: "alice", member_price: "10" }),
      );
    expect((await discover.creator("alice")).member_price).toBe(0);
    expect((await discover.creator("alice")).member_price).toBe(10);
  });
});

import { describe, expect, it } from "vitest";
import { MESSAGE_KEYS } from "./messages";
import { createTestI18n } from "./test-provider";

describe("test i18n provider parity", () => {
  it("fails closed on a missing message like production", () => {
    const instance = createTestI18n();
    expect(() => instance.t("missing.test.message")).toThrow(
      "missing i18n message: missing.test.message",
    );
  });

  it("fails closed on malformed ICU like production", () => {
    const instance = createTestI18n("en", {
      broken: "{count, plural, one {one}",
    });
    expect(() => instance.t("broken", { count: 1 })).toThrow(
      /invalid ICU message for broken/,
    );
  });

  it("resolves the concise recovery copy from each active catalog", () => {
    expect(createTestI18n("en").t(MESSAGE_KEYS.commonTryAgain)).toBe(
      "Try again.",
    );
    expect(createTestI18n("es").t(MESSAGE_KEYS.commonTryAgain)).toBe(
      "Inténtalo de nuevo.",
    );
    expect(createTestI18n("fr").t(MESSAGE_KEYS.commonTryAgain)).toBe(
      "Réessayez.",
    );
  });

  it.each(["en", "es", "fr"] as const)(
    "formats every follow message in %s",
    (locale) => {
      const instance = createTestI18n(locale);
      const keys = [
        MESSAGE_KEYS.creatorFollowAction,
        MESSAGE_KEYS.creatorFollowAccessible,
        MESSAGE_KEYS.creatorFollowLoading,
        MESSAGE_KEYS.creatorFollowFollowing,
        MESSAGE_KEYS.creatorFollowUnfollow,
        MESSAGE_KEYS.creatorFollowRetry,
        MESSAGE_KEYS.creatorFollowUnavailable,
        MESSAGE_KEYS.creatorFollowReadError,
        MESSAGE_KEYS.creatorFollowMutationError,
        MESSAGE_KEYS.creatorFollowRecorded,
        MESSAGE_KEYS.creatorFollowSuccess,
        MESSAGE_KEYS.creatorUnfollowSuccess,
      ];
      for (const key of keys) {
        const result = instance.t(key, { name: "Alice" });
        expect(result).not.toBe(key);
        expect(result).not.toContain("{name}");
      }
      expect(
        instance.t(MESSAGE_KEYS.creatorFollowAccessible, { name: "Alice" }),
      ).toContain("Alice");
      expect(
        instance.t(MESSAGE_KEYS.creatorFollowUnfollow, { name: "Alice" }),
      ).toContain("Alice");
    },
  );
});

// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  creatorFollow: vi.fn(),
  mySubscriptions: vi.fn(),
  subscribe: vi.fn(),
  subscriptionStatus: vi.fn(),
}));
const notices = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const session = vi.hoisted(() => ({
  user: { username: "fan", free2zaddr: "fan" } as {
    username: string;
    free2zaddr: string;
  } | null,
  balance: 1000,
  navigate: vi.fn(),
}));
vi.mock("@/lib/api/free2z", () => ({ discover: {}, tuzi: api }));
vi.mock("sonner", () => ({ toast: notices }));
vi.mock("@/store/session", () => ({
  useSession: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({
        user: session.user,
        loading: false,
        tuzis: session.balance,
        adjustTuzis: vi.fn(),
      }),
    {
      getState: () => ({ user: session.user }),
      subscribe: () => () => {},
    },
  ),
}));
vi.mock("@/hooks/useAsync", () => ({
  useAsync: () => ({ data: [], reload: vi.fn() }),
}));
vi.mock("@/hooks/usePaidIntent", () => ({ usePaidIntent: () => null }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => session.navigate,
  useLocation: () => ({ pathname: "/creator" }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      ({
        "creator.follow.action": "Follow",
        "creator.follow.accessible": `Follow ${values?.name ?? ""}`,
        "creator.follow.loading": "Checking follow status",
        "creator.follow.following": "Following",
        "creator.follow.unfollow": `Unfollow ${values?.name ?? ""}`,
        "creator.follow.success": `Following ${values?.name ?? ""}. Free creator follow only; no paid membership or renewal started.`,
        "creator.follow.unfollowSuccess": `Unfollowed ${values?.name ?? ""}. Free creator follow only; no paid membership or renewal started.`,
        "creator.follow.unavailable": "Membership price unavailable",
        "creator.follow.retry": "Retry follow status",
      })[key] ?? key,
  }),
}));

import { SubscribeButton } from "./index";
import { setToken } from "@/lib/api/http";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const creator = {
  username: "creator",
  display_name: "Creator Name",
  free2zaddr: "creator",
  member_price: 0,
} as any;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  api.creatorFollow.mockReset();
  session.user = { username: "fan", free2zaddr: "fan" };
  session.balance = 1000;
  setToken("fan-token");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  api.creatorFollow
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true);
  api.mySubscriptions.mockResolvedValue([]);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  setToken(null);
});

describe("SubscribeButton free follow", () => {
  it("confirms Following from the authoritative GET after a successful Follow", async () => {
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    expect(host.querySelector("button")?.textContent).toContain("Follow");
    await act(async () => {
      host.querySelector("button")?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      api.creatorFollow.mock.calls.map(([name, method]) => [name, method]),
    ).toEqual([
      ["creator", "state"],
      ["creator", "follow"],
      ["creator", "state"],
    ]);
    expect(host.querySelector("button")?.textContent).toContain("Following");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(notices.success).toHaveBeenCalledWith(
      expect.stringMatching(/Following Creator Name/),
    );
    expect(notices.success.mock.calls[0]?.[0]).not.toMatch(
      /unlocked|subscriber posts|livestream access/i,
    );
    expect(notices.success).toHaveBeenCalledTimes(1);
  });

  it("unfollows through DELETE and confirms Follow from GET", async () => {
    api.creatorFollow
      .mockReset()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    await act(async () => host.querySelector("button")?.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(api.creatorFollow.mock.calls.map(([, method]) => method)).toEqual([
      "state",
      "unfollow",
      "state",
    ]);
    expect(host.querySelector("button")?.textContent).toContain("Follow");
  });

  it("recovers a recorded mutation with a GET-only retry after refresh failure", async () => {
    api.creatorFollow
      .mockReset()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(true);
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    await act(async () => host.querySelector("button")?.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(notices.error).toHaveBeenCalledWith(
      expect.stringContaining("recorded"),
    );
    await act(async () => host.querySelector("button")?.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(api.creatorFollow.mock.calls.map(([, method]) => method)).toEqual([
      "state",
      "follow",
      "state",
      "state",
    ]);
    expect(host.querySelector("button")?.textContent).toContain("Following");
  });

  it("re-reads persisted follow state on remount", async () => {
    let following = false;
    api.creatorFollow
      .mockReset()
      .mockImplementation(async (_username, action) => {
        if (action === "follow") following = true;
        if (action === "unfollow") following = false;
        return following;
      });
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    await act(async () => host.querySelector("button")?.click());
    await act(async () => {
      root.unmount();
      root = createRoot(host);
      root.render(<SubscribeButton creator={creator} restored={null} />);
    });
    expect(host.querySelector("button")?.textContent).toContain("Following");
    expect(api.creatorFollow.mock.calls.map(([, action]) => action)).toEqual([
      "state",
      "follow",
      "state",
      "state",
    ]);
  });

  it("ignores an old creator action and resets busy for the new creator", async () => {
    let release!: (value: boolean) => void;
    const held = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    api.creatorFollow
      .mockReset()
      .mockResolvedValueOnce(false)
      .mockReturnValueOnce(held)
      .mockResolvedValueOnce(false);
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    await act(async () => host.querySelector("button")?.click());
    const other = { ...creator, username: "other", display_name: "Other" };
    await act(async () =>
      root.render(<SubscribeButton creator={other} restored={null} />),
    );
    await act(async () => release(true));
    expect(host.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Follow Other",
    );
    expect(host.querySelector("button")?.disabled).toBe(false);
    expect(
      api.creatorFollow.mock.calls.map(([name, action]) => [name, action]),
    ).toEqual([
      ["creator", "state"],
      ["creator", "follow"],
      ["other", "state"],
    ]);
    expect(notices.success).not.toHaveBeenCalled();
  });

  it("hides the previous creator state while the new creator read is pending", async () => {
    let release!: (value: boolean) => void;
    const held = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    api.creatorFollow
      .mockReset()
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(held);
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    expect(host.querySelector("button")?.textContent).toContain("Following");
    const other = { ...creator, username: "other", display_name: "Other" };
    await act(async () =>
      root.render(<SubscribeButton creator={other} restored={null} />),
    );
    expect(host.querySelector("button")?.textContent).toBe(
      "Checking follow status",
    );
    expect(host.querySelector("button")?.disabled).toBe(true);
    await act(async () => release(false));
    expect(host.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Follow Other",
    );
  });

  it("ignores an old account or session response, including a same-user login", async () => {
    let release!: (value: boolean) => void;
    const held = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    api.creatorFollow
      .mockReset()
      .mockReturnValueOnce(held)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    session.user = { username: "another", free2zaddr: "another" };
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    await act(async () => release(true));
    expect(host.querySelector("button")?.textContent).toBe("Follow");
    await act(async () => {
      setToken(null);
      setToken("another-session");
    });
    expect(host.querySelector("button")?.textContent).toContain("Following");
    expect(api.creatorFollow).toHaveBeenCalledTimes(3);
  });

  it("ignores an earlier session's held response after the same user signs in again", async () => {
    let release!: (value: boolean) => void;
    const held = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    api.creatorFollow
      .mockReset()
      .mockReturnValueOnce(held)
      .mockResolvedValueOnce(false);
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    await act(async () => {
      setToken(null);
      setToken("new-fan-token");
    });
    await act(async () => release(true));
    expect(host.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Follow Creator Name",
    );
    expect(host.querySelector("button")?.disabled).toBe(false);
  });

  it("offers a read retry when the initial follow state is unavailable", async () => {
    api.creatorFollow
      .mockReset()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(false);
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    expect(host.querySelector("button")?.textContent).toBe(
      "Retry follow status",
    );
    await act(async () => host.querySelector("button")?.click());
    expect(host.querySelector("button")?.textContent).toBe("Follow");
    expect(api.creatorFollow.mock.calls.map(([, action]) => action)).toEqual([
      "state",
      "state",
    ]);
  });

  it("offers sign in to an anonymous follower", async () => {
    session.user = null;
    await act(async () =>
      root.render(<SubscribeButton creator={creator} restored={null} />),
    );
    expect(host.querySelector("button")?.disabled).toBe(false);
    expect(host.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Follow Creator Name",
    );
    await act(async () => host.querySelector("button")?.click());
    expect(session.navigate).toHaveBeenCalledWith("/login", expect.anything());
    expect(api.creatorFollow).not.toHaveBeenCalled();
  });

  it.each([null, undefined, "", " ", "-1", "01", true, NaN, Infinity])(
    "does not offer an action for invalid price %s",
    async (price) => {
      await act(async () =>
        root.render(
          <SubscribeButton
            creator={{ ...creator, member_price: price }}
            restored={null}
          />,
        ),
      );
      expect(host.querySelector("button")?.disabled).toBe(true);
      expect(host.textContent).toContain("Membership price unavailable");
      expect(api.creatorFollow).not.toHaveBeenCalled();
    },
  );

  it("shows paid membership terms and reports the confirmed renewal state", async () => {
    api.subscribe.mockResolvedValueOnce(undefined);
    api.subscriptionStatus.mockResolvedValueOnce({
      username: "creator",
      active: true,
      expires: "2099-01-01T00:00:00Z",
      max_price: "10",
      current_price: "10",
    });
    await act(async () =>
      root.render(
        <SubscribeButton
          creator={{ ...creator, member_price: 10 }}
          restored={null}
        />,
      ),
    );
    expect(host.querySelector("button")?.getAttribute("aria-label")).toMatch(
      /Subscribe to Creator Name/,
    );
    await act(async () => host.querySelector("button")?.click());
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toMatch(/membership price/);
    expect(dialog?.textContent).toMatch(/renew automatically/);
    const confirm = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.includes("Subscribe"),
    );
    expect(confirm).toBeTruthy();
    await act(async () => confirm?.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(api.subscribe).toHaveBeenCalledOnce();
    expect(api.creatorFollow).not.toHaveBeenCalled();
    expect(notices.success).toHaveBeenCalledWith(
      "Subscribed to Creator Name",
      expect.objectContaining({
        description: expect.stringContaining("Auto-renew is enabled"),
      }),
    );
    expect(host.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Manage your Creator Name membership",
    );
    await act(async () => host.querySelector("button")?.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Cancel auto-renew",
    );
  });

  it("does not invite another purchase when the paid status read fails after success", async () => {
    api.subscribe.mockResolvedValueOnce(undefined);
    api.subscriptionStatus.mockRejectedValueOnce(new Error("offline"));
    await act(async () =>
      root.render(
        <SubscribeButton
          creator={{ ...creator, member_price: 10 }}
          restored={null}
        />,
      ),
    );
    await act(async () => host.querySelector("button")?.click());
    const dialog = document.querySelector('[role="dialog"]');
    const confirm = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.includes("Subscribe"),
    );
    await act(async () => confirm?.click());
    expect(api.subscribe).toHaveBeenCalledOnce();
    expect(notices.error).toHaveBeenCalledWith(
      expect.stringContaining("request was recorded"),
    );
    expect(host.querySelector("button")?.disabled).toBe(true);
    expect(host.textContent).toContain("Reload to check membership status");
  });

  it("does not claim auto-renew resumed when the authoritative ceiling is zero", async () => {
    api.subscribe.mockResolvedValueOnce(undefined);
    api.subscriptionStatus.mockResolvedValueOnce({
      username: "creator",
      active: true,
      expires: "2099-01-01T00:00:00Z",
      max_price: "0",
      current_price: "10",
    });
    await act(async () =>
      root.render(
        <SubscribeButton
          creator={{ ...creator, member_price: 10 }}
          restored={null}
        />,
      ),
    );
    await act(async () => host.querySelector("button")?.click());
    const dialog = document.querySelector('[role="dialog"]');
    const confirm = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.includes("Subscribe"),
    );
    await act(async () => confirm?.click());
    expect(notices.success).toHaveBeenCalledWith(
      "Subscribed to Creator Name",
      expect.objectContaining({
        description: expect.stringContaining("Auto-renew is off"),
      }),
    );
    await act(async () => host.querySelector("button")?.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Auto-renew is off",
    );
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Extend membership",
    );
  });

  it("suppresses a paid response after switching creator and clears the busy state", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    api.subscribe.mockReset().mockReturnValueOnce(held);
    api.subscriptionStatus.mockReset();
    await act(async () =>
      root.render(
        <SubscribeButton
          creator={{ ...creator, member_price: 10 }}
          restored={null}
        />,
      ),
    );
    await act(async () => host.querySelector("button")?.click());
    const dialog = document.querySelector('[role="dialog"]');
    const confirm = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.includes("Subscribe"),
    );
    await act(async () => confirm?.click());
    const other = {
      ...creator,
      username: "other",
      display_name: "Other",
      member_price: 10,
    };
    await act(async () =>
      root.render(<SubscribeButton creator={other} restored={null} />),
    );
    await act(async () => release());
    expect(api.subscriptionStatus).not.toHaveBeenCalled();
    expect(notices.success).not.toHaveBeenCalled();
    expect(host.querySelector("button")?.getAttribute("aria-label")).toMatch(
      /Subscribe to Other/,
    );
    expect(host.querySelector("button")?.disabled).toBe(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

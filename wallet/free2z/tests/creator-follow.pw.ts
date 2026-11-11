import { expect, test } from "@playwright/test";

test("free follow and unfollow survive a creator profile reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("zuuli.knox.token", "mock-knox-token");
  });
  await page.goto("/creator/f2z");
  await page.locator("[data-creator-profile]").waitFor();
  await page.getByRole("button", { name: "Follow Free2Z" }).click();
  await expect(
    page.getByRole("button", { name: "Unfollow Free2Z" }),
  ).toHaveText(/Following/);
  await expect(
    page.getByText(/no paid membership or renewal started/i),
  ).toBeVisible();
  expect(await page.getByRole("dialog").count()).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unfollow Free2Z" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Unfollow Free2Z" }).click();
  await expect(
    page.getByRole("button", { name: "Follow Free2Z" }),
  ).toBeVisible();
});

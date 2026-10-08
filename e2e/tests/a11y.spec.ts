import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ADMIN_STATE, GUEST_STATE, INITIAL_COURSE_CODE, expect, test } from "./support";

/** Runs axe on the current page and fails on serious or critical WCAG A/AA problems. */
async function expectAccessible(page: Page, what: string) {
  const { violations, passes } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  // Guards against a scan that silently checks nothing.
  expect(passes.length, `axe evaluated its rules on ${what}`).toBeGreaterThan(10);
  const serious = violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  const report = serious
    .map((violation) => `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => `  ${node.target.join(" ")}: ${node.failureSummary?.split("\n")[1] ?? ""}`).join("\n")}`)
    .join("\n");
  expect(serious, `${what}\n${report}`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility in ${scheme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    test.describe("visitors", () => {
      test.use({ storageState: GUEST_STATE });

      test("login, registration, reset and an invite link", async ({ page }) => {
        for (const path of ["/login", "/register", "/reset", `/join/${INITIAL_COURSE_CODE}`, "/privacy"]) {
          await page.goto(path);
          await expect(page.locator("h1").first()).toBeVisible();
          await expectAccessible(page, path);
        }
      });
    });

    test.describe("logged in", () => {
      test.use({ storageState: ADMIN_STATE });

      test("overview, module page, account and admin", async ({ page, adminApi }) => {
        // Votes in the admin's own course give the bars and the chart something to show.
        const modules = await adminApi.get("/api/overview");
        const overview = await modules.json();
        let moduleId: string = overview.modules[0]?.id;
        if (!moduleId) {
          const created = await adminApi.post(`/api/admin/courses/${overview.course.id}/modules`, { data: { name: "Analysis", semester: 1 } });
          moduleId = (await created.json()).module.id;
        }
        await adminApi.put(`/api/modules/${moduleId}/vote`, { data: { value: "possible" } });

        await page.goto("/");
        await expect(page.locator("article").first()).toBeVisible();
        await expectAccessible(page, "overview");

        await page.goto(`/modules/${moduleId}`);
        await expect(page.getByRole("img", { name: /^Votes per day/ })).toBeVisible();
        await expectAccessible(page, "module page");

        await page.goto("/account");
        await expectAccessible(page, "account");

        await page.goto("/admin");
        await page.getByRole("button", { name: "Manage modules" }).first().click();
        await expect(page.getByRole("button", { name: "Hide modules" }).first()).toBeVisible();
        await expectAccessible(page, "admin");

        await page.goto("/admin/activity");
        await expect(page.getByRole("table")).toBeVisible();
        await expectAccessible(page, "activity log");
        await page.getByRole("button", { name: "Sign-ins and accounts" }).click();
        await expect(page.getByRole("table")).toBeVisible();
        await expectAccessible(page, "activity log, sign-ins");
      });
    });
  });
}

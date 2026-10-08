import { expect, request as playwrightRequest, test as base, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

export const ADMIN_SETUP_CODE = "e2e-admin-setup-code";
export const INITIAL_COURSE_CODE = "E2E-COURSE-CODE";
export const PASSWORD = "correct horse battery";
export const ADMIN_STATE = ".state/admin.json";
export const GUEST_STATE = { cookies: [], origins: [] };

const BACKEND_LOG = new URL("../.backend.log", import.meta.url);
const BASE_URL = `http://localhost:${process.env.E2E_FRONTEND_PORT ?? 4173}`;

// Every test pretends to come from its own address. The backend trusts X-Forwarded-For from loopback
// proxies (like production), so the per-IP rate limits never get in the way of unrelated tests.
let nextHost = 10;
function nextAddress(): string {
  nextHost += 1;
  return `10.${(nextHost >> 8) & 255}.${nextHost & 255}.7`;
}

type Fixtures = {
  /** A client for the admin API, logged in as the admin made by the setup project. */
  adminApi: APIRequestContext;
};

export const test = base.extend<Fixtures>({
  context: async ({ browser, contextOptions }, use) => {
    const context = await browser.newContext({
      ...contextOptions,
      extraHTTPHeaders: { ...contextOptions.extraHTTPHeaders, "X-Forwarded-For": nextAddress() },
    });
    await use(context);
    await context.close();
  },
  // Playwright reads the fixtures a fixture needs from its first parameter, which must be a destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  adminApi: async ({}, use) => {
    if (!existsSync(ADMIN_STATE)) throw new Error("The admin session is missing: the setup project has to run first");
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      storageState: ADMIN_STATE,
      extraHTTPHeaders: { "X-Forwarded-For": nextAddress() },
    });
    await use(api);
    await api.dispose();
  },
});
export { expect };

let counter = 0;
/** Returns a new user that has not been registered yet. */
export function newUser(prefix: string): { email: string; username: string } {
  counter += 1;
  const id = `${Date.now() % 1_000_000}${counter}`;
  return { email: `${prefix}.${id}@dhbw.example`, username: `${prefix}${id}`.slice(0, 20) };
}

/** Codes of all mails sent to an address so far, oldest first, read from the backend's log. */
export function codesSentTo(email: string): string[] {
  const log = existsSync(BACKEND_LOG) ? readFileSync(BACKEND_LOG, "utf8") : "";
  const pattern = new RegExp(`\\[mail\\] to=${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} subject="(\\d{6}) `, "g");
  return [...log.matchAll(pattern)].map((match) => match[1]!);
}

/** Waits for a mail to the address that is newer than the first `known` ones, and returns its code. */
export async function newCodeFor(email: string, known: number): Promise<string> {
  await expect.poll(() => codesSentTo(email).length, { message: `a code mail to ${email}` }).toBeGreaterThan(known);
  return codesSentTo(email).at(-1)!;
}

/**
 * A browser context of a visitor who is not logged in, with its own address. Needed because
 * browser.newContext() inherits the project's storageState, which would make the visitor an admin.
 * @param {Browser} browser
 * @param {string} address
 */
export function newGuestContext(browser: Browser, address: string): Promise<BrowserContext> {
  return browser.newContext({ storageState: GUEST_STATE, extraHTTPHeaders: { "X-Forwarded-For": address } });
}

/** Creates a course with one module through the admin API, so a test has its own data. */
export async function createCourse(
  adminApi: APIRequestContext,
  name: string,
  moduleName = "Datenbanken",
): Promise<{ id: string; name: string; joinCode: string; moduleName: string }> {
  const created = await adminApi.post("/api/admin/courses", { data: { name } });
  expect(created.status(), "creating the course").toBe(201);
  const { course } = await created.json();
  const module = await adminApi.post(`/api/admin/courses/${course.id}/modules`, { data: { name: moduleName, semester: 3 } });
  expect(module.status(), "creating the module").toBe(201);
  return { id: course.id, name, joinCode: course.joinCode, moduleName };
}

/** Registers a new account through the UI, starting at the invite link of a course. */
export async function registerViaInvite(page: Page, joinCode: string, user: { email: string; username: string }) {
  await page.goto(`/join/${joinCode}`);
  await page.getByRole("link", { name: "Create account" }).click();
  await page.getByLabel("DHBW email").fill(user.email);
  await page.getByLabel("Username", { exact: true }).fill(user.username);
  const known = codesSentTo(user.email).length;
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await newCodeFor(user.email, known));
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(accountLink(page, user.username)).toBeVisible();
}

/** The account link in the header, which carries the username. */
export function accountLink(page: Page, username: string): Locator {
  return page.getByRole("link", { name: `${username} (account)` });
}

/** The tile of a module on the overview. */
export function tileOf(page: Page, moduleName: string): Locator {
  return page.locator("article", { has: page.getByRole("heading", { name: moduleName }) });
}

/** Logs in through the form. */
export async function logIn(page: Page, user: { email: string }, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("DHBW email").fill(user.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).first().click();
}

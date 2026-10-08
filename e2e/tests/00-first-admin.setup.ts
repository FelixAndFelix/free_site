import { ADMIN_SETUP_CODE, ADMIN_STATE, INITIAL_COURSE_CODE, PASSWORD, codesSentTo, expect, newCodeFor, test } from "./support";

// Runs first (the other projects depend on it): the first admin registers with the setup code that
// only works while there is no admin, and their session is saved for the tests that need an admin.
test("the first admin registers with the setup code", async ({ page }) => {
  const email = "admin@dhbw.example";
  await page.goto("/register");
  await page.getByLabel("DHBW email").fill(email);
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Course code").fill(INITIAL_COURSE_CODE);
  await page.getByText("I have an admin setup code").click();
  await page.getByLabel("Admin setup code").fill(ADMIN_SETUP_CODE);
  const known = codesSentTo(email).length;
  await page.getByRole("button", { name: "Send code" }).click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await newCodeFor(email, known));
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("link", { name: "admin (account)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});

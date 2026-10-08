import { ADMIN_STATE, createCourse, expect, newGuestContext, newUser, registerViaInvite, test } from "./support";

test.describe("an admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test("opens and closes the modules of a course and renames one", async ({ page, adminApi }) => {
    const course = await createCourse(adminApi, "Rename course", "Datenbanke");
    await page.goto("/admin");
    const card = page.locator("li", { has: page.getByRole("heading", { name: course.name }) });

    const toggle = card.getByRole("button", { name: "Manage modules" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(card.getByText("Datenbanke")).toBeVisible();
    await expect(card.getByRole("button", { name: "Hide modules" })).toHaveAttribute("aria-expanded", "true");

    await card.locator("li", { hasText: "Datenbanke" }).getByRole("button", { name: "Edit" }).click();
    await card.getByLabel("Module name").fill("Datenbanken");
    await card.getByLabel("Semester of this module").selectOption("4");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText("Datenbanken", { exact: true })).toBeVisible();
    await expect(card.getByRole("heading", { name: "Semester 4" })).toBeVisible();

    await card.getByRole("button", { name: "Hide modules" }).click();
    await expect(card.getByText("Datenbanken", { exact: true })).toHaveCount(0);
  });

  test("creates a course and its first module in the UI, then deletes the empty course", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Course name").fill("UI course");
    await page.getByRole("button", { name: "Create course" }).click();

    const card = page.locator("li", { has: page.getByRole("heading", { name: "UI course" }) });
    await expect(card.getByRole("button", { name: "Hide modules" })).toBeVisible();
    await card.getByLabel("New module").fill("Software Engineering");
    // A select inside a label is named "Semester 1" (label plus the chosen option).
    await card.getByLabel(/^Semester/).selectOption("2");
    await card.getByRole("button", { name: "Add module" }).click();
    await expect(card.getByText("Software Engineering")).toBeVisible();
    await expect(card.getByText("0 members, 1 module")).toBeVisible();

    // Modules go with the course, which can only be deleted while nobody is in it.
    page.once("dialog", (dialog) => dialog.accept());
    await card.getByRole("button", { name: "Delete", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "UI course" })).toHaveCount(0);
  });

  test("copies the invite link, which works for a new student", async ({ page, context, browser, adminApi }) => {
    const course = await createCourse(adminApi, "Invite course");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/admin");
    const card = page.locator("li", { has: page.getByRole("heading", { name: course.name }) });
    await expect(card.getByText(course.joinCode)).toHaveCount(0);

    await card.getByRole("button", { name: "Copy invite link" }).click();
    await expect(card.getByRole("button", { name: "Link copied" })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toBe(`${new URL(page.url()).origin}/join/${course.joinCode}`);

    const guest = await newGuestContext(browser, "10.98.0.1");
    try {
      const student = await guest.newPage();
      await student.goto(link);
      await expect(student.getByRole("heading", { name: "Join Invite course" })).toBeVisible();
    } finally {
      await guest.close();
    }
  });

  test("finds users, makes one an admin and takes it back", async ({ page, browser, adminApi }) => {
    const course = await createCourse(adminApi, "Users course");
    const gina = newUser("gina");
    const guest = await newGuestContext(browser, "10.98.0.2");
    try {
      await registerViaInvite(await guest.newPage(), course.joinCode, gina);
    } finally {
      await guest.close();
    }

    await page.goto("/admin");
    await page.getByLabel("Search users").fill(gina.username);
    await expect(page.getByRole("status").filter({ hasText: "match" })).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(gina.username) });
    await expect(row.getByLabel(`Course of ${gina.email}`)).toHaveValue(course.id);

    await row.getByRole("button", { name: "Make admin" }).click();
    await expect(row.getByRole("button", { name: "Remove admin" })).toBeVisible();
    await page.getByLabel("Admins only").check();
    await expect(page.getByRole("row", { name: new RegExp(gina.username) })).toBeVisible();
    await row.getByRole("button", { name: "Remove admin" }).click();
    await expect(page.getByText("No users match")).toBeVisible();
  });
});

test("a student is sent away from the admin area", async ({ page, adminApi }) => {
  const course = await createCourse(adminApi, "Forbidden course");
  await registerViaInvite(page, course.joinCode, newUser("hugo"));

  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: course.name, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
});

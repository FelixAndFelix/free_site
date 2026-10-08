import { PASSWORD, accountLink, codesSentTo, createCourse, expect, logIn, newCodeFor, newUser, registerViaInvite, test, tileOf } from "./support";

test.describe("a student", () => {
  test("joins through the invite link, votes and sees the result", async ({ page, adminApi }) => {
    const course = await createCourse(adminApi, "Join and vote");
    const anna = newUser("anna");

    await page.goto(`/join/${course.joinCode}`);
    await expect(page.getByRole("heading", { name: "Join Join and vote" })).toBeVisible();
    await registerViaInvite(page, course.joinCode, anna);
    await expect(page.getByRole("heading", { name: course.name, level: 1 })).toBeVisible();

    const tile = tileOf(page, course.moduleName);
    await expect(tile.getByText("No votes yet").first()).toBeVisible();
    await tile.getByRole("button", { name: "Free" }).click();
    await expect(tile.getByText("Mostly free")).toBeVisible();
    await expect(tile.getByText("100%")).toBeVisible();
    await expect(tile.getByRole("img", { name: "Free 1, Possible 0, Impossible 0" })).toBeVisible();

    // The vote is locked for 15 minutes, so a second change is not possible.
    await expect(tile.getByText(/You can change your vote again at \d\d:\d\d/)).toBeVisible();
    await expect(tile.getByRole("button", { name: "Impossible" })).toBeDisabled();

    await tile.getByRole("link", { name: course.moduleName }).click();
    await expect(page.getByRole("heading", { name: course.moduleName, level: 1 })).toBeVisible();
    await expect(page.getByText("Mostly free")).toBeVisible();
    await expect(page.getByRole("img", { name: /^Votes per day from/ })).toBeVisible();
    await page.getByText("Show as table").click();
    await expect(page.getByRole("table")).toContainText("1");
  });

  test("sees a clear message for an invite link that is not valid", async ({ page }) => {
    await page.goto("/join/NOT-A-REAL-CODE");

    await expect(page.getByRole("heading", { name: "Invite link not valid" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("Ask an admin of your course for a new one.");
  });

  test("logs in and out, and is told about a wrong password", async ({ page, adminApi }) => {
    const course = await createCourse(adminApi, "Login course");
    const ben = newUser("ben");
    await registerViaInvite(page, course.joinCode, ben);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

    await logIn(page, ben, "wrong password");
    await expect(page.getByRole("alert")).toContainText("Email or password is wrong.");

    await logIn(page, ben);
    await expect(accountLink(page, ben.username)).toBeVisible();
    await expect(page.getByRole("heading", { name: course.name, level: 1 })).toBeVisible();
  });

  test("resets a forgotten password with an emailed code", async ({ page, adminApi }) => {
    const course = await createCourse(adminApi, "Reset course");
    const cleo = newUser("cleo");
    await registerViaInvite(page, course.joinCode, cleo);
    await page.getByRole("button", { name: "Log out" }).click();

    await page.goto("/reset");
    await page.getByLabel("DHBW email").fill(cleo.email);
    const known = codesSentTo(cleo.email).length;
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await page.getByLabel("Code", { exact: true }).fill(await newCodeFor(cleo.email, known));
    await page.getByLabel(/^New password/).fill("a brand new password");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();

    await logIn(page, cleo, PASSWORD);
    await expect(page.getByRole("alert")).toContainText("Email or password is wrong.");
    await logIn(page, cleo, "a brand new password");
    await expect(accountLink(page, cleo.username)).toBeVisible();
  });

  test("changes the language under Account and keeps it on the next login", async ({ page, adminApi }) => {
    const course = await createCourse(adminApi, "Language course");
    const dora = newUser("dora");
    await registerViaInvite(page, course.joinCode, dora);

    await accountLink(page, dora.username).click();
    await page.getByLabel("Interface language").selectOption("de");
    await expect(page.getByRole("heading", { name: "Konto", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Konto", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Abmelden" }).click();
    // Logged out, the page keeps the account's language on this device.
    await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
    await page.getByLabel("DHBW-E-Mail").fill(dora.email);
    await page.getByLabel("Passwort").fill(PASSWORD);
    await page.getByRole("button", { name: "Anmelden" }).first().click();
    await expect(page.getByRole("heading", { name: course.name, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Übersicht" })).toBeVisible();
  });

  test("switches to another course through its invite link after confirming", async ({ page, adminApi }) => {
    const first = await createCourse(adminApi, "First course");
    const second = await createCourse(adminApi, "Second course", "Netzwerke");
    const emil = newUser("emil");
    await registerViaInvite(page, first.joinCode, emil);
    await tileOf(page, first.moduleName).getByRole("button", { name: "Free" }).click();

    await page.goto(`/join/${second.joinCode}`);
    await expect(page.getByRole("heading", { name: "Switch to Second course?" })).toBeVisible();
    await expect(page.getByText(/your votes there are removed/)).toBeVisible();
    await page.getByRole("button", { name: "Switch to Second course" }).click();

    await expect(page.getByRole("heading", { name: "Second course", level: 1 })).toBeVisible();
    await expect(tileOf(page, "Netzwerke")).toBeVisible();
    await expect(page.getByText(first.moduleName)).toHaveCount(0);
  });

  test("deletes the account and cannot log in afterwards", async ({ page, adminApi }) => {
    const course = await createCourse(adminApi, "Delete course");
    const finn = newUser("finn");
    await registerViaInvite(page, course.joinCode, finn);

    await accountLink(page, finn.username).click();
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByLabel(/I understand that my account is deleted permanently/).check();
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByRole("heading", { name: "Account deleted" })).toBeVisible();

    await logIn(page, finn);
    await expect(page.getByRole("alert")).toContainText("Email or password is wrong.");
  });
});

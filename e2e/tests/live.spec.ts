import { createCourse, expect, newGuestContext, newUser, registerViaInvite, test, tileOf } from "./support";

test("a vote shows up for classmates who are already looking, without a reload", async ({ browser, adminApi }) => {
  const course = await createCourse(adminApi, "Live course");
  const watcherContext = await newGuestContext(browser, "10.99.0.1");
  const voterContext = await newGuestContext(browser, "10.99.0.2");
  try {
    const watcher = await watcherContext.newPage();
    const voter = await voterContext.newPage();
    await registerViaInvite(watcher, course.joinCode, newUser("watcher"));
    await registerViaInvite(voter, course.joinCode, newUser("voter"));
    await expect(tileOf(watcher, course.moduleName).getByText("No votes yet").first()).toBeVisible();

    await tileOf(voter, course.moduleName).getByRole("button", { name: "Impossible" }).click();

    // The watcher never reloads: the update arrives over the live connection.
    const watched = tileOf(watcher, course.moduleName);
    await expect(watched.getByText("Mostly impossible")).toBeVisible();
    await expect(watched.getByText("1 vote")).toBeVisible();
    await expect(watched.getByRole("img", { name: "Free 0, Possible 0, Impossible 1" })).toBeVisible();
  } finally {
    await watcherContext.close();
    await voterContext.close();
  }
});

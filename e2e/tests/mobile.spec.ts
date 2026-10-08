import { accountLink, createCourse, expect, newUser, registerViaInvite, test, tileOf } from "./support";

// Runs as a phone (Pixel 7): the layout must fit the screen and everything must work by tapping.
test("a student can join and vote on a phone without sideways scrolling", async ({ page, adminApi }) => {
  const course = await createCourse(adminApi, "Phone course");
  const ida = newUser("ida");

  await registerViaInvite(page, course.joinCode, ida);
  await expect(accountLink(page, ida.username)).toBeVisible();

  const tile = tileOf(page, course.moduleName);
  await tile.getByRole("button", { name: "Possible", exact: true }).tap();
  await expect(tile.getByText("Mostly possible")).toBeVisible();

  for (const path of ["/", "/account", "/privacy", `/modules/${(await (await adminApi.get(`/api/admin/courses/${course.id}/modules`)).json()).modules[0].id}`]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} is wider than the screen`).toBeLessThanOrEqual(0);
  }
});

test("the navigation fits on a phone and keeps its labels for screen readers", async ({ page, adminApi }) => {
  const course = await createCourse(adminApi, "Phone nav course");
  await registerViaInvite(page, course.joinCode, newUser("jan"));

  const navigation = page.getByRole("navigation", { name: "Main" });
  await expect(navigation.getByRole("link", { name: "Overview" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "Log out" })).toBeVisible();
  const box = await navigation.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

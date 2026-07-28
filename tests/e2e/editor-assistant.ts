import { expect, type Page } from "@playwright/test";

export async function openEditorAssistant(page: Page): Promise<"drawer" | "toolRail"> {
  const request = page.getByLabel("Your request");
  const drawerTrigger = page.getByRole("button", { name: "Open AI assistant" });
  await expect(request.or(drawerTrigger)).toBeVisible();
  if (await request.isVisible()) {
    return "toolRail";
  }

  await drawerTrigger.click();
  await expect(page.getByRole("dialog", { name: "Contextual tools" })).toBeVisible();
  await expect(request).toBeVisible();
  return "drawer";
}

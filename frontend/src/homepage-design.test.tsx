import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkbenchHarness from "./testing/WorkbenchHarness";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("src/styles.css"), "utf8");

function color(token: string): number[] {
  const value = css.match(
    new RegExp(`--re-${token}:\\s*#([0-9a-f]{6})`, "i"),
  )?.[1];
  if (!value) throw new Error(`Token de color ausente: ${token}`);
  return [0, 2, 4].map(
    (index) => parseInt(value.slice(index, index + 2), 16) / 255,
  );
}
function contrast(first: string, second: string): number {
  const luminance = (values: number[]) =>
    values
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      )
      .reduce(
        (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
        0,
      );
  const a = luminance(color(first));
  const b = luminance(color(second));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("new homepage text and semantic statuses have AA contrast against their surfaces", () => {
  for (const [foreground, background] of [
    ["text", "surface"],
    ["text-muted", "surface"],
    ["text-subtle", "surface"],
    ["text-muted", "background"],
    ["on-brand", "brand"],
    ["sidebar-text", "sidebar"],
    ["sidebar-muted", "sidebar"],
    ["success", "success-soft"],
    ["warning", "warning-soft"],
    ["danger", "danger-soft"],
  ])
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast("control-border", "surface")).toBeGreaterThanOrEqual(3);
  expect(contrast("focus", "surface")).toBeGreaterThanOrEqual(3);
});

test("workspace provides skip navigation, current page semantics and an Escape-dismissable menu", async () => {
  const user = userEvent.setup();
  render(<WorkbenchHarness />);
  expect(
    screen.getByRole("link", { name: "Saltar al contenido principal" }),
  ).toHaveAttribute("href", "#main-content");
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  const nav = screen.getByRole("navigation", { name: "Navegación principal" });
  const requests = within(nav).getByRole("button", {
    name: "Solicitudes de servicio",
  });
  expect(requests).toHaveAttribute("aria-current", "page");
  expect(requests.querySelector(".nav-count")).toBeNull();
  const trigger = screen.getByRole("button", { name: "Abrir menú" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await user.click(trigger);
  expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await user.keyboard("{Escape}");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
});

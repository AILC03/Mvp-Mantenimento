import type { Product } from "./data";

export const quantityStep = (unit: Product["unit"]) =>
  unit === "pza" ? 1 : 0.5;
export function validServiceQuantity(
  value: number,
  unit: Product["unit"],
): boolean {
  const ratio = value / quantityStep(unit);
  return (
    Number.isFinite(value) &&
    value > 0 &&
    Math.abs(ratio - Math.round(ratio)) < 1e-8
  );
}
export function nextQuantity(
  value: number,
  unit: Product["unit"],
  direction: 1 | -1,
): number {
  const step = quantityStep(unit);
  if (!Number.isFinite(value) || value <= 0) return step;
  const ratio = value / step;
  const next =
    direction === 1
      ? Math.floor(ratio + 1e-8) + 1
      : Math.ceil(ratio - 1e-8) - 1;
  return Math.max(step, Math.round(next * step * 1000) / 1000);
}

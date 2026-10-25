import { Minus, Plus } from "lucide-react";
import type { Product } from "../data";
import { nextQuantity, quantityStep } from "../quantities";

export function QuantityStepper({
  value,
  unit,
  label,
  onChange,
}: {
  value: number;
  unit: Product["unit"];
  label: string;
  onChange: (value: number) => void;
}) {
  const step = quantityStep(unit);
  return (
    <div className="quantity-stepper">
      <button
        type="button"
        disabled={Number.isFinite(value) && value <= step}
        aria-label={`Disminuir ${label}`}
        onClick={() => onChange(nextQuantity(value, unit, -1))}
      >
        <Minus size={14} />
      </button>
      <input
        aria-label={label}
        type="number"
        required
        min={step}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? NaN : Number(event.target.value))
        }
      />
      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        onClick={() => onChange(nextQuantity(value, unit, 1))}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

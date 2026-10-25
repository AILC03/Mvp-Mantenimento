import * as d from "../../shared/src/orders";
import { track } from "./operations-client";
export * from "../../shared/src/orders";
export const changeOrder: typeof d.changeOrder = (
  data,
  user,
  id,
  action,
  notes = "",
) =>
  track(d.changeOrder(data, user, id, action, notes), {
    type: "order.change",
    id,
    action,
    notes,
  });
export const finishOrder: typeof d.finishOrder = (data, user, id, input) =>
  track(d.finishOrder(data, user, id, input), {
    type: "order.finish",
    id,
    input,
  });
export const confirmMaterials: typeof d.confirmMaterials = (
  data,
  products,
  user,
  id,
  totals,
  notes = "",
) =>
  track(d.confirmMaterials(data, products, user, id, totals, notes), {
    type: "materials.confirm",
    id,
    totals,
    notes,
  });

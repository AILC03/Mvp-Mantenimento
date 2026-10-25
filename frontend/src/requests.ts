import * as d from "../../shared/src/requests";
import { track, persistTracked } from "./operations-client";
export * from "../../shared/src/requests";
export const persistWorkbench = (value: d.Workbench) =>
  persistTracked(value, () => d.persistWorkbench(value));
export const convertRequest: typeof d.convertRequest = (
  data,
  order,
  reviewedBy,
) =>
  track(d.convertRequest(data, order, reviewedBy), {
    type: "order.create",
    form: order.form,
    clientId: order.id,
  });
export const rejectRequest: typeof d.rejectRequest = (
  data,
  id,
  reason,
  reviewedBy,
) =>
  track(d.rejectRequest(data, id, reason, reviewedBy), {
    type: "request.reject",
    id,
    reason,
  });

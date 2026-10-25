import * as d from "../../shared/src/fleet";
import { track } from "./operations-client";
export * from "../../shared/src/fleet";
export const correctCaf: typeof d.correctCaf = (data, user, vehicle, input) =>
  track(d.correctCaf(data, user, vehicle, input), {
    type: "caf.correct",
    vehicleId: vehicle.id,
    input,
  });
export const recordPeriodicReview: typeof d.recordPeriodicReview = (
  data,
  user,
  vehicleId,
  template,
  input,
) =>
  track(d.recordPeriodicReview(data, user, vehicleId, template, input), {
    type: "review.record",
    vehicleId,
    templateId: template.id,
    input,
  });
export const addDamage: typeof d.addDamage = (data, user, vehicleId, input) =>
  track(d.addDamage(data, user, vehicleId, input), {
    type: "damage.add",
    vehicleId,
    input,
  });
export const resolveIncident: typeof d.resolveIncident = (
  data,
  user,
  incident,
  notes,
  orderId,
) =>
  track(d.resolveIncident(data, user, incident, notes, orderId), {
    type: "incident.resolve",
    vehicleId: incident.busId,
    sourceId: incident.sourceId,
    notes,
    orderId,
  });

import * as d from "../../shared/src/unit-records";
import { track } from "./operations-client";
export * from "../../shared/src/unit-records";
export const addExternalService: typeof d.addExternalService = (
  data,
  user,
  vehicleId,
  input,
) =>
  track(d.addExternalService(data, user, vehicleId, input), {
    type: "external.record",
    vehicleId,
    input,
  });
export const decideCirculation: typeof d.decideCirculation = (
  data,
  user,
  vehicleId,
  status,
) =>
  track(d.decideCirculation(data, user, vehicleId, status), {
    type: "circulation.decide",
    vehicleId,
    status,
  });

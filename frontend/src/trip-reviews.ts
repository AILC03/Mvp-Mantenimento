import * as d from "../../shared/src/trip-reviews";
import { track, persistTracked } from "./operations-client";
export * from "../../shared/src/trip-reviews";
export const persistTripCases = (value: d.TripCase[]) =>
  persistTracked(value, () => d.persistTripCases(value));
export const startTripCase: typeof d.startTripCase = (
  cases,
  user,
  input,
  vehicles,
) => {
  const next = d.startTripCase(cases, user, input, vehicles);
  return track(next, { type: "trip.start", input, clientId: next[0].id });
};
export const submitTripInspection: typeof d.submitTripInspection = (
  cases,
  user,
  id,
  stage,
  answers,
  notes,
  template,
) =>
  track(
    d.submitTripInspection(cases, user, id, stage, answers, notes, template),
    {
      type: "trip.submit",
      id,
      stage,
      answers,
      notes,
      templateId: template?.id,
    },
  );
export const closeTripCase: typeof d.closeTripCase = (cases, user, id, notes) =>
  track(d.closeTripCase(cases, user, id, notes), {
    type: "trip.close",
    id,
    notes,
  });

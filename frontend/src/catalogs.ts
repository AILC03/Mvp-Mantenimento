import * as d from "../../shared/src/catalogs";
import { track, persistTracked, remoteEnabled } from "./operations-client";
export * from "../../shared/src/catalogs";
export const loadCatalogs = () => d.loadCatalogs(undefined, remoteEnabled());
export const persistCatalogs = (value: d.Catalogs) =>
  persistTracked(value, () => d.persistCatalogs(value));
export const saveVehicle: typeof d.saveVehicle = (data, input, id) => {
  const next = d.saveVehicle(data, input, id);
  return track(next, {
    type: "vehicle.save",
    input,
    id,
    clientId: id ?? next.vehicles.at(-1)!.id,
  });
};
export const saveProduct: typeof d.saveProduct = (data, input, initial, id) => {
  const next = d.saveProduct(data, input, initial, id);
  return track(next, {
    type: "product.save",
    input,
    initial,
    id,
    clientId: id ?? next.products.at(-1)!.id,
  });
};
export const addStockEntry: typeof d.addStockEntry = (data, id, input) =>
  track(d.addStockEntry(data, id, input), { type: "stock.add", id, input });
export const saveService: typeof d.saveService = (data, input, id) => {
  const next = d.saveService(data, input, id);
  return track(next, {
    type: "service.save",
    input,
    id,
    clientId: id ?? next.services.at(-1)!.id,
  });
};
export const saveReview: typeof d.saveReview = (data, input, id) => {
  const next = d.saveReview(data, input, id);
  return track(next, {
    type: "review.save",
    input,
    id,
    clientId: id ?? next.reviews.at(-1)!.id,
  });
};

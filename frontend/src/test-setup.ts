import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { setDomainStorage } from "../../shared/src/storage";
import { stopOperations } from "./operations-client";

setDomainStorage(localStorage); // Adaptador antiguo SOLO para pruebas del dominio.

Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  value: function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  },
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  value: function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  },
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  stopOperations();
  localStorage.clear();
});

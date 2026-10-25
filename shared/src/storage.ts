// Cache en memoria, no persistencia. El navegador nunca es la fuente de verdad.
export interface DomainStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const memory = new Map<string, string>();
let storage: DomainStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
};
export const domainStorage = () => storage;
// Inyección explícita para pruebas; no se usa almacenamiento de navegador en producción.
export function setDomainStorage(value: DomainStorage) {
  storage = value;
}

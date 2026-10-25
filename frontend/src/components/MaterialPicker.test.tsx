import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaterialPicker, MATERIAL_PAGE_SIZE } from "./MaterialPicker";
import { products } from "../data";

test("thousands of articles are paginated and a name search finds an article on a later page", async () => {
  const articles = Array.from({ length: 3000 }, (_, index) => ({
    ...products[0],
    id: String(index),
    sku: `ART-${index}`,
    name: `Artículo de prueba ${index}`,
  }));
  const confirm = vi.fn();
  const user = userEvent.setup();
  render(
    <MaterialPicker
      products={articles}
      excludedIds={[]}
      onConfirm={confirm}
      onClose={() => {}}
    />,
  );
  expect(screen.getAllByRole("checkbox")).toHaveLength(MATERIAL_PAGE_SIZE);
  await user.type(
    screen.getByLabelText("Buscar material por nombre o código"),
    "articulo de prueba 2999",
  );
  await user.click(
    screen.getByRole("checkbox", {
      name: "Seleccionar Artículo de prueba 2999",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Agregar selección (1)" }),
  );
  expect(confirm).toHaveBeenCalledWith([articles[2999]]);
});

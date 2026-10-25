import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../testing/WorkbenchHarness";
import { defaultCatalogs, persistCatalogs } from "../catalogs";
import { TRIP_CASES_KEY } from "../trip-reviews";

test("driver completes pre/post, mechanic reviews the captures and closes the case", async () => {
  const data = defaultCatalogs();
  data.reviews.find((item) => item.id === "trip")!.aspects = [
    { id: "a1", text: "Aspecto indicado por el usuario" },
  ];
  persistCatalogs(data);
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "driver",
  );
  await user.click(screen.getByRole("button", { name: "Revisiones" }));
  await user.click(
    screen.getByRole("button", { name: "Iniciar caso de revisión" }),
  );
  await user.selectOptions(
    screen.getByLabelText(/^Autobús del viaje/),
    "BUS015",
  );
  fireEvent.change(screen.getByLabelText(/^Fecha de ida/), {
    target: { value: "2026-11-01" },
  });
  fireEvent.change(screen.getByLabelText(/^Fecha de regreso/), {
    target: { value: "2026-11-02" },
  });
  await user.click(screen.getByRole("button", { name: "Iniciar caso" }));
  await user.click(screen.getByRole("button", { name: /Realizar pre trip/ }));
  await user.click(screen.getByRole("radio", { name: "Con falla" }));
  await user.click(
    screen.getByRole("button", { name: /Enviar revisión pre trip/ }),
  );
  expect(JSON.parse(localStorage.getItem(TRIP_CASES_KEY)!)[0].post).toBeNull();
  await user.click(screen.getByRole("button", { name: /Realizar post trip/ }));
  await user.click(screen.getByRole("radio", { name: "Bien" }));
  await user.click(
    screen.getByRole("button", { name: /Enviar revisión post trip/ }),
  );
  expect(
    JSON.parse(localStorage.getItem(TRIP_CASES_KEY)!)[0].closedAt,
  ).toBeNull();
  await user.selectOptions(
    screen.getByLabelText("Perfil de demostración"),
    "mechanic",
  );
  await user.click(screen.getByRole("button", { name: "Revisiones" }));
  await user.click(screen.getByRole("button", { name: /Revisar y cerrar/ }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByText("Con falla", { exact: true }),
  ).toBeInTheDocument();
  expect(
    within(dialog).queryByRole("button", { name: /Rechazar/ }),
  ).not.toBeInTheDocument();
  await user.click(
    within(dialog).getByRole("button", { name: "Cierre de caso" }),
  );
  const closed = JSON.parse(localStorage.getItem(TRIP_CASES_KEY)!)[0];
  expect(closed.closedBy.id).toBe("mechanic-demo");
  expect(closed.pre.answers.a1).toBe("fault");
  expect(closed.post.answers.a1).toBe("good");
});

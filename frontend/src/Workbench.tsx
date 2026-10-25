import { useEffect, useState, type FormEvent } from "react";
import {
  currentSnapshot,
  executeCommand,
  remoteEnabled,
  track,
} from "./operations-client";
import { domainStorage } from "../../shared/src/storage";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  BusFront,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import {
  currency,
  emptyForm,
  isOrderForm,
  maintenanceLabel,
  materialTotal,
  technicians,
  validateOrder,
  type OrderForm,
  type OrderService,
  type SavedOrder,
  type CatalogService,
} from "./data";
import { Modal } from "./components/Modal";
import { ServiceRequests } from "./components/ServiceRequests";
import {
  CatalogManager,
  ServiceCreationPage,
  type CommitCatalogs,
} from "./components/CatalogManager";
import {
  defaultCatalogs,
  loadCatalogs,
  persistCatalogs,
  type CatalogSection,
} from "./catalogs";
import {
  convertRequest,
  loadWorkbench,
  persistWorkbench,
  rejectRequest,
  validateRequest,
  type RequestInput,
  type ServiceRequest,
} from "./requests";
import { ApiError, roleLabels, type AuthUser } from "./auth";
import { TripReviews } from "./components/TripReviews";
import { OrdersView, type CommitWorkbench } from "./components/OrdersView";
import { VehicleHistory } from "./components/VehicleHistory";
import { PeriodicReviews } from "./components/PeriodicReviews";
import { availableStock } from "./orders";
import { MaterialPicker } from "./components/MaterialPicker";

const DRAFT_KEY = "real-ejecutivo.demo.draft.v1";
const catalogPages = {
  materials: {
    title: "Artículos de almacén",
    description:
      "Da de alta artículos, registra entradas y conserva sus costos históricos.",
  },
  vehicles: {
    title: "Autobuses y camiones",
    description:
      "Organiza la flota con una ficha independiente para cada unidad.",
  },
  services: {
    title: "Tipos de servicio",
    description:
      "Define los trabajos del taller, sus materiales y las unidades compatibles.",
  },
  reviews: {
    title: "Tipos de revisión",
    description:
      "Escribe los aspectos que tu equipo evaluará como Bien o Con falla.",
  },
};

export default function Workbench({
  user,
  onLogout,
  signingOut = false,
  authNotice = "",
}: {
  user: AuthUser;
  onLogout: () => Promise<void>;
  signingOut?: boolean;
  authNotice?: string;
}) {
  const [view, setView] = useState<
    | "create"
    | "orders"
    | "requests"
    | "trip-reviews"
    | "new-service"
    | "vehicle-history"
    | CatalogSection
  >(user.role === "WAREHOUSE_CLERK" ? "materials" : "requests");
  const role =
    user.role === "DRIVER"
      ? "driver"
      : user.role === "WAREHOUSE_CLERK"
        ? "warehouse"
        : user.role === "ADMIN"
          ? "admin"
          : "mechanic";
  const canManageWork = role === "mechanic" || role === "admin";
  const draftKey = `${DRAFT_KEY}.${user.id}`;
  const [initialCatalogs] = useState(() => {
    try {
      return { data: loadCatalogs(), error: "" };
    } catch (error) {
      return {
        data: defaultCatalogs(),
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron leer los catálogos.",
      };
    }
  });
  const [catalogData, setCatalogData] = useState(initialCatalogs.data);
  const buses = catalogData.vehicles;
  const products = catalogData.products;
  const catalog = catalogData.services;
  const catalogSection = view in catalogPages ? (view as CatalogSection) : null;
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [initialWorkbench] = useState(() => {
    try {
      return { data: loadWorkbench(), error: "" };
    } catch (error) {
      return {
        data: { orders: [], requests: [] } as ReturnType<typeof loadWorkbench>,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo leer la operación.",
      };
    }
  });
  const [workbench, setWorkbench] = useState(initialWorkbench.data);
  const [vehicleId, setVehicleId] = useState("");
  const [focusedOrderId, setFocusedOrderId] = useState<string | undefined>();
  const [orderPicker, setOrderPicker] = useState<{
    serviceId: string;
    materialId?: string;
  } | null>(null);
  const stockBalances = Object.fromEntries(
    products.map((product) => [
      product.id,
      availableStock(product, workbench.orders),
    ]),
  );
  const canSeeCatalog = (section: CatalogSection) =>
    role === "admin" ||
    (role === "warehouse" && section === "materials") ||
    (role === "mechanic" && (section === "vehicles" || section === "services"));
  const canEditCatalog = (section: CatalogSection) =>
    role === "admin" ||
    (role === "warehouse" && section === "materials") ||
    (role === "mechanic" && section === "services");
  const orders = workbench.orders;
  const sourceRequest = workbench.requests.find(
    (request) => request.id === form.sourceRequestId,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState<
    "catalog" | "preview" | "history" | "cancel" | "report" | null
  >(null);
  const [query, setQuery] = useState("");
  const [serviceOrigin, setServiceOrigin] = useState<{ token: string } | null>(
    null,
  );
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => {
    if (!mobileNav) return;
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-controls="workspace-navigation"]',
    );
    const navigation = document.getElementById("workspace-navigation");
    navigation?.querySelector<HTMLButtonElement>("nav button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNav(false);
        trigger?.focus();
      }
      if (
        event.key === "Tab" &&
        window.innerWidth <= 768 &&
        navigation &&
        trigger
      ) {
        const controls = [
          ...navigation.querySelectorAll<HTMLElement>(
            "a[href],button:not([disabled])",
          ),
          trigger,
        ];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      if (navigation?.contains(document.activeElement)) trigger?.focus();
    };
  }, [mobileNav]);
  const bus = buses.find((item) => item.id === form.busId);
  const hours = form.services.reduce(
    (sum, service) =>
      sum + (Number.isFinite(service.hours) ? service.hours : 0),
    0,
  );
  const total = materialTotal(form.services, products);
  const readyCount = [
    Boolean(bus),
    Boolean(form.odometer.trim()) &&
      Number.isSafeInteger(Number(form.odometer)) &&
      Number(form.odometer) >= 0,
    Boolean(form.services.length),
  ].filter(Boolean).length;

  useEffect(() => {
    if (errors.length) document.getElementById("form-errors")?.focus();
  }, [errors]);

  useEffect(() => {
    document.title = `${view === "vehicle-history" ? "Historial de unidad" : view === "trip-reviews" ? "Revisiones" : view === "new-service" ? "Nuevo tipo de servicio" : catalogSection ? catalogPages[catalogSection].title : view === "requests" ? "Solicitudes de servicio" : view === "create" ? "Nueva orden" : "Órdenes de trabajo"} · Real Ejecutivo`;
  }, [view]);

  function update<K extends keyof OrderForm>(field: K, value: OrderForm[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setMessage("");
  }

  function updateService(id: string, change: Partial<OrderService>) {
    update(
      "services",
      form.services.map((service) =>
        service.id === id ? { ...service, ...change } : service,
      ),
    );
  }

  function orderService(item: CatalogService): OrderService {
    return {
      id: crypto.randomUUID(),
      catalogId: item.id,
      name: item.name,
      category: item.category,
      hours: item.hours,
      assignee: "",
      instructions: item.description,
      materials: item.materials.map((material) => ({
        ...material,
        id: crypto.randomUUID(),
        unitCost:
          products.find((product) => product.id === material.productId)?.cost ??
          0,
      })),
    };
  }

  function addService(catalogId: string) {
    const item = catalog.find((service) => service.id === catalogId);
    if (!item) return;
    if (
      item.compatibleVehicleIds.length &&
      !item.compatibleVehicleIds.includes(form.busId)
    )
      return;
    if (form.services.some((service) => service.catalogId === item.id)) return;
    update("services", [...form.services, orderService(item)]);
    setModal(null);
    setQuery("");
  }

  function createServiceFromOrder() {
    if (!canManageWork) return;
    setServiceOrigin({ token: crypto.randomUUID() });
    setModal(null);
    setErrors([]);
    setMessage("");
    setView("new-service");
  }

  function returnToOrder(service?: CatalogService, token?: string) {
    if (!serviceOrigin || (token && serviceOrigin.token !== token)) return;
    if (service) {
      const compatible =
        !service.compatibleVehicleIds.length ||
        service.compatibleVehicleIds.includes(form.busId);
      if (compatible) {
        setForm((previous) => ({
          ...previous,
          services: previous.services.some(
            (item) => item.catalogId === service.id,
          )
            ? previous.services
            : [...previous.services, orderService(service)],
        }));
        setMessage(
          "Servicio creado y agregado. Se conservaron los datos de tu orden.",
        );
      } else
        setMessage(
          "Servicio creado en el catálogo. No se agregó porque no es compatible con la unidad de esta orden. Los demás datos se conservaron.",
        );
    }
    setServiceOrigin(null);
    setView("create");
  }

  function selectRequest(id: string) {
    const request = workbench.requests.find(
      (item) => item.id === id && item.status === "pending",
    );
    if (!id) {
      setForm((previous) => ({
        ...previous,
        sourceRequestId: undefined,
        reason: "",
      }));
      return;
    }
    if (!request) return;
    setForm((previous) => ({
      ...previous,
      sourceRequestId: request.id,
      busId: request.busId,
      reason: `Solicitud ${request.number}`,
      odometer:
        request.odometer ||
        (previous.busId === request.busId ? previous.odometer : ""),
    }));
  }

  async function saveDraft() {
    if (!isOrderForm(form)) {
      setErrors([
        "Completa las cantidades y los tiempos antes de guardar el borrador.",
      ]);
      return;
    }
    try {
      if (remoteEnabled()) await executeCommand({ type: "draft.save", form });
      else domainStorage().setItem(draftKey, JSON.stringify(form));
      setMessage(
        "Borrador guardado. Disponible para tu usuario al volver a entrar.",
      );
      setErrors([]);
    } catch {
      setErrors([
        "No se pudo guardar el borrador. Conserva el formulario e intenta de nuevo.",
      ]);
    }
  }

  function restoreDraft() {
    try {
      const draft: unknown = remoteEnabled()
        ? currentSnapshot()?.draft
        : JSON.parse(domainStorage().getItem(draftKey) ?? "null");
      if (!isOrderForm(draft)) throw new Error();
      if (
        draft.services.some((service) =>
          service.materials.some(
            (material) =>
              !products.some((product) => product.id === material.productId),
          ),
        )
      )
        throw new Error();
      setForm(draft);
      setMessage(
        "Borrador recuperado. Revisa los datos antes de crear la orden.",
      );
      setErrors([]);
    } catch {
      setErrors(["No hay un borrador compatible para recuperar."]);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canManageWork) return;
    const validation = validateOrder(form, buses, products, catalog);
    setErrors(validation);
    setMessage("");
    if (validation.length) {
      return;
    }
    const now = new Date();
    let latest: ReturnType<typeof loadWorkbench>;
    try {
      latest = loadWorkbench();
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "No se pudo leer la operación.",
      ]);
      return;
    }
    const sequence = String(latest.orders.length + 1).padStart(4, "0");
    const order: SavedOrder = {
      id: crypto.randomUUID(),
      number: `DEMO-${bus?.fleetNumber ?? form.busId}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}-${sequence}`,
      createdAt: now.toISOString(),
      status: "Lista para iniciar",
      createdBy: { id: user.id, name: user.name },
      events: [
        {
          id: crypto.randomUUID(),
          at: now.toISOString(),
          actorId: user.id,
          actorName: user.name,
          action: "Creada",
          notes: "Lista para iniciar sin liberación adicional.",
        },
      ],
      form: {
        ...structuredClone(form),
        services: form.services.map((service) => ({
          ...structuredClone(service),
          materials: service.materials.map((material) => ({
            ...material,
            unitCost:
              material.unitCost ??
              products.find((product) => product.id === material.productId)
                ?.cost ??
              0,
          })),
        })),
      },
    };
    try {
      if (sourceRequest && sourceRequest.busId !== form.busId)
        throw new Error("La unidad debe coincidir con la solicitud de origen.");
      const next = convertRequest(latest, order, user.id);
      await persistWorkbench(next);
      setWorkbench(loadWorkbench());
      setFocusedOrderId(undefined);
      setView("orders");
      setForm(emptyForm());
      setMessage(
        `Orden ${loadWorkbench().orders.find((item) => item.id === order.id)?.number ?? order.number} lista para iniciar, sin liberación adicional. No autoriza circulación.`,
      );
    } catch (error) {
      setErrors([
        error instanceof ApiError ||
        (error instanceof Error && error.message.startsWith("La solicitud"))
          ? error.message
          : "No se pudo guardar la orden. El formulario se conserva para que vuelvas a intentarlo.",
      ]);
    }
  }

  function newOrder() {
    if (!canManageWork) return;
    setForm(emptyForm());
    setFocusedOrderId(undefined);
    setServiceOrigin(null);
    setErrors([]);
    setMessage("");
    setView("create");
    setMobileNav(false);
  }

  async function sendRequest(input: RequestInput): Promise<boolean> {
    if (role !== "driver" || validateRequest(input, buses).length) return false;
    try {
      const latest = loadWorkbench();
      const id = crypto.randomUUID();
      const request: ServiceRequest = {
        ...input,
        title: input.title.trim(),
        description: input.description.trim(),
        id,
        number: `SOL-DEMO-${id.slice(0, 8).toUpperCase()}`,
        driverId: user.id,
        driverName: user.name,
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      const next = track(
        { ...latest, requests: [request, ...latest.requests] },
        { type: "request.create", input, clientId: id },
      );
      await persistWorkbench(next);
      setWorkbench(loadWorkbench());
      setErrors([]);
      setMessage(
        "Solicitud guardada y disponible para revisión del mecánico. Aún no es una orden de mantenimiento.",
      );
      return true;
    } catch (error) {
      setErrors([
        error instanceof ApiError
          ? error.message
          : "No se pudo guardar la solicitud. Tu reporte se conserva para volver a intentarlo.",
      ]);
      setMessage("");
      return false;
    }
  }

  function prepareRequest(request: ServiceRequest) {
    if (!canManageWork || request.status !== "pending") return;
    setForm({
      ...emptyForm(),
      sourceRequestId: request.id,
      busId: request.busId,
      reason: `Solicitud ${request.number}`,
      odometer: request.odometer,
    });
    setErrors([]);
    setMessage("");
    setServiceOrigin(null);
    setView("create");
  }

  async function reject(id: string, reason: string): Promise<string | null> {
    if (!canManageWork) return "Solo el mecánico puede revisar solicitudes.";
    try {
      const next = rejectRequest(loadWorkbench(), id, reason, user.id);
      await persistWorkbench(next);
      setWorkbench(loadWorkbench());
      setMessage(
        "Solicitud rechazada. El motivo queda disponible para el chofer.",
      );
      setErrors([]);
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "No se pudo guardar la revisión.";
    }
  }

  const commitCatalogs: CommitCatalogs = async (updateCatalogs, message) => {
    const target = view === "new-service" ? "services" : catalogSection;
    if (!target || !canEditCatalog(target))
      return "Tu perfil no puede modificar este catálogo. Solo admin edita unidades y tipos de revisión.";
    try {
      const next = updateCatalogs(loadCatalogs());
      await persistCatalogs(next);
      setCatalogData(loadCatalogs());
      setMessage(message);
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "No se pudo guardar el catálogo en el servidor.";
    }
  };

  const commitWorkbench: CommitWorkbench = async (change, success) => {
    try {
      const next = change(loadWorkbench());
      await persistWorkbench(next);
      setWorkbench(loadWorkbench());
      setMessage(success);
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "No se pudo confirmar el registro.";
    }
  };

  return (
    <div className="app-shell visual-refresh" data-page={view}>
      <a className="skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      {mobileNav && (
        <button
          type="button"
          className="mobile-nav-scrim"
          aria-label="Cerrar menú de navegación"
          onClick={() => {
            setMobileNav(false);
            document
              .querySelector<HTMLButtonElement>(
                '[aria-controls="workspace-navigation"]',
              )
              ?.focus();
          }}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${mobileNav ? "is-open" : ""}`}
      >
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setView(role === "warehouse" ? "materials" : "requests");
            setServiceOrigin(null);
            setMobileNav(false);
          }}
          aria-label="Real Ejecutivo, solicitudes"
        >
          <span className="brand-symbol">
            <ArrowDownLeft size={31} strokeWidth={3} aria-hidden="true" />
          </span>
          <span>
            REAL EJECUTIVO<small>CONTROL DE MANTENIMIENTO</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            <BusFront size={20} aria-hidden="true" />
          </span>
          <div>
            Operación de flota<small>Real Ejecutivo</small>
          </div>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
        <span className="nav-label">ESPACIO DE TRABAJO</span>
        <nav aria-label="Navegación principal">
          <span className="nav-item disabled" aria-disabled="true">
            <LayoutDashboard size={18} aria-hidden="true" /> Resumen{" "}
            <small>Próximamente</small>
          </span>
          {role !== "warehouse" && (
            <button
              className={`nav-item ${view === "requests" ? "active" : ""}`}
              aria-current={view === "requests" ? "page" : undefined}
              onClick={() => {
                setView("requests");
                setServiceOrigin(null);
                setErrors([]);
                setMobileNav(false);
              }}
            >
              <MessageSquare size={18} aria-hidden="true" /> Solicitudes de
              servicio{" "}
            </button>
          )}
          {role !== "warehouse" && (
            <button
              className={`nav-item ${view === "trip-reviews" ? "active" : ""}`}
              aria-current={view === "trip-reviews" ? "page" : undefined}
              onClick={() => {
                setServiceOrigin(null);
                setView("trip-reviews");
                setErrors([]);
                setMessage("");
                setMobileNav(false);
              }}
            >
              <CheckCheck size={18} aria-hidden="true" />
              Revisiones
            </button>
          )}
          {(canManageWork || role === "warehouse") && (
            <button
              className={`nav-item ${view === "orders" || view === "create" ? "active" : ""}`}
              aria-current={
                view === "orders" || view === "create" ? "page" : undefined
              }
              onClick={() => {
                if (view === "create") setModal("cancel");
                else setView("orders");
                setFocusedOrderId(undefined);
                setServiceOrigin(null);
                setMobileNav(false);
              }}
            >
              <ClipboardList size={18} aria-hidden="true" /> Órdenes de
              trabajo{" "}
            </button>
          )}
          {(canManageWork || role === "warehouse") &&
            (
              [
                ["vehicles", "Unidades", BusFront],
                ["materials", "Artículos de almacén", Package],
                ["services", "Tipos de servicio", Wrench],
                ["reviews", "Tipos de revisión", CheckCheck],
              ] as const
            )
              .filter(([section]) => canSeeCatalog(section))
              .map(([section, label, Icon]) => (
                <button
                  className={`nav-item ${view === section ? "active" : ""}`}
                  aria-current={view === section ? "page" : undefined}
                  key={section}
                  onClick={() => {
                    setView(section);
                    setServiceOrigin(null);
                    setErrors([]);
                    setMessage("");
                    setMobileNav(false);
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </button>
              ))}
        </nav>
        <div className="sidebar-note">
          <span className="online-dot" /> Tu taller, en orden.
          <p>
            Más control. Menos tiempo
            <br />
            fuera de servicio.
          </p>
          <Wrench size={23} />
        </div>
        <div className="sidebar-bottom">
          <span>
            <CircleHelp size={17} /> Operación de mantenimiento
          </span>
          <span>
            <Settings2 size={17} /> Datos en PostgreSQL
          </span>
        </div>
        <div className="profile">
          <span className="avatar">
            {user.name
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")}
          </span>
          <div>
            {user.name}
            <small>{roleLabels[user.role]}</small>
          </div>
          <span className="profile-dot" />
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileNav(!mobileNav)}
              aria-label={mobileNav ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileNav}
              aria-controls="workspace-navigation"
            >
              <Menu size={21} aria-hidden="true" />
            </button>
            <Wrench size={16} aria-hidden="true" />
            <span>Mantenimiento</span>
            <ChevronRight size={13} aria-hidden="true" />
            <strong>
              {view === "vehicle-history"
                ? "Historial de unidad"
                : view === "trip-reviews"
                  ? "Revisiones"
                  : view === "new-service"
                    ? "Nuevo tipo de servicio"
                    : catalogSection
                      ? catalogPages[catalogSection].title
                      : view === "requests"
                        ? "Solicitudes de servicio"
                        : "Órdenes de trabajo"}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="signed-in-user">
              <strong>{user.username}</strong>
              <small>{roleLabels[user.role]}</small>
            </span>
            <button
              type="button"
              className="button secondary logout-button"
              onClick={() => void onLogout()}
              disabled={signingOut}
            >
              <LogOut size={15} aria-hidden="true" />
              {signingOut ? "Saliendo…" : "Cerrar sesión"}
            </button>
            <span className="demo-tag">
              <span /> ENTORNO DEMO
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {authNotice && (
            <div className="notice error" role="alert">
              {authNotice}
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">GESTIÓN DEL TALLER</div>
              <h1>
                {view === "vehicle-history"
                  ? "Historial completo de la unidad"
                  : view === "trip-reviews"
                    ? "Revisiones"
                    : view === "new-service"
                      ? "Nuevo tipo de servicio"
                      : catalogSection
                        ? catalogPages[catalogSection].title
                        : view === "requests"
                          ? role === "driver"
                            ? "Solicitar un servicio"
                            : "Solicitudes de servicio"
                          : view === "create"
                            ? "Nueva orden de mantenimiento"
                            : "Órdenes de trabajo"}
              </h1>
              <p>
                {view === "vehicle-history"
                  ? "Servicios, revisiones, golpes, incidencias y costos registrados."
                  : view === "trip-reviews"
                    ? "Un caso por viaje: captura pre y post trip, revisión y cierre con historial."
                    : view === "new-service"
                      ? "Crea el servicio que falta sin perder la orden en la que estabas trabajando."
                      : catalogSection
                        ? catalogPages[catalogSection].description
                        : view === "requests"
                          ? role === "driver"
                            ? "Reporta lo que necesita atención. El mecánico revisará tu solicitud."
                            : "Del reporte del chofer a una decisión clara para el taller."
                          : view === "create"
                            ? "Planifica el trabajo y prepara todo lo que tu equipo necesita."
                            : "El trabajo del taller, organizado por unidad."}
              </p>
            </div>
            <span className="heading-icon" aria-hidden="true">
              <ClipboardList size={28} strokeWidth={1.4} />
            </span>
          </div>
          <div className="demo-banner">
            <span className="demo-banner-icon">
              <Eye size={16} />
            </span>
            <p>
              <strong>Sesión autenticada.</strong> La operación se guarda en el
              servidor. Recarga los datos compartidos para consultar cambios de
              otros usuarios. MVP en pruebas; no usar aún como sistema
              definitivo.
            </p>
          </div>
          {message && (
            <div className="notice success" role="status">
              <Check size={18} />
              <span>{message}</span>
              <button
                className="icon-button"
                aria-label="Cerrar aviso"
                onClick={() => setMessage("")}
              >
                <X size={17} />
              </button>
            </div>
          )}

          {initialCatalogs.error && (
            <div className="notice error" role="alert">
              {initialCatalogs.error} Se muestra solo una referencia demo; no se
              modificarán los datos incompatibles.
            </div>
          )}
          {initialWorkbench.error && (
            <div className="notice error" role="alert">
              {initialWorkbench.error}
            </div>
          )}
          {view === "vehicle-history" &&
          canManageWork &&
          buses.find((vehicle) => vehicle.id === vehicleId) ? (
            <VehicleHistory
              vehicle={buses.find((vehicle) => vehicle.id === vehicleId)!}
              user={user}
              data={workbench}
              catalogs={catalogData}
              onCommit={commitWorkbench}
              onBack={() => setView("vehicles")}
              onOpenOrder={(id) => {
                setFocusedOrderId(id);
                setView("orders");
              }}
            />
          ) : view === "trip-reviews" && role !== "warehouse" ? (
            <>
              {role === "mechanic" && (
                <PeriodicReviews
                  user={user}
                  data={workbench}
                  catalogs={catalogData}
                  onCommit={commitWorkbench}
                />
              )}
              <TripReviews
                user={user}
                vehicles={buses}
                templates={catalogData.reviews}
              />
            </>
          ) : view === "new-service" && canManageWork && serviceOrigin ? (
            <ServiceCreationPage
              key={serviceOrigin.token}
              data={catalogData}
              onCommit={commitCatalogs}
              onCancel={() => returnToOrder()}
              onCreated={(service) =>
                returnToOrder(service, serviceOrigin.token)
              }
            />
          ) : catalogSection && canSeeCatalog(catalogSection) ? (
            <CatalogManager
              key={catalogSection}
              section={catalogSection}
              data={catalogData}
              onCommit={commitCatalogs}
              canEdit={canEditCatalog(catalogSection)}
              stockBalances={stockBalances}
              onOpenVehicle={(vehicle) => {
                setVehicleId(vehicle.id);
                setView("vehicle-history");
              }}
            />
          ) : view === "requests" ? (
            <>
              {errors.length > 0 && (
                <div className="notice error" role="alert">
                  {errors.join(" ")}
                </div>
              )}
              <ServiceRequests
                showPeriodicReviews={role !== "admin"}
                driver={{ id: user.id, name: user.name }}
                vehicles={buses}
                reviews={catalogData.reviews}
                role={canManageWork ? "mechanic" : "driver"}
                requests={workbench.requests}
                orders={orders}
                onSend={sendRequest}
                onConvert={prepareRequest}
                onReject={reject}
                onNewOrder={newOrder}
              />
            </>
          ) : view === "orders" ? (
            <OrdersView
              key={`orders-${focusedOrderId ?? "list"}`}
              initialOrderId={focusedOrderId}
              user={user}
              data={workbench}
              catalogs={catalogData}
              onCommit={commitWorkbench}
              onNewOrder={newOrder}
              onResumeDraft={
                canManageWork &&
                (form.busId || form.services.length || form.reason)
                  ? () => {
                      setView("create");
                      setErrors([]);
                    }
                  : undefined
              }
            />
          ) : (
            <form onSubmit={submit} noValidate>
              {form.sourceRequestId && (
                <div className="request-origin">
                  <MessageSquare size={18} />
                  <div>
                    <strong>
                      Orden desde{" "}
                      {sourceRequest?.number ?? "solicitud vinculada"}
                    </strong>
                    <p>
                      {sourceRequest?.driverName ?? "Chofer"} · El reporte
                      original se conserva. Solo se marcará con orden al guardar
                      correctamente.
                    </p>
                  </div>
                </div>
              )}
              <div className="form-toolbar">
                <span>
                  <span className="tiny-dot" /> NUEVA ORDEN{" "}
                  <span className="toolbar-divider">/</span>{" "}
                  <span className="muted">Sin guardar</span>
                </span>
                <button
                  type="button"
                  className="text-button"
                  onClick={restoreDraft}
                >
                  <FileText size={15} /> Recuperar borrador
                </button>
              </div>
              {errors.length > 0 && (
                <div
                  className="notice error"
                  id="form-errors"
                  role="alert"
                  tabIndex={-1}
                >
                  <TriangleAlert size={20} />
                  <div>
                    <strong>Revisa los siguientes datos</strong>
                    <ul>
                      {errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="form-layout">
                <div className="form-sections">
                  <section className="card">
                    <div className="section-heading">
                      <span className="step-number">01</span>
                      <div>
                        <h2>Información general</h2>
                        <p>
                          Identifica la unidad y el motivo de la intervención.
                        </p>
                      </div>
                      <span className="required-note">* Obligatorio</span>
                    </div>
                    <div className="field-grid">
                      <label className="field full">
                        Unidad (autobús o camión){" "}
                        <span className="required">*</span>
                        <div className="input-icon">
                          <BusFront size={18} />
                          <select
                            required
                            disabled={Boolean(form.sourceRequestId)}
                            value={form.busId}
                            onChange={(event) => {
                              const selected = buses.find(
                                (item) => item.id === event.target.value,
                              );
                              setForm((previous) => ({
                                ...previous,
                                busId: event.target.value,
                                odometer: selected
                                  ? String(selected.odometer)
                                  : "",
                              }));
                              setMessage("");
                            }}
                          >
                            <option value="">Selecciona una unidad</option>
                            {buses.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.fleetNumber} ·{" "}
                                {item.type === "truck" ? "Camión" : "Autobús"} ·{" "}
                                {item.model} {item.year ?? ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>
                      <div className="field service-classification">
                        Clasificación de servicios
                        <div>
                          <ShieldCheck size={17} />
                          <strong>{maintenanceLabel(form.services)}</strong>
                        </div>
                        <small>
                          Solo CAF es preventivo. Se determina por los servicios
                          agregados.
                        </small>
                      </div>
                      <label className="field">
                        Prioridad{" "}
                        <select
                          value={form.priority}
                          onChange={(event) =>
                            update(
                              "priority",
                              event.target.value as OrderForm["priority"],
                            )
                          }
                        >
                          <option>Normal</option>
                          <option>Alta</option>
                          <option>Urgente</option>
                        </select>
                      </label>
                      <div className="field full">
                        <label htmlFor="order-request">
                          Identificador de la solicitud
                        </label>
                        <div className="order-request-picker">
                          <select
                            id="order-request"
                            value={form.sourceRequestId ?? ""}
                            onChange={(event) =>
                              selectRequest(event.target.value)
                            }
                          >
                            <option value="">
                              Sin solicitud · Orden manual
                            </option>
                            {workbench.requests
                              .filter(
                                (request) =>
                                  request.status === "pending" &&
                                  (!form.busId || request.busId === form.busId),
                              )
                              .map((request) => (
                                <option key={request.id} value={request.id}>
                                  {request.number}
                                </option>
                              ))}
                            {sourceRequest &&
                              sourceRequest.status !== "pending" && (
                                <option value={sourceRequest.id} disabled>
                                  {sourceRequest.number} · Ya atendida
                                </option>
                              )}
                          </select>
                          {sourceRequest && (
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => setModal("report")}
                            >
                              <Eye size={16} />
                              Ver reporte
                            </button>
                          )}
                        </div>
                        <small>
                          {sourceRequest
                            ? "La orden conserva el vínculo. Consulta el reporte original sin copiarlo ni modificarlo."
                            : "Las órdenes manuales, como CAF programado, pueden crearse sin una solicitud."}
                        </small>
                      </div>
                      {!form.sourceRequestId && (
                        <label className="field full">
                          Observaciones de la orden (opcional)
                          <textarea
                            maxLength={2000}
                            rows={2}
                            value={form.reason}
                            onChange={(event) =>
                              update("reason", event.target.value)
                            }
                            placeholder="Indicaciones adicionales para una orden manual"
                          />
                        </label>
                      )}
                      <label className="field">
                        Fecha programada{" "}
                        <input
                          type="date"
                          value={form.scheduledDate}
                          onChange={(event) =>
                            update("scheduledDate", event.target.value)
                          }
                        />
                        <small>Opcional. Puedes programarla después.</small>
                      </label>
                      <label className="field">
                        Odómetro actual <span className="required">*</span>
                        <div className="input-suffix">
                          <input
                            type="number"
                            required
                            min="0"
                            step="1"
                            placeholder="0"
                            value={form.odometer}
                            onChange={(event) =>
                              update("odometer", event.target.value)
                            }
                          />
                          <span>km</span>
                        </div>
                        <small>
                          {bus
                            ? "Lectura registrada. Confirma el kilometraje real."
                            : "Lectura al momento de crear la orden."}
                        </small>
                      </label>
                    </div>
                  </section>

                  <section className="card">
                    <div className="section-heading">
                      <span className="step-number">02</span>
                      <div>
                        <h2>
                          Servicios a realizar{" "}
                          <span className="count-pill">
                            {form.services.length}
                          </span>
                        </h2>
                        <p>
                          Agrega trabajos y asigna un responsable por servicio.
                        </p>
                      </div>
                    </div>
                    {form.services.length === 0 ? (
                      <div className="services-empty">
                        <span className="empty-icon">
                          <Wrench size={25} />
                        </span>
                        <h3>¿Qué vamos a trabajar?</h3>
                        <p>
                          Elige uno o varios servicios del catálogo para esta
                          unidad.
                        </p>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => setModal("catalog")}
                        >
                          <Plus size={17} /> Agregar primer servicio
                        </button>
                      </div>
                    ) : (
                      <div className="service-list">
                        {form.services.map((service, index) => (
                          <article className="service-card" key={service.id}>
                            <div className="service-title">
                              <span className="service-icon">
                                <Wrench size={17} />
                              </span>
                              <div>
                                <small>
                                  SERVICIO {String(index + 1).padStart(2, "0")}{" "}
                                  <span>
                                    · {service.category} ·{" "}
                                    {service.catalogId === "oil-change"
                                      ? "Preventivo CAF"
                                      : "Correctivo"}
                                  </span>
                                </small>
                                <h3>{service.name}</h3>
                              </div>
                              <button
                                type="button"
                                className="icon-button delete"
                                aria-label={`Eliminar ${service.name}`}
                                onClick={() =>
                                  update(
                                    "services",
                                    form.services.filter(
                                      (item) => item.id !== service.id,
                                    ),
                                  )
                                }
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                            <div className="field-grid">
                              <label className="field">
                                Responsable
                                <select
                                  value={service.assignee}
                                  onChange={(event) =>
                                    updateService(service.id, {
                                      assignee: event.target.value,
                                    })
                                  }
                                >
                                  <option value="">Por asignar</option>
                                  {technicians.map((name) => (
                                    <option key={name}>{name}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                Tiempo estimado
                                <div className="input-suffix">
                                  <input
                                    aria-label={`Horas estimadas de ${service.name}`}
                                    type="number"
                                    min="0.25"
                                    step="0.25"
                                    value={
                                      Number.isFinite(service.hours)
                                        ? service.hours
                                        : ""
                                    }
                                    onChange={(event) =>
                                      updateService(service.id, {
                                        hours:
                                          event.target.value === ""
                                            ? NaN
                                            : Number(event.target.value),
                                      })
                                    }
                                  />
                                  <span>horas</span>
                                </div>
                              </label>
                              <label className="field full">
                                Instrucciones
                                <textarea
                                  rows={2}
                                  value={service.instructions}
                                  onChange={(event) =>
                                    updateService(service.id, {
                                      instructions: event.target.value,
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <div className="materials-heading">
                              <span>
                                <Package size={14} /> Materiales estimados
                              </span>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                  setOrderPicker({ serviceId: service.id })
                                }
                              >
                                <Plus size={14} /> Agregar material
                              </button>
                            </div>
                            {service.materials.length === 0 ? (
                              <p className="no-materials">
                                Sin materiales previstos. No se descuenta
                                inventario.
                              </p>
                            ) : (
                              <div className="material-list">
                                {service.materials.map((material) => {
                                  const product = products.find(
                                    (item) => item.id === material.productId,
                                  )!;
                                  return (
                                    <div
                                      className="material-row"
                                      key={material.id}
                                    >
                                      <button
                                        type="button"
                                        className="material-name-button"
                                        aria-label={`Cambiar material ${product.name}`}
                                        onClick={() =>
                                          setOrderPicker({
                                            serviceId: service.id,
                                            materialId: material.id,
                                          })
                                        }
                                      >
                                        {product.name}
                                        <small>
                                          Buscar / cambiar en almacén
                                        </small>
                                      </button>
                                      <div className="quantity">
                                        <input
                                          aria-label={`Cantidad de ${product.name}`}
                                          type="number"
                                          min={
                                            product.unit === "pza"
                                              ? "1"
                                              : "0.001"
                                          }
                                          step={
                                            product.unit === "pza"
                                              ? "1"
                                              : "0.001"
                                          }
                                          value={
                                            Number.isFinite(material.quantity)
                                              ? material.quantity
                                              : ""
                                          }
                                          onChange={(event) =>
                                            updateService(service.id, {
                                              materials: service.materials.map(
                                                (item) =>
                                                  item.id === material.id
                                                    ? {
                                                        ...item,
                                                        quantity:
                                                          event.target.value ===
                                                          ""
                                                            ? NaN
                                                            : Number(
                                                                event.target
                                                                  .value,
                                                              ),
                                                      }
                                                    : item,
                                              ),
                                            })
                                          }
                                        />
                                        <span>{product.unit}</span>
                                      </div>
                                      <span className="material-cost">
                                        {currency(
                                          (material.unitCost ?? product.cost) *
                                            (Number.isFinite(material.quantity)
                                              ? material.quantity
                                              : 0),
                                        )}
                                      </span>
                                      <button
                                        type="button"
                                        className="icon-button delete"
                                        aria-label={`Eliminar material ${product.name}`}
                                        onClick={() =>
                                          updateService(service.id, {
                                            materials: service.materials.filter(
                                              (item) => item.id !== material.id,
                                            ),
                                          })
                                        }
                                      >
                                        <X size={15} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                    {form.services.length > 0 && (
                      <button
                        type="button"
                        className="add-service"
                        onClick={() => setModal("catalog")}
                      >
                        <Plus size={17} /> Agregar otro servicio
                      </button>
                    )}
                    <div className="section-footnote">
                      <CircleHelp size={14} /> Materiales y compatibilidad
                      definidos en «Tipos de servicio». Los guardados requieren
                      confirmación del servidor.
                    </div>
                  </section>
                  <div className="safety-note">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>
                        Crear una orden no autoriza la circulación.
                      </strong>
                      <p>
                        La liberación del trabajo y la disponibilidad técnica
                        del autobús son decisiones independientes.
                      </p>
                    </div>
                  </div>
                </div>

                <aside className="order-summary">
                  <div className="card summary-card">
                    <div className="summary-heading">
                      <span className="eyebrow">VISTA GENERAL</span>
                      <span className="badge neutral">Por crear</span>
                    </div>
                    <h2>Resumen de la orden</h2>
                    <div className="bus-preview">
                      <div className="bus-illustration">
                        <BusFront size={64} strokeWidth={1} />
                        <span className="illustration-line" />
                      </div>
                      <div>
                        <strong>
                          {bus?.fleetNumber ?? "Sin unidad seleccionada"}
                        </strong>
                        <p>
                          {bus
                            ? `${bus.model || "Modelo sin especificar"}${bus.year ? ` · ${bus.year}` : ""}`
                            : "Selecciona un autobús para comenzar"}
                        </p>
                        {bus && <small>{bus.plate} · Datos ficticios</small>}
                      </div>
                    </div>
                    {bus && (
                      <button
                        type="button"
                        className="history-link"
                        onClick={() => setModal("history")}
                      >
                        <FileText size={15} /> Consultar contexto de la unidad{" "}
                        <ArrowRight size={14} />
                      </button>
                    )}
                    <dl className="summary-details">
                      <div>
                        <dt>Clasificación</dt>
                        <dd>{maintenanceLabel(form.services)}</dd>
                      </div>
                      <div>
                        <dt>Prioridad</dt>
                        <dd>
                          <span
                            className={`priority-dot ${form.priority.toLowerCase()}`}
                          />
                          {form.priority}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <Wrench size={14} /> Servicios
                        </dt>
                        <dd>{form.services.length}</dd>
                      </div>
                      <div>
                        <dt>
                          <Clock3 size={14} /> Tiempo de trabajo estimado
                        </dt>
                        <dd>{hours} h</dd>
                      </div>
                    </dl>
                    <div className="cost-summary">
                      <span>Materiales estimados</span>
                      <strong>{currency(total)}</strong>
                      <small>MXN · Costos unitarios registrados</small>
                    </div>
                    <div className="summary-disclaimer">
                      No incluye mano de obra ni impuestos. No es una cotización
                      ni genera salidas de almacén.
                    </div>
                    <div className="progress-label">
                      <span>Preparación de la orden</span>
                      <strong>{readyCount}/3</strong>
                    </div>
                    <div className="progress-track">
                      <span style={{ width: `${(readyCount / 3) * 100}%` }} />
                    </div>
                    <ul className="preparation-list">
                      <li className={bus ? "done" : ""}>
                        <Check size={13} /> Unidad seleccionada
                      </li>
                      <li
                        className={
                          form.odometer.trim() &&
                          Number.isSafeInteger(Number(form.odometer)) &&
                          Number(form.odometer) >= 0
                            ? "done"
                            : ""
                        }
                      >
                        <Check size={13} /> Kilometraje capturado
                      </li>
                      <li className={form.services.length ? "done" : ""}>
                        <Check size={13} /> Servicios agregados
                      </li>
                    </ul>
                  </div>
                  <div className="help-card">
                    <span className="help-icon">
                      <ClipboardList size={19} />
                    </span>
                    <div>
                      <strong>¿Qué sucede después?</strong>
                      <p>
                        La orden queda lista para iniciar. El mecánico no espera
                        liberación de otra persona.
                      </p>
                      <small>
                        Desde sus detalles puedes iniciar, pausar, reanudar o
                        terminar.
                      </small>
                    </div>
                  </div>
                </aside>
              </div>
              <footer className="form-footer">
                <button
                  type="button"
                  className="text-button cancel-button"
                  onClick={() => setModal("cancel")}
                >
                  <ArrowLeft size={16} /> Volver a órdenes
                </button>
                <div>
                  <button
                    type="button"
                    className="button ghost preview-button"
                    onClick={() => setModal("preview")}
                  >
                    <Eye size={16} /> Vista previa
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={saveDraft}
                  >
                    Guardar borrador
                  </button>
                  <button type="submit" className="button primary">
                    Crear orden <ArrowRight size={17} />
                  </button>
                </div>
              </footer>
            </form>
          )}
          <div className="page-bottom">
            <span>
              REAL EJECUTIVO <span> / </span> Mantenimiento de flota
            </span>
            <span>Hecho para mantenerte en movimiento.</span>
          </div>
        </main>
      </div>

      {orderPicker && (
        <MaterialPicker
          products={products}
          balances={stockBalances}
          multiple={!orderPicker.materialId}
          excludedIds={
            form.services
              .find((service) => service.id === orderPicker.serviceId)
              ?.materials.filter(
                (material) => material.id !== orderPicker.materialId,
              )
              .map((material) => material.productId) ?? []
          }
          onClose={() => setOrderPicker(null)}
          onConfirm={(selection) => {
            setForm((previous) => ({
              ...previous,
              services: previous.services.map((service) =>
                service.id !== orderPicker.serviceId
                  ? service
                  : {
                      ...service,
                      materials: orderPicker.materialId
                        ? service.materials.map((material) =>
                            material.id === orderPicker.materialId &&
                            selection[0]
                              ? {
                                  ...material,
                                  productId: selection[0].id,
                                  unitCost: selection[0].cost,
                                }
                              : material,
                          )
                        : [
                            ...service.materials,
                            ...selection
                              .filter(
                                (product) =>
                                  !service.materials.some(
                                    (material) =>
                                      material.productId === product.id,
                                  ),
                              )
                              .map((product) => ({
                                id: crypto.randomUUID(),
                                productId: product.id,
                                quantity: 1,
                                unitCost: product.cost,
                              })),
                          ],
                    },
              ),
            }));
            setOrderPicker(null);
          }}
        />
      )}
      {modal === "catalog" && (
        <Modal title="Agregar servicio" onClose={() => setModal(null)}>
          <p className="modal-description">
            Catálogo de servicios · Selecciona el trabajo que necesita la
            unidad.
          </p>
          <div className="input-icon search-field">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Buscar servicio"
              placeholder="Buscar por nombre o categoría…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="catalog-list">
            {catalog
              .filter((item) =>
                `${item.name} ${item.category}`
                  .toLocaleLowerCase("es")
                  .includes(query.toLocaleLowerCase("es")),
              )
              .map((item) => {
                const added = form.services.some(
                  (service) => service.catalogId === item.id,
                );
                const incompatible =
                  item.compatibleVehicleIds.length > 0 &&
                  !item.compatibleVehicleIds.includes(form.busId);
                return (
                  <button
                    type="button"
                    disabled={added || incompatible}
                    key={item.id}
                    onClick={() => addService(item.id)}
                  >
                    <span className="service-icon">
                      <Wrench size={19} />
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.category} · {item.hours} h estimadas{" "}
                        {added
                          ? "· Agregado"
                          : incompatible
                            ? form.busId
                              ? "· No compatible con esta unidad"
                              : "· Selecciona una unidad compatible"
                            : ""}
                      </small>
                    </span>
                    {added ? <Check size={18} /> : <Plus size={19} />}
                  </button>
                );
              })}
            {!catalog.some((item) =>
              `${item.name} ${item.category}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) && (
              <p className="no-results">No hay servicios con esa búsqueda.</p>
            )}
          </div>
          <div className="modal-note">
            <CircleHelp size={15} /> Administra instrucciones, compatibilidad y
            materiales en «Tipos de servicio».
          </div>
          <div className="missing-service">
            <div>
              <strong>¿No encuentras el servicio?</strong>
              <p>Créalo sin perder la orden. Volverás aquí al terminar.</p>
            </div>
            <button
              type="button"
              className="button primary"
              onClick={createServiceFromOrder}
            >
              <Plus size={16} />
              Crear nuevo servicio
            </button>
          </div>
        </Modal>
      )}
      {modal === "preview" && (
        <Modal title="Vista previa de la orden" onClose={() => setModal(null)}>
          <p className="modal-description">
            Sin número definitivo · Todavía no se ha creado.
          </p>
          <dl className="preview-details">
            <div>
              <dt>Unidad</dt>
              <dd>
                {bus ? `${bus.fleetNumber} · ${bus.model}` : "Por seleccionar"}
              </dd>
            </div>
            <div>
              <dt>Solicitud</dt>
              <dd>{sourceRequest?.number ?? "Sin solicitud · Orden manual"}</dd>
            </div>
            <div>
              <dt>Programación</dt>
              <dd>{form.scheduledDate || "Sin programar"}</dd>
            </div>
            <div>
              <dt>Tipo / Prioridad</dt>
              <dd>
                {maintenanceLabel(form.services)} / {form.priority}
              </dd>
            </div>
          </dl>
          <h3>Servicios ({form.services.length})</h3>
          {form.services.map((service) => (
            <div className="preview-service" key={service.id}>
              <strong>{service.name}</strong>
              <p>
                {service.assignee || "Sin responsable"} · {service.hours || 0} h
              </p>
            </div>
          ))}
          <div className="preview-total">
            <span>Materiales estimados</span>
            <strong>{currency(total)}</strong>
          </div>
          <p className="modal-description">
            Estimación de materiales, sin mano de obra ni impuestos. No autoriza
            circulación.
          </p>
        </Modal>
      )}
      {modal === "history" && bus && (
        <Modal
          title={`Contexto de ${bus.fleetNumber}`}
          onClose={() => setModal(null)}
        >
          <p className="modal-description">
            Información ficticia. No es el historial operativo de Real
            Ejecutivo.
          </p>
          <div className="context-reading">
            <Gauge size={25} />
            <div>
              <strong>{bus.odometer.toLocaleString("es-MX")} km</strong>
              <small>Lectura registrada</small>
            </div>
          </div>
          <h3>Incidencias conocidas</h3>
          <p>{bus.note}</p>
          <div className="modal-note">
            <ShieldCheck size={18} /> Disponibilidad técnica sin verificar. Este
            prototipo no autoriza la circulación.
          </div>
        </Modal>
      )}
      {modal === "report" && sourceRequest && (
        <Modal
          title={`Reporte ${sourceRequest.number}`}
          onClose={() => setModal(null)}
        >
          <p className="modal-description">
            {sourceRequest.driverName} ·{" "}
            {buses.find((vehicle) => vehicle.id === sourceRequest.busId)
              ?.fleetNumber ?? sourceRequest.busId}
            <br />
            {new Date(sourceRequest.createdAt).toLocaleString("es-MX")}
          </p>
          <h3>{sourceRequest.title}</h3>
          <p className="request-description">{sourceRequest.description}</p>
          <div className="modal-note">
            Kilometraje reportado: {sourceRequest.odometer || "Sin capturar"}
            {sourceRequest.odometer ? " km" : ""}. Reporte original de solo
            lectura.
          </div>
        </Modal>
      )}
      {modal === "cancel" && (
        <Modal
          title="Volver al listado de órdenes"
          onClose={() => setModal(null)}
        >
          <p className="modal-description">
            El formulario se conservará mientras permanezcas en esta página.
            Guarda un borrador si quieres recuperarlo después de recargar.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Seguir editando
            </button>
            <button
              className="button primary"
              onClick={() => {
                setModal(null);
                setView("orders");
                setErrors([]);
              }}
            >
              Ir al listado <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

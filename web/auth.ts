type AuthResponse = {
  usuario: {
    nombreCompleto: string;
    correo: string;
  };
  token?: string;
  error?: string;
};

type Course = {
  id: string;
  titulo: string;
  descripcion: string | null;
  modulos: number;
  videos: number;
  estado?: "activo" | "finalizado";
  progreso?: number;
};

type CourseListResponse = {
  cursos: Course[];
  error?: string;
};

type CourseTab = "available" | "enrolled";

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`No se encontró el elemento ${id}.`);
  return element as T;
};

const loginModeButton = byId<HTMLButtonElement>("mode-login");
const registerModeButton = byId<HTMLButtonElement>("mode-register");
const loginView = byId<HTMLElement>("login-view");
const registerView = byId<HTMLElement>("register-view");
const successView = byId<HTMLElement>("success-view");
const authHeading = document.querySelector<HTMLElement>(".auth-heading");
const modeSwitch = document.querySelector<HTMLElement>(".mode-switch");
const authShell = document.querySelector<HTMLElement>(".auth-shell");
const authPanel = document.querySelector<HTMLElement>(".auth-panel");
const privacyNote = byId<HTMLElement>("privacy-note");
const authTitle = byId<HTMLHeadingElement>("auth-title");
const authDescription = byId<HTMLParagraphElement>("auth-description");
const stepOneForm = byId<HTMLFormElement>("register-step-one");
const stepTwoForm = byId<HTMLFormElement>("register-step-two");
const stepProgress = byId<HTMLDivElement>("step-progress");
const stepProgressFill = byId<HTMLSpanElement>("step-progress-fill");
const stepLabel = byId<HTMLSpanElement>("step-label");
const stepName = byId<HTMLSpanElement>("step-name");
const ageInput = byId<HTMLInputElement>("register-age");
const employmentOption = byId<HTMLDivElement>("employment-option");
const employmentAgeNote = byId<HTMLParagraphElement>("employment-age-note");
const employmentInput = byId<HTMLInputElement>("register-employment");
const loginForm = byId<HTMLFormElement>("login-form");
const dashboardTitle = byId<HTMLHeadingElement>("dashboard-title");
const dashboardCopy = byId<HTMLParagraphElement>("dashboard-copy");
const courseSearch = byId<HTMLInputElement>("course-search");
const courseList = byId<HTMLDivElement>("course-list");
const courseStatus = byId<HTMLParagraphElement>("course-status");
const coursePanel = byId<HTMLElement>("course-panel");
const courseSectionTitle = byId<HTMLHeadingElement>("course-section-title");
const courseSectionCopy = byId<HTMLParagraphElement>("course-section-copy");
const courseTabs = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-course-tab]"),
);

let accessToken: string | null = null;
let activeCourseTab: CourseTab = "available";
let courseSearchTimer: number | undefined;
let activeCourseRequest: AbortController | null = null;

function showMessage(id: string, message: string): void {
  const element = byId<HTMLParagraphElement>(id);
  element.textContent = message;
  element.hidden = message.length === 0;
}

function clearMessages(): void {
  for (const id of [
    "login-message",
    "register-step-one-message",
    "register-step-two-message",
  ]) {
    showMessage(id, "");
  }
}

function setMode(mode: "login" | "register"): void {
  successView.hidden = true;
  authHeading?.removeAttribute("hidden");
  modeSwitch?.removeAttribute("hidden");
  privacyNote.hidden = false;
  authShell?.classList.remove("auth-shell--dashboard");
  authPanel?.classList.remove("auth-panel--dashboard");
  loginView.hidden = mode !== "login";
  registerView.hidden = mode !== "register";
  loginModeButton.classList.toggle("is-active", mode === "login");
  registerModeButton.classList.toggle("is-active", mode === "register");
  loginModeButton.setAttribute("aria-pressed", String(mode === "login"));
  registerModeButton.setAttribute("aria-pressed", String(mode === "register"));
  loginModeButton.disabled = false;
  registerModeButton.disabled = false;
  authTitle.textContent = mode === "login" ? "Vuelve a conectar." : "Crea tu cuenta.";
  authDescription.textContent =
    mode === "login"
      ? "Inicia sesión para continuar tu itinerario."
      : "Solo necesitamos unos datos para empezar.";
  clearMessages();
}

function setRegistrationStep(step: 1 | 2): void {
  stepOneForm.hidden = step !== 1;
  stepTwoForm.hidden = step !== 2;
  stepLabel.textContent = `Paso ${step} de 2`;
  stepName.textContent = step === 1 ? "Tus datos" : "Edad y privacidad";
  stepProgress.setAttribute("aria-label", `Paso ${step} de 2`);
  stepProgress.setAttribute("aria-valuenow", String(step));
  stepProgress.classList.toggle("is-complete", step === 2);
  clearMessages();
  const focusTarget = step === 1 ? "register-name" : "register-age";
  window.setTimeout(() => byId<HTMLInputElement>(focusTarget).focus(), 0);
}

function updateEmploymentOption(): void {
  ageInput.setCustomValidity("");
  const value = ageInput.value;
  const age = value === "" ? null : Number(value);
  const isAdult = age !== null && Number.isInteger(age) && age >= 18 && age <= 120;
  employmentOption.hidden = !isAdult;
  employmentAgeNote.hidden = isAdult;
  if (!isAdult) employmentInput.checked = false;
}

async function postAuth(path: "login" | "register", payload: unknown): Promise<AuthResponse> {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as Partial<AuthResponse>;
  if (!response.ok) {
    throw new Error(result.error ?? "No se pudo completar la solicitud. Inténtalo de nuevo.");
  }
  return result as AuthResponse;
}

function saveSession(token: string): void {
  try {
    window.sessionStorage.setItem("480_access_token", token);
  } catch {
    // La autenticación termina correctamente aunque el navegador bloquee el almacenamiento de sesión.
  }
}

function expireSession(): void {
  try {
    window.sessionStorage.removeItem("480_access_token");
  } catch {
    // La sesión también se borra de la memoria de esta página.
  }
  accessToken = null;
  setMode("login");
  showMessage("login-message", "Tu sesión ha caducado. Inicia sesión de nuevo.");
}

function showSuccess(result: AuthResponse, created: boolean): void {
  accessToken = result.token ?? accessToken;
  loginView.hidden = true;
  registerView.hidden = true;
  successView.hidden = false;
  authHeading?.setAttribute("hidden", "true");
  modeSwitch?.setAttribute("hidden", "true");
  privacyNote.hidden = true;
  authShell?.classList.add("auth-shell--dashboard");
  authPanel?.classList.add("auth-panel--dashboard");
  loginModeButton.setAttribute("aria-pressed", "false");
  registerModeButton.setAttribute("aria-pressed", "false");
  loginModeButton.classList.remove("is-active");
  registerModeButton.classList.remove("is-active");
  loginModeButton.disabled = true;
  registerModeButton.disabled = true;
  authTitle.textContent = created ? "Cuenta creada" : "Sesión iniciada";
  authDescription.textContent = "";
  const firstName = result.usuario.nombreCompleto.trim().split(/\s+/)[0] || "";
  dashboardTitle.textContent = firstName ? `Hola, ${firstName}.` : "Hola.";
  dashboardTitle.tabIndex = -1;
  dashboardCopy.textContent = created
    ? "Tu cuenta está lista. Explora los cursos y elige por dónde empezar."
    : "Explora cursos nuevos y continúa con los que ya has empezado.";
  if (result.token) saveSession(result.token);
  activeCourseTab = "available";
  courseSearch.value = "";
  selectCourseTab("available", false);
  void loadCourses();
  dashboardTitle.focus();
}

function selectCourseTab(tab: CourseTab, reload = true): void {
  activeCourseTab = tab;
  for (const button of courseTabs) {
    const selected = button.dataset.courseTab === tab;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }

  const enrolled = tab === "enrolled";
  coursePanel.setAttribute("aria-labelledby", enrolled ? "tab-enrolled" : "tab-available");
  courseSectionTitle.textContent = enrolled
    ? "Sigue con lo que estás aprendiendo."
    : "Encuentra tu próximo curso.";
  courseSectionCopy.textContent = enrolled
    ? "Filtra tus cursos por título o descripción."
    : "Busca en el catálogo por título o descripción.";
  courseSearch.placeholder = enrolled ? "Buscar mis cursos" : "Buscar cursos";
  courseSearch.setAttribute(
    "aria-label",
    enrolled ? "Filtrar mis cursos por título o descripción" : "Filtrar cursos por título o descripción",
  );

  if (reload) void loadCourses();
}

function setCourseStatus(message: string, isError = false): void {
  courseStatus.textContent = message;
  courseStatus.setAttribute("role", isError ? "alert" : "status");
}

function renderEmptyState(query: string): void {
  const empty = document.createElement("div");
  empty.className = "course-empty";
  const title = document.createElement("h4");
  const copy = document.createElement("p");

  if (query) {
    title.textContent = "No encontramos cursos.";
    copy.textContent = `Prueba otra búsqueda para «${query}».`;
  } else if (activeCourseTab === "enrolled") {
    title.textContent = "Aún no tienes cursos inscritos.";
    copy.textContent = "Explora el catálogo y encontrarás aquí los cursos que elijas.";
    const explore = document.createElement("button");
    explore.type = "button";
    explore.className = "text-button course-empty__action";
    explore.textContent = "Ver cursos disponibles";
    explore.addEventListener("click", () => selectCourseTab("available"));
    empty.append(title, copy, explore);
    courseList.append(empty);
    return;
  } else {
    title.textContent = "Todavía no hay cursos disponibles.";
    copy.textContent = "Cuando se añadan cursos al catálogo, aparecerán aquí.";
  }

  empty.append(title, copy);
  courseList.append(empty);
}

function renderCourse(course: Course): HTMLElement {
  const card = document.createElement("article");
  card.className = "course-card";

  const top = document.createElement("div");
  top.className = "course-card__top";
  const badge = document.createElement("span");
  badge.className = "course-badge";
  badge.textContent = activeCourseTab === "enrolled"
    ? course.estado === "finalizado" ? "Finalizado" : "En curso"
    : "Disponible";
  top.append(badge);

  const title = document.createElement("h4");
  title.className = "course-card__title";
  title.textContent = course.titulo;
  const description = document.createElement("p");
  description.className = "course-card__description";
  description.textContent = course.descripcion ?? "";
  description.hidden = !course.descripcion;

  const meta = document.createElement("p");
  meta.className = "course-card__meta";
  meta.textContent = `${course.modulos} ${course.modulos === 1 ? "módulo" : "módulos"} · ${course.videos} ${course.videos === 1 ? "vídeo" : "vídeos"}`;

  card.append(top, title, description, meta);
  if (activeCourseTab === "enrolled") {
    const percent = Math.max(0, Math.min(100, course.progreso ?? 0));
    const progress = document.createElement("div");
    progress.className = "course-progress";
    const progressHeading = document.createElement("div");
    progressHeading.className = "course-progress__heading";
    const progressLabel = document.createElement("span");
    progressLabel.textContent = "Tu progreso";
    const progressValue = document.createElement("span");
    progressValue.textContent = `${percent}%`;
    progressHeading.append(progressLabel, progressValue);
    const track = document.createElement("div");
    track.className = "course-progress__track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `Progreso en ${course.titulo}`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(percent));
    const fill = document.createElement("span");
    fill.style.width = `${percent}%`;
    track.append(fill);
    progress.append(progressHeading, track);
    card.append(progress);
  } else {
    const enroll = document.createElement("button");
    enroll.type = "button";
    enroll.className = "button button--primary course-card__action";
    enroll.textContent = "Inscribirme";
    enroll.setAttribute("aria-label", `Inscribirme en ${course.titulo}`);
    enroll.addEventListener("click", () => void enrollInCourse(course, enroll));
    card.append(enroll);
  }
  return card;
}

async function loadCourses(notice = ""): Promise<void> {
  if (!accessToken) {
    setCourseStatus("No se ha podido validar la sesión. Inicia sesión de nuevo.", true);
    return;
  }

  activeCourseRequest?.abort();
  const controller = new AbortController();
  activeCourseRequest = controller;
  const search = courseSearch.value.trim();
  const endpoint = activeCourseTab === "enrolled" ? "enrolled" : "available";
  courseList.replaceChildren();
  courseList.setAttribute("aria-busy", "true");
  setCourseStatus("Cargando cursos…");

  try {
    const response = await fetch(
      `/api/courses/${endpoint}?search=${encodeURIComponent(search)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      },
    );
    const result = (await response.json().catch(() => ({}))) as CourseListResponse;
    if (controller.signal.aborted) return;
    if (response.status === 401) {
      expireSession();
      return;
    }
    if (!response.ok) throw new Error(result.error ?? "No se pudieron cargar los cursos.");

    courseList.replaceChildren();
    if (result.cursos.length === 0) {
      setCourseStatus("");
      renderEmptyState(search);
      return;
    }

    for (const course of result.cursos) courseList.append(renderCourse(course));
    const count = result.cursos.length;
    setCourseStatus(
      notice || `${count} ${count === 1 ? "curso encontrado" : "cursos encontrados"}.`,
    );
  } catch (error) {
    if (controller.signal.aborted) return;
    courseList.replaceChildren();
    setCourseStatus(
      error instanceof Error ? error.message : "No se pudieron cargar los cursos.",
      true,
    );
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "text-button course-retry";
    retry.textContent = "Volver a intentar";
    retry.addEventListener("click", () => void loadCourses());
    courseList.append(retry);
  } finally {
    if (!controller.signal.aborted) courseList.setAttribute("aria-busy", "false");
  }
}

async function enrollInCourse(course: Course, button: HTMLButtonElement): Promise<void> {
  if (!accessToken) return;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Inscribiendo…";
  try {
    const response = await fetch(`/api/courses/${encodeURIComponent(course.id)}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 401) {
      expireSession();
      return;
    }
    if (!response.ok) throw new Error(result.error ?? "No se pudo completar la inscripción.");
    courseSearch.value = "";
    selectCourseTab("enrolled", false);
    void loadCourses(`Ya estás inscrito en «${course.titulo}».`);
  } catch (error) {
    setCourseStatus(
      error instanceof Error ? error.message : "No se pudo completar la inscripción.",
      true,
    );
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = "Inscribirme";
  }
}

function setLoading(button: HTMLButtonElement, isLoading: boolean, label: string): void {
  button.disabled = isLoading;
  button.setAttribute("aria-busy", String(isLoading));
  const text = button.querySelector<HTMLElement>("span:first-child");
  if (!text) return;
  if (!text.dataset.originalLabel) text.dataset.originalLabel = text.textContent ?? "";
  text.textContent = isLoading ? label : text.dataset.originalLabel ?? "";
}

async function restoreSession(): Promise<void> {
  let token: string | null = null;
  try {
    token = window.sessionStorage.getItem("480_access_token");
  } catch {
    return;
  }
  if (!token) return;

  try {
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 401) {
        window.sessionStorage.removeItem("480_access_token");
      }
      return;
    }
    const result = (await response.json()) as Omit<AuthResponse, "token">;
    showSuccess({ ...result, token }, false);
  } catch {
    // Si la API no responde, se mantiene el formulario disponible para volver a intentarlo.
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-password-toggle]")) {
  button.addEventListener("click", () => {
    const input = byId<HTMLInputElement>(button.dataset.passwordToggle ?? "");
    const showPassword = input.type === "password";
    input.type = showPassword ? "text" : "password";
    button.textContent = showPassword ? "Ocultar" : "Mostrar";
    button.setAttribute("aria-label", showPassword ? "Ocultar contraseña" : "Mostrar contraseña");
    button.setAttribute("aria-pressed", String(showPassword));
  });
}

loginModeButton.addEventListener("click", () => setMode("login"));
registerModeButton.addEventListener("click", () => {
  setMode("register");
  setRegistrationStep(1);
});
document.querySelectorAll<HTMLButtonElement>("[data-open-register]").forEach((button) => {
  button.addEventListener("click", () => {
    setMode("register");
    setRegistrationStep(1);
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-open-login]").forEach((button) => {
  button.addEventListener("click", () => setMode("login"));
});

courseTabs.forEach((button, index) => {
  button.addEventListener("click", () => {
    selectCourseTab(button.dataset.courseTab === "enrolled" ? "enrolled" : "available");
  });
  button.addEventListener("keydown", (event: KeyboardEvent) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % courseTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + courseTabs.length) % courseTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = courseTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = courseTabs[nextIndex];
    nextTab.focus();
    selectCourseTab(nextTab.dataset.courseTab === "enrolled" ? "enrolled" : "available");
  });
});

courseSearch.addEventListener("input", () => {
  if (courseSearchTimer !== undefined) window.clearTimeout(courseSearchTimer);
  courseSearchTimer = window.setTimeout(() => void loadCourses(), 250);
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();
  if (!loginForm.reportValidity()) return;

  const button = byId<HTMLButtonElement>("login-submit");
  setLoading(button, true, "Entrando…");
  try {
    const result = await postAuth("login", {
      correo: byId<HTMLInputElement>("login-email").value.trim(),
      contrasena: byId<HTMLInputElement>("login-password").value,
    });
    showSuccess(result, false);
  } catch (error) {
    showMessage(
      "login-message",
      error instanceof Error ? error.message : "No se pudo iniciar sesión. Inténtalo de nuevo.",
    );
    byId<HTMLInputElement>("login-password").focus();
  } finally {
    setLoading(button, false, "Entrando…");
  }
});

stepOneForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearMessages();

  const nameInput = byId<HTMLInputElement>("register-name");
  const nameParts = nameInput.value.trim().replace(/\s+/g, " ").split(" ");
  const nameTooLong = nameParts[0].length > 100 || nameParts.slice(1).join(" ").length > 150;
  nameInput.setCustomValidity(
    nameInput.value.trim().length < 2
      ? "Escribe tu nombre completo."
      : nameTooLong
        ? "El nombre completo es demasiado largo."
        : "",
  );
  if (!stepOneForm.reportValidity()) return;

  const email = byId<HTMLInputElement>("register-email");
  const password = byId<HTMLInputElement>("register-password");
  if (!email.validity.valid) {
    email.focus();
    return;
  }
  if (password.value.length < 12) {
    password.setCustomValidity("La contraseña debe tener al menos 12 caracteres.");
    password.reportValidity();
    password.focus();
    return;
  }
  password.setCustomValidity("");
  setRegistrationStep(2);
});

byId<HTMLInputElement>("register-name").addEventListener("input", (event) => {
  (event.currentTarget as HTMLInputElement).setCustomValidity("");
});

byId<HTMLInputElement>("register-password").addEventListener("input", (event) => {
  (event.currentTarget as HTMLInputElement).setCustomValidity("");
});

byId<HTMLButtonElement>("back-to-step-one").addEventListener("click", () => {
  setRegistrationStep(1);
});

ageInput.addEventListener("input", updateEmploymentOption);

stepTwoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();
  if (!stepTwoForm.reportValidity()) return;

  const age = Number(ageInput.value);
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    ageInput.setCustomValidity("Escribe una edad entre 0 y 120.");
    ageInput.reportValidity();
    ageInput.focus();
    return;
  }
  ageInput.setCustomValidity("");

  const button = byId<HTMLButtonElement>("register-submit");
  setLoading(button, true, "Creando cuenta…");
  try {
    const result = await postAuth("register", {
      nombreCompleto: byId<HTMLInputElement>("register-name").value.trim(),
      correo: byId<HTMLInputElement>("register-email").value.trim(),
      contrasena: byId<HTMLInputElement>("register-password").value,
      edad: age,
      consentimientoDatos: byId<HTMLInputElement>("register-consent").checked,
      bolsaTrabajo: age >= 18 && employmentInput.checked,
    });
    showSuccess(result, true);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la cuenta. Inténtalo de nuevo.";
    if (message.toLocaleLowerCase("es").includes("correo")) {
      setRegistrationStep(1);
      showMessage("register-step-one-message", message);
      byId<HTMLInputElement>("register-email").focus();
    } else {
      showMessage("register-step-two-message", message);
    }
  } finally {
    setLoading(button, false, "Creando cuenta…");
  }
});

byId<HTMLButtonElement>("logout-button").addEventListener("click", () => {
  activeCourseRequest?.abort();
  accessToken = null;
  try {
    window.sessionStorage.removeItem("480_access_token");
  } catch {
    // El estado visual vuelve a acceso aunque el almacenamiento no esté disponible.
  }
  loginForm.reset();
  stepOneForm.reset();
  stepTwoForm.reset();
  courseSearch.value = "";
  courseList.replaceChildren();
  setCourseStatus("");
  updateEmploymentOption();
  setMode("login");
  byId<HTMLInputElement>("login-email").focus();
});

setMode(window.location.hash === "#registro" ? "register" : "login");
updateEmploymentOption();
void restoreSession();

export {};

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
  evaluacionInicialCompletada?: boolean;
};

type CourseListResponse = {
  cursos: Course[];
  error?: string;
};

type ItineraryContent = {
  id: string; titulo: string; tipo: string; url: string | null;
  duracionSegundos: number | null; orden: number; estado: string; porcentaje: number;
};
type ItineraryModule = {
  id: string; titulo: string; descripcion: string | null; orden: number;
  contenidos: ItineraryContent[];
  evaluaciones: Array<{ id: string; contenidoId: string | null; tipo: string; titulo: string; estado: string }>;
};
type ItineraryResponse = {
  curso: { id: string; titulo: string; descripcion: string | null } | null;
  modulos: ItineraryModule[];
  error?: string;
};
type InitialAssessmentQuestion = {
  id: string; enunciado: string; tipoInteraccion: string | null;
  moduloTitulo: string; contenidoTitulo: string;
  estimulo: { codigo?: string; nota?: string } | null;
  respuesta: string | null; canal: "texto" | "voz" | null;
};
type InitialAssessmentSession = {
  intentoId: string;
  evaluacion: { id: string; titulo: string; descripcion: string | null; totalPreguntas: number };
  preguntas: InitialAssessmentQuestion[];
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
const courseTabBar = courseTabs[0]?.parentElement as HTMLElement | undefined;
const itineraryView = byId<HTMLElement>("itinerary-view");
const itineraryTitle = byId<HTMLHeadingElement>("itinerary-title");
const itineraryDescription = byId<HTMLParagraphElement>("itinerary-description");
const itinerarySummary = byId<HTMLDivElement>("itinerary-summary");
const itineraryStatus = byId<HTMLParagraphElement>("itinerary-status");
const itineraryTree = byId<HTMLDivElement>("itinerary-tree");
const itineraryBack = byId<HTMLButtonElement>("itinerary-back");
const assessmentView = byId<HTMLElement>("assessment-view");
const assessmentActive = byId<HTMLElement>("assessment-active");
const assessmentCourseTitle = byId<HTMLElement>("assessment-course-title");
const assessmentQuestion = byId<HTMLDivElement>("assessment-question");
const assessmentMessage = byId<HTMLParagraphElement>("assessment-message");
const assessmentStepLabel = byId<HTMLElement>("assessment-step-label");
const assessmentStepPercent = byId<HTMLElement>("assessment-step-percent");
const assessmentProgressTrack = byId<HTMLDivElement>("assessment-progress-track");
const assessmentProgressFill = byId<HTMLSpanElement>("assessment-progress-fill");
const assessmentPrevious = byId<HTMLButtonElement>("assessment-previous");
const assessmentNext = byId<HTMLButtonElement>("assessment-next");
const assessmentComplete = byId<HTMLElement>("assessment-complete");
const assessmentResultCopy = byId<HTMLElement>("assessment-result-copy");
const assessmentOrderCopy = byId<HTMLElement>("assessment-order-copy");
const assessmentMasteredWrap = byId<HTMLElement>("assessment-mastered-wrap");
const assessmentMasteredList = byId<HTMLUListElement>("assessment-mastered-list");
const assessmentExit = byId<HTMLButtonElement>("assessment-exit");
const assessmentViewItinerary = byId<HTMLButtonElement>("assessment-view-itinerary");
const assessmentRetry = byId<HTMLButtonElement>("assessment-retry");

let accessToken: string | null = null;
let activeCourseTab: CourseTab = "available";
let courseSearchTimer: number | undefined;
let activeCourseRequest: AbortController | null = null;
let renderedCourseListKey = "";
let activeAssessmentCourse: Course | null = null;
let activeAssessment: InitialAssessmentSession | null = null;
let activeAssessmentQuestionIndex = 0;
const pendingAssessmentAnswers = new Map<string, Promise<void>>();
let assessmentSaveTimer: number | undefined;
type VoiceRecognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
type VoiceRecognitionConstructor = new () => VoiceRecognition;
let activeVoiceRecognition: VoiceRecognition | null = null;

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
    const open = document.createElement("button");
    open.type = "button";
    open.className = "button button--primary course-card__action";
    open.textContent = course.evaluacionInicialCompletada ? "Ver mi itinerario" : "Completar examen inicial";
    open.setAttribute("aria-label", `${course.evaluacionInicialCompletada ? "Ver mi itinerario" : "Completar examen inicial"} de ${course.titulo}`);
    open.addEventListener("click", () => void (course.evaluacionInicialCompletada
      ? openItinerary(course)
      : openInitialAssessment(course)));
    card.append(progress, open);
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

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function contentStateLabel(state: string): string {
  if (state === "completado" || state === "saltado") return "Completado";
  if (state === "en_curso") return "En curso";
  return "Pendiente";
}

function renderAssessmentQuestion(): void {
  if (!activeAssessment) return;
  const question = activeAssessment.preguntas[activeAssessmentQuestionIndex];
  const total = activeAssessment.preguntas.length;
  const current = activeAssessmentQuestionIndex + 1;
  const percent = Math.round((current / total) * 100);
  assessmentStepLabel.textContent = `Contenido ${current} de ${total}`;
  assessmentStepPercent.textContent = `${percent}%`;
  assessmentProgressTrack.setAttribute("aria-valuenow", String(percent));
  assessmentProgressFill.style.width = `${percent}%`;
  assessmentQuestion.replaceChildren();
  assessmentMessage.textContent = "";
  assessmentMessage.setAttribute("role", "status");
  assessmentRetry.hidden = true;

  if (activeVoiceRecognition) {
    activeVoiceRecognition.stop();
    activeVoiceRecognition = null;
  }
  const card = document.createElement("article");
  card.className = "assessment-question__card";
  const context = document.createElement("div");
  context.className = "assessment-question__context";
  const moduleLabel = document.createElement("span");
  moduleLabel.textContent = question.moduloTitulo;
  const contentLabel = document.createElement("span");
  contentLabel.textContent = question.contenidoTitulo;
  context.append(moduleLabel, contentLabel);
  const promptLabel = document.createElement("p");
  promptLabel.className = "assessment-question__eyebrow";
  promptLabel.textContent = question.estimulo?.codigo ? "OBSERVA EL EJEMPLO" : "PREGUNTA ABIERTA";
  card.append(context, promptLabel);

  if (question.estimulo?.codigo) {
    const code = document.createElement("pre");
    code.className = "assessment-stimulus";
    const codeText = document.createElement("code");
    codeText.textContent = question.estimulo.codigo;
    code.append(codeText);
    card.append(code);
    if (question.estimulo.nota) {
      const note = document.createElement("p");
      note.className = "assessment-stimulus__note";
      note.textContent = question.estimulo.nota;
      card.append(note);
    }
  }

  const prompt = document.createElement("h4");
  prompt.className = "assessment-question__prompt";
  prompt.textContent = question.enunciado;
  card.append(prompt);
  const responseLabel = document.createElement("label");
  responseLabel.className = "assessment-response__label";
  responseLabel.htmlFor = `assessment-answer-${question.id}`;
  responseLabel.textContent = "O, si prefieres, escríbelo con tus palabras";
  const textarea = document.createElement("textarea");
  textarea.id = responseLabel.htmlFor;
  textarea.className = "assessment-response";
  textarea.rows = 4;
  textarea.maxLength = 4000;
  textarea.placeholder = "Explica lo que sabes. No hace falta que uses palabras técnicas.";
  textarea.value = question.respuesta ?? "";
  textarea.setAttribute("aria-describedby", "assessment-voice-help");
  textarea.addEventListener("input", () => {
    question.respuesta = textarea.value;
    question.canal = "texto";
    scheduleAssessmentAnswerSave(question);
  });
  const responseActions = document.createElement("div");
  responseActions.className = "assessment-response__actions";
  const voiceButton = document.createElement("button");
  voiceButton.type = "button";
  voiceButton.className = "button button--primary assessment-voice-button";
  const voiceIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  voiceIcon.setAttribute("viewBox", "0 0 24 24");
  voiceIcon.setAttribute("aria-hidden", "true");
  voiceIcon.setAttribute("focusable", "false");
  const voicePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  voicePath.setAttribute("d", "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0M12 17v4m-4 0h8");
  voiceIcon.append(voicePath);
  const voiceButtonText = document.createElement("span");
  voiceButtonText.textContent = "Responder hablando";
  voiceButton.append(voiceIcon, voiceButtonText);
  const voiceHelp = document.createElement("p");
  voiceHelp.id = "assessment-voice-help";
  voiceHelp.className = "assessment-voice-help";
  voiceHelp.textContent = "Toca para hablar. El dictado lo procesa tu navegador; revisa el texto antes de enviarlo. Gemini recibe solo la respuesta filtrada.";
  const speechWindow = window as unknown as {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  };
  if (!speechWindow.SpeechRecognition && !speechWindow.webkitSpeechRecognition) {
    voiceButton.hidden = true;
    voiceHelp.textContent = "El dictado no está disponible en este navegador. Puedes responder por escrito.";
  }
  const divider = document.createElement("p");
  divider.className = "assessment-response__divider";
  divider.textContent = "También puedes responder por escrito";
  voiceButton.addEventListener("click", () => startAssessmentVoiceResponse(question, textarea, voiceButton));
  responseActions.append(voiceButton, voiceHelp);
  card.append(responseActions, divider, responseLabel, textarea);
  assessmentQuestion.append(card);
  assessmentPrevious.disabled = activeAssessmentQuestionIndex === 0;
  assessmentNext.disabled = false;
  assessmentNext.removeAttribute("aria-busy");
  assessmentNext.textContent = current === total ? "Preparar mi itinerario" : "Siguiente";
  window.setTimeout(() => voiceButton.focus(), 0);
}

function scheduleAssessmentAnswerSave(question: InitialAssessmentQuestion): void {
  if (assessmentSaveTimer !== undefined) window.clearTimeout(assessmentSaveTimer);
  assessmentSaveTimer = window.setTimeout(() => {
    const text = question.respuesta ?? "";
    const save = saveAssessmentAnswer(question, text, question.canal ?? "texto");
    void save.catch(() => undefined);
  }, 700);
}

function saveAssessmentAnswer(
  question: InitialAssessmentQuestion,
  respuesta: string,
  canal: "texto" | "voz",
): Promise<void> {
  if (!activeAssessment || !activeAssessmentCourse) return Promise.reject(new Error("No hay un examen activo."));
  const previous = pendingAssessmentAnswers.get(question.id);
  const save = Promise.resolve(previous).catch(() => undefined).then(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch(`/api/courses/${encodeURIComponent(activeAssessmentCourse!.id)}/initial-assessment/answer`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ intentoId: activeAssessment!.intentoId, preguntaId: question.id, respuesta, canal }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("El guardado está tardando demasiado. Comprueba tu conexión y vuelve a intentarlo.");
      }
      throw new Error("No se pudo conectar con el curso. Comprueba tu conexión y vuelve a intentarlo.");
    } finally {
      window.clearTimeout(timeout);
    }
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 401) { expireSession(); throw new Error("Tu sesión ha caducado."); }
    if (!response.ok) throw new Error(result.error ?? "No se pudo guardar la respuesta.");
    assessmentMessage.textContent = respuesta.trim() ? "Respuesta guardada." : "Respuesta borrada.";
    assessmentMessage.setAttribute("role", "status");
  }).catch((error: unknown) => {
    assessmentMessage.textContent = error instanceof Error ? error.message : "No se pudo guardar la respuesta.";
    assessmentMessage.setAttribute("role", "alert");
    throw error;
  });
  void save.catch(() => undefined);
  pendingAssessmentAnswers.set(question.id, save);
  return save;
}

function setAssessmentVoiceButtonLabel(button: HTMLButtonElement, label: string): void {
  let icon = button.querySelector("svg");
  if (!icon) {
    icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0M12 17v4m-4 0h8");
    icon.append(path);
  }
  const text = document.createElement("span");
  text.textContent = label;
  button.replaceChildren(icon, text);
}

function startAssessmentVoiceResponse(
  question: InitialAssessmentQuestion,
  textarea: HTMLTextAreaElement,
  button: HTMLButtonElement,
): void {
  if (activeVoiceRecognition) {
    activeVoiceRecognition.stop();
    activeVoiceRecognition = null;
    setAssessmentVoiceButtonLabel(button, "Responder hablando");
    return;
  }
  const speechWindow = window as unknown as {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  };
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (!Recognition) {
    assessmentMessage.textContent = "El dictado no está disponible en este navegador. Puedes responder por escrito.";
    assessmentMessage.setAttribute("role", "status");
    return;
  }

  const recognition = new Recognition();
  recognition.lang = "es-ES";
  recognition.continuous = true;
  recognition.interimResults = false;
  activeVoiceRecognition = recognition;
  setAssessmentVoiceButtonLabel(button, "Escuchando… · Terminar");
  assessmentMessage.textContent = "Te escucho. Cuando termines, revisa el texto antes de continuar.";
  assessmentMessage.setAttribute("role", "status");
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
    if (!transcript) return;
    const existing = textarea.value.trim();
    textarea.value = [existing, transcript].filter(Boolean).join(" ");
    question.respuesta = textarea.value;
    question.canal = "voz";
    scheduleAssessmentAnswerSave(question);
  };
  recognition.onerror = () => {
    assessmentMessage.textContent = "No se pudo transcribir la voz. Puedes continuar por escrito.";
    assessmentMessage.setAttribute("role", "alert");
  };
  recognition.onend = () => {
    if (activeVoiceRecognition === recognition) activeVoiceRecognition = null;
    setAssessmentVoiceButtonLabel(button, "Responder hablando");
  };
  try {
    recognition.start();
  } catch {
    activeVoiceRecognition = null;
    setAssessmentVoiceButtonLabel(button, "Responder hablando");
    assessmentMessage.textContent = "No se pudo activar el dictado. Puedes continuar por escrito.";
    assessmentMessage.setAttribute("role", "alert");
  }
}

async function openInitialAssessment(course: Course): Promise<void> {
  if (!accessToken) return;
  activeAssessmentCourse = course;
  activeAssessment = null;
  pendingAssessmentAnswers.clear();
  if (courseTabBar) courseTabBar.hidden = true;
  coursePanel.hidden = true;
  itineraryView.hidden = true;
  assessmentView.hidden = false;
  assessmentActive.hidden = false;
  assessmentComplete.hidden = true;
  assessmentCourseTitle.textContent = course.titulo;
  assessmentQuestion.replaceChildren();
  assessmentMessage.textContent = "Cargando el examen inicial…";
  assessmentMessage.setAttribute("role", "status");
  assessmentRetry.hidden = true;
  assessmentNext.disabled = true;
  assessmentPrevious.disabled = true;

  try {
    const response = await fetch(`/api/courses/${encodeURIComponent(course.id)}/initial-assessment/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json().catch(() => ({}))) as InitialAssessmentSession & { error?: string; yaCompletada?: boolean };
    if (response.status === 401) { expireSession(); return; }
    if (response.status === 409 && result.yaCompletada) {
      course.evaluacionInicialCompletada = true;
      await closeAssessment();
      await openItinerary(course);
      return;
    }
    if (!response.ok) throw new Error(result.error ?? "No se pudo cargar el examen inicial.");
    activeAssessment = result;
    activeAssessmentQuestionIndex = 0;
    assessmentMessage.textContent = "";
    assessmentNext.disabled = false;
    renderAssessmentQuestion();
  } catch (error) {
    assessmentMessage.textContent = error instanceof Error ? error.message : "No se pudo cargar el examen inicial.";
    assessmentMessage.setAttribute("role", "alert");
    assessmentRetry.hidden = false;
    assessmentNext.disabled = true;
  }
}

async function advanceInitialAssessment(): Promise<void> {
  if (!activeAssessment || !activeAssessmentCourse) return;
  const question = activeAssessment.preguntas[activeAssessmentQuestionIndex];
  if (!question.respuesta) {
    assessmentMessage.textContent = "Cuéntanos lo que sabes, hablando o por escrito, para continuar.";
    assessmentMessage.setAttribute("role", "alert");
    return;
  }
  assessmentNext.disabled = true;
  assessmentPrevious.disabled = true;
  assessmentNext.setAttribute("aria-busy", "true");
  assessmentNext.textContent = "Guardando…";
  assessmentMessage.textContent = "Guardando tu respuesta…";
  assessmentMessage.setAttribute("role", "status");
  try {
    if (assessmentSaveTimer !== undefined) window.clearTimeout(assessmentSaveTimer);
    await saveAssessmentAnswer(question, question.respuesta, question.canal ?? "texto");
  } catch {
    assessmentNext.disabled = false;
    assessmentPrevious.disabled = activeAssessmentQuestionIndex === 0;
    assessmentNext.removeAttribute("aria-busy");
    assessmentNext.textContent = activeAssessmentQuestionIndex === activeAssessment.preguntas.length - 1
      ? "Preparar mi itinerario"
      : "Siguiente";
    return;
  }
  assessmentNext.removeAttribute("aria-busy");
  if (activeAssessmentQuestionIndex < activeAssessment.preguntas.length - 1) {
    activeAssessmentQuestionIndex += 1;
    renderAssessmentQuestion();
    return;
  }

  assessmentMessage.textContent = "Preparando tu itinerario…";
  assessmentMessage.setAttribute("role", "status");
  assessmentNext.setAttribute("aria-busy", "true");
  assessmentNext.textContent = "Preparando…";
  try {
    const response = await fetch(`/api/courses/${encodeURIComponent(activeAssessmentCourse.id)}/initial-assessment/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ intentoId: activeAssessment.intentoId }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string; yaCompletada?: boolean; contenidosDominados?: string[];
      modulosOrdenados?: Array<{ titulo: string; orden: number }>;
    };
    if (response.status === 401) { expireSession(); return; }
    if (response.status === 409 && result.yaCompletada) {
      activeAssessmentCourse.evaluacionInicialCompletada = true;
      await openItinerary(activeAssessmentCourse);
      return;
    }
    if (!response.ok) throw new Error(result.error ?? "No se pudo finalizar el examen.");
    activeAssessmentCourse.evaluacionInicialCompletada = true;
    const mastered = result.contenidosDominados ?? [];
    assessmentResultCopy.textContent = "Gemini ha analizado tus respuestas. El diagnóstico no es una nota y puedes consultar cualquier contenido aunque aparezca como completado.";
    assessmentOrderCopy.textContent = result.modulosOrdenados?.length
      ? `Empezarás por «${result.modulosOrdenados[0].titulo}», donde podrás reforzar más conceptos.`
      : "Tu recorrido ya está ordenado para ti.";
    assessmentMasteredList.replaceChildren();
    assessmentMasteredWrap.hidden = mastered.length === 0;
    for (const title of mastered) {
      const item = document.createElement("li");
      item.textContent = title;
      assessmentMasteredList.append(item);
    }
    assessmentActive.hidden = true;
    assessmentComplete.hidden = false;
    assessmentViewItinerary.focus();
  } catch (error) {
    assessmentMessage.textContent = error instanceof Error ? error.message : "No se pudo finalizar el examen.";
    assessmentMessage.setAttribute("role", "alert");
    assessmentNext.disabled = false;
    assessmentPrevious.disabled = false;
    assessmentNext.removeAttribute("aria-busy");
    assessmentNext.textContent = "Reintentar preparación";
  }
}

async function closeAssessment(): Promise<void> {
  if (activeAssessment && activeAssessmentCourse) {
    const question = activeAssessment.preguntas[activeAssessmentQuestionIndex];
    if (assessmentSaveTimer !== undefined) window.clearTimeout(assessmentSaveTimer);
    if (question) {
      try { await saveAssessmentAnswer(question, question.respuesta ?? "", question.canal ?? "texto"); } catch { return; }
    }
  }
  if (activeVoiceRecognition) {
    activeVoiceRecognition.stop();
    activeVoiceRecognition = null;
  }
  assessmentView.hidden = true;
  if (courseTabBar) courseTabBar.hidden = false;
  coursePanel.hidden = false;
  selectCourseTab("enrolled", false);
  void loadCourses();
}

function renderItinerary(modules: ItineraryModule[]): void {
  itineraryTree.replaceChildren();
  let total = 0;
  let completed = 0;
  for (const module of modules) {
    const section = document.createElement("section");
    section.className = "itinerary-module";
    const heading = document.createElement("div");
    heading.className = "itinerary-module__heading";
    const number = document.createElement("span");
    number.className = "itinerary-module__number";
    number.textContent = String(module.orden).padStart(2, "0");
    const titleGroup = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = module.titulo;
    const count = document.createElement("p");
    const moduleSteps = [
      ...module.contenidos,
      ...module.evaluaciones,
    ];
    const moduleDone = moduleSteps.filter((item) => item.estado === "completado" || item.estado === "saltado").length;
    count.textContent = `${moduleDone} de ${moduleSteps.length} pasos completados`;
    titleGroup.append(title, count);
    heading.append(number, titleGroup);
    section.append(heading);
    if (module.descripcion) {
      const description = document.createElement("p");
      description.className = "itinerary-module__description";
      description.textContent = module.descripcion;
      section.append(description);
    }
    if (module.contenidos.length === 0 && module.evaluaciones.length === 0) {
      const empty = document.createElement("p");
      empty.className = "itinerary-module__empty";
      empty.textContent = "Este módulo aún no tiene contenidos en tu itinerario.";
      section.append(empty);
    } else {
      const list = document.createElement("ol");
      list.className = "itinerary-lessons";
      const appendEvaluation = (evaluation: ItineraryModule["evaluaciones"][number]) => {
        total += 1;
        const isDone = evaluation.estado === "completado";
        if (isDone) completed += 1;
        const row = document.createElement("li");
        row.className = `itinerary-lesson itinerary-lesson--test${isDone ? " is-complete" : evaluation.estado === "en_curso" ? " is-current" : ""}`;
        const marker = document.createElement("span");
        marker.className = "itinerary-lesson__marker";
        marker.setAttribute("aria-hidden", "true");
        marker.textContent = isDone ? "✓" : evaluation.estado === "en_curso" ? "▶" : "T";
        const body = document.createElement("div");
        body.className = "itinerary-lesson__body";
        const name = document.createElement("span");
        name.className = "itinerary-lesson__title";
        name.textContent = evaluation.titulo;
        const meta = document.createElement("p");
        meta.textContent = evaluation.tipo === "final" ? "Evaluación final" : "Test del contenido";
        body.append(name, meta);
        const state = document.createElement("span");
        state.className = "itinerary-lesson__state";
        state.textContent = contentStateLabel(evaluation.estado);
        row.append(marker, body, state);
        list.append(row);
      };
      for (const item of module.contenidos) {
        total += 1;
        const isDone = item.estado === "completado" || item.estado === "saltado";
        if (isDone) completed += 1;
        const row = document.createElement("li");
        row.className = `itinerary-lesson${isDone ? " is-complete" : item.estado === "en_curso" ? " is-current" : ""}`;
        const marker = document.createElement("span");
        marker.className = "itinerary-lesson__marker";
        marker.setAttribute("aria-hidden", "true");
        marker.textContent = isDone ? "✓" : item.estado === "en_curso" ? "▶" : "";
        const body = document.createElement("div");
        body.className = "itinerary-lesson__body";
        let safeUrl: string | null = null;
        if (item.url) {
          try {
            const parsed = new URL(item.url, window.location.origin);
            if (parsed.protocol === "https:" || parsed.protocol === "http:") safeUrl = parsed.href;
          } catch { /* Una URL no válida se muestra como título sin enlace. */ }
        }
        const name = document.createElement(safeUrl ? "a" : "span");
        name.className = "itinerary-lesson__title";
        name.textContent = item.titulo;
        if (safeUrl) {
          (name as HTMLAnchorElement).href = safeUrl;
          (name as HTMLAnchorElement).target = "_blank";
          (name as HTMLAnchorElement).rel = "noopener noreferrer";
          (name as HTMLAnchorElement).setAttribute("aria-label", `Abrir ${item.titulo} en una pestaña nueva`);
        }
        const meta = document.createElement("p");
        const typeLabel = item.tipo === "video_corto" ? "Vídeo corto" : item.tipo === "podcast" ? "Pódcast" : "Vídeo";
        const duration = formatDuration(item.duracionSegundos);
        meta.textContent = [typeLabel, duration].filter(Boolean).join(" · ");
        body.append(name, meta);
        const state = document.createElement("span");
        state.className = "itinerary-lesson__state";
        state.textContent = contentStateLabel(item.estado);
        row.append(marker, body, state);
        list.append(row);
        for (const evaluation of module.evaluaciones.filter((test) => test.contenidoId === item.id)) {
          appendEvaluation(evaluation);
        }
      }
      const placedEvaluationIds = new Set(module.contenidos.flatMap((item) =>
        module.evaluaciones.filter((test) => test.contenidoId === item.id).map((test) => test.id)));
      for (const evaluation of module.evaluaciones) {
        if (!placedEvaluationIds.has(evaluation.id)) appendEvaluation(evaluation);
      }
      section.append(list);
    }
    itineraryTree.append(section);
  }
  const percent = total ? Math.round((completed / total) * 100) : 0;
  itinerarySummary.replaceChildren();
  const value = document.createElement("strong");
  value.textContent = `${percent}%`;
  const copy = document.createElement("span");
  copy.textContent = `${completed} de ${total} contenidos completados`;
  const track = document.createElement("div");
  track.className = "itinerary-summary__track";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", "Progreso total del itinerario");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(percent));
  const fill = document.createElement("span");
  fill.style.width = `${percent}%`;
  track.append(fill);
  itinerarySummary.append(value, copy, track);
}

async function openItinerary(course: Course): Promise<void> {
  if (!accessToken) return;
  if (!course.evaluacionInicialCompletada) {
    await openInitialAssessment(course);
    return;
  }
  if (courseTabBar) courseTabBar.hidden = true;
  coursePanel.hidden = true;
  assessmentView.hidden = true;
  itineraryView.hidden = false;
  itineraryTitle.textContent = course.titulo;
  itineraryDescription.textContent = course.descripcion ?? "Sigue el recorrido de contenidos preparado para ti.";
  itineraryStatus.textContent = "Cargando tu itinerario…";
  itineraryStatus.setAttribute("role", "status");
  itineraryTree.replaceChildren();
  itineraryTree.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(`/api/courses/${encodeURIComponent(course.id)}/itinerary`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json().catch(() => ({}))) as ItineraryResponse;
    if (response.status === 401) { expireSession(); return; }
    if (!response.ok) throw new Error(result.error ?? "No se pudo cargar tu itinerario.");
    renderItinerary(result.modulos);
    itineraryStatus.textContent = result.modulos.length
      ? "Avanza por los módulos y consulta qué tienes completado y qué te queda por hacer."
      : "Este curso todavía no tiene módulos disponibles.";
  } catch (error) {
    itineraryStatus.textContent = error instanceof Error ? error.message : "No se pudo cargar tu itinerario.";
    itineraryStatus.setAttribute("role", "alert");
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "text-button";
    retry.textContent = "Volver a intentar";
    retry.addEventListener("click", () => void openItinerary(course));
    itineraryTree.append(retry);
  } finally {
    itineraryTree.setAttribute("aria-busy", "false");
  }
}

function closeItinerary(): void {
  itineraryView.hidden = true;
  if (courseTabBar) courseTabBar.hidden = false;
  coursePanel.hidden = false;
  selectCourseTab("enrolled", false);
  byId<HTMLButtonElement>("tab-enrolled").focus();
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
  const listKey = `${endpoint}\u0000${search}`;
  if (renderedCourseListKey !== listKey) courseList.replaceChildren();
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
    renderedCourseListKey = listKey;
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
    course.estado = "activo";
    course.evaluacionInicialCompletada = false;
    void openInitialAssessment(course);
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
itineraryBack.addEventListener("click", closeItinerary);
assessmentExit.addEventListener("click", () => void closeAssessment());
assessmentRetry.addEventListener("click", () => {
  if (activeAssessmentCourse) void openInitialAssessment(activeAssessmentCourse);
});
assessmentNext.addEventListener("click", () => void advanceInitialAssessment());
assessmentPrevious.addEventListener("click", async () => {
  if (!activeAssessment || activeAssessmentQuestionIndex === 0) return;
  const question = activeAssessment.preguntas[activeAssessmentQuestionIndex];
  assessmentPrevious.disabled = true;
  try {
    if (assessmentSaveTimer !== undefined) window.clearTimeout(assessmentSaveTimer);
    await saveAssessmentAnswer(question, question.respuesta ?? "", question.canal ?? "texto");
    activeAssessmentQuestionIndex -= 1;
    renderAssessmentQuestion();
  } catch {
    assessmentPrevious.disabled = false;
  }
});
assessmentViewItinerary.addEventListener("click", () => {
  if (activeAssessmentCourse) void openItinerary(activeAssessmentCourse);
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

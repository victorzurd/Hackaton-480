type LessonTranscript = {
  texto: string;
  idioma: string;
};

type LessonDetails = {
  contenidoId: string;
  titulo: string;
  moduloTitulo: string;
  videoUrl: string | null;
  duracionSegundos: number | null;
  transcripcion: LessonTranscript | null;
};

type LessonResponse = {
  leccion?: LessonDetails;
  error?: string;
};

type ItineraryContent = {
  id: string;
  titulo: string;
  tipo: string;
};

type ItineraryResponse = {
  modulos?: Array<{
    contenidos?: ItineraryContent[];
  }>;
  error?: string;
};

const params = new URLSearchParams(window.location.search);
const preview = params.get("preview") === "1";
const courseId = params.get("curso");
const contentId = params.get("contenido");

const loading = document.querySelector<HTMLElement>("#lesson-loading")!;
const errorPanel = document.querySelector<HTMLElement>("#lesson-error")!;
const errorTitle = document.querySelector<HTMLHeadingElement>("#lesson-error-title")!;
const errorMessage = document.querySelector<HTMLParagraphElement>("#lesson-error-message")!;
const loginLink = document.querySelector<HTMLAnchorElement>("#lesson-login-link")!;
const errorBack = document.querySelector<HTMLAnchorElement>("#lesson-error-back")!;
const content = document.querySelector<HTMLElement>("#lesson-content")!;
const eyebrow = document.querySelector<HTMLParagraphElement>("#lesson-eyebrow")!;
const title = document.querySelector<HTMLHeadingElement>("#lesson-title")!;
const duration = document.querySelector<HTMLParagraphElement>("#lesson-duration")!;
const back = document.querySelector<HTMLAnchorElement>("#lesson-back")!;
const mediaStatus = document.querySelector<HTMLParagraphElement>("#lesson-media-status")!;
const player = document.querySelector<HTMLDivElement>("#lesson-player")!;
const video = document.querySelector<HTMLVideoElement>("#lesson-video")!;
const navigation = document.querySelector<HTMLElement>("#lesson-navigation")!;
const previous = document.querySelector<HTMLAnchorElement>("#lesson-previous")!;
const previousTitle = document.querySelector<HTMLSpanElement>("#lesson-previous-title")!;
const next = document.querySelector<HTMLAnchorElement>("#lesson-next")!;
const nextTitle = document.querySelector<HTMLSpanElement>("#lesson-next-title")!;
const navigationStatus = document.querySelector<HTMLParagraphElement>("#lesson-navigation-status")!;
const transcriptLanguage = document.querySelector<HTMLSpanElement>("#lesson-transcript-language")!;
const transcriptEmpty = document.querySelector<HTMLParagraphElement>("#lesson-transcript-empty")!;
const transcriptText = document.querySelector<HTMLDivElement>("#lesson-transcript-text")!;

const DEMO_LESSON: LessonDetails = {
  contenidoId: "preview",
  titulo: "Hablar con la IA: tu primer prompt",
  moduloTitulo: "Ciberseguridad",
  videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  duracionSegundos: null,
  transcripcion: {
    idioma: "es",
    texto: [
      "Un prompt es la instrucción que le das a una herramienta de inteligencia artificial. Cuanto más claro sea lo que necesitas, más útil podrá ser la respuesta.",
      "Empieza por definir el objetivo. Después, añade el contexto necesario: quién utilizará el resultado, qué situación quieres resolver y qué formato te vendría mejor.",
      "Por ejemplo, en lugar de pedir «escribe un correo», explica a quién va dirigido, qué quieres comunicar y qué tono debería tener. Esos detalles ayudan a obtener una respuesta más útil.",
      "También puedes indicar límites, incluir un ejemplo del resultado esperado y revisar la respuesta antes de utilizarla. Si no responde a tu objetivo, añade información o formula la petición de otra manera.",
      "No hace falta escribir una instrucción perfecta a la primera. Prueba, observa el resultado y concreta qué cambiarías. Así conviertes una petición general en una indicación clara y práctica.",
    ].join("\n\n"),
  },
};

function setError(message: string, options: { expired?: boolean; title?: string } = {}): void {
  loading.hidden = true;
  content.hidden = true;
  errorPanel.hidden = false;
  errorTitle.textContent = options.title ?? "No se pudo cargar la lección";
  errorMessage.textContent = message;
  loginLink.hidden = !options.expired;
  if (options.expired) {
    errorBack.href = courseId ? itineraryUrl(courseId) : "/cursos.html";
    errorBack.textContent = "Volver al itinerario";
  }
}

function itineraryUrl(id: string): string {
  const url = new URL("/curso.html", window.location.origin);
  url.searchParams.set("id", id);
  url.searchParams.set("vista", "itinerary");
  return `${url.pathname}${url.search}`;
}

function lessonUrl(course: string, contentId: string): string {
  const url = new URL("/leccion.html", window.location.origin);
  url.searchParams.set("curso", course);
  url.searchParams.set("contenido", contentId);
  return `${url.pathname}${url.search}`;
}

function durationLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0
    ? `${minutes} min`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")} min`;
}

function renderTranscript(transcript: LessonTranscript | null): void {
  transcriptText.textContent = "";
  if (!transcript || !transcript.texto.trim()) {
    transcriptEmpty.hidden = false;
    transcriptLanguage.hidden = true;
    return;
  }

  transcriptEmpty.hidden = true;
  transcriptText.textContent = transcript.texto;
  transcriptLanguage.textContent = transcript.idioma.toUpperCase();
  transcriptLanguage.hidden = !transcript.idioma;
}

function renderLesson(lesson: LessonDetails, lessonNumber?: number): void {
  loading.hidden = true;
  errorPanel.hidden = true;
  content.hidden = false;
  eyebrow.textContent = lessonNumber
    ? `LECCIÓN ${String(lessonNumber).padStart(2, "0")} · ${lesson.moduloTitulo}`
    : `LECCIÓN · ${lesson.moduloTitulo}`;
  title.textContent = lesson.titulo;
  if (lesson.duracionSegundos !== null && lesson.duracionSegundos > 0) {
    duration.textContent = durationLabel(lesson.duracionSegundos);
    duration.hidden = false;
  } else {
    duration.hidden = true;
  }
  back.href = courseId ? itineraryUrl(courseId) : "/cursos.html";

  if (lesson.videoUrl) {
    try {
      const videoUrl = new URL(lesson.videoUrl, window.location.origin);
      if (videoUrl.protocol !== "http:" && videoUrl.protocol !== "https:") {
        throw new Error("URL de vídeo no permitida");
      }
      video.src = videoUrl.href;
      player.hidden = false;
      mediaStatus.hidden = true;
      video.load();
    } catch {
      showUnavailableVideo("La dirección del vídeo no es válida.");
    }
  } else {
    showUnavailableVideo("El vídeo de esta lección todavía no está disponible.");
  }

  renderTranscript(lesson.transcripcion);
}

function showUnavailableVideo(message: string): void {
  video.removeAttribute("src");
  player.hidden = true;
  mediaStatus.textContent = message;
  mediaStatus.hidden = false;
}

function setNavigationStatus(message: string): void {
  navigation.hidden = false;
  navigationStatus.textContent = message;
  navigationStatus.hidden = false;
}

async function loadNavigation(token: string, lesson: LessonDetails): Promise<void> {
  if (!courseId || preview) return;

  const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/itinerary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new SessionExpiredError();
  const result = await response.json().catch(() => ({})) as ItineraryResponse;
  if (!response.ok) throw new Error(result.error ?? "No se pudo cargar la navegación del itinerario.");

  const videos = (result.modulos ?? [])
    .flatMap((module) => module.contenidos ?? [])
    .filter((item) => item.tipo === "video");
  const currentIndex = videos.findIndex((item) => item.id === lesson.contenidoId);
  if (currentIndex < 0) {
    setNavigationStatus("No se encontraron otras lecciones en el itinerario.");
    return;
  }

  const previousLesson = videos[currentIndex - 1];
  const nextLesson = videos[currentIndex + 1];
  if (previousLesson) {
    previous.href = lessonUrl(courseId, previousLesson.id);
    previousTitle.textContent = previousLesson.titulo;
    previous.hidden = false;
  }
  if (nextLesson) {
    next.href = lessonUrl(courseId, nextLesson.id);
    nextTitle.textContent = nextLesson.titulo;
    next.hidden = false;
  }
  navigation.hidden = !previousLesson && !nextLesson;
}

class SessionExpiredError extends Error {}

async function loadRealLesson(): Promise<void> {
  if (!courseId || !contentId || !/^\d{1,19}$/.test(courseId) || !/^\d{1,19}$/.test(contentId)) {
    setError("Faltan los identificadores válidos del curso y la lección.", {
      title: "No se indicó una lección válida",
    });
    return;
  }

  let token: string | null;
  try {
    token = window.sessionStorage.getItem("480_access_token");
  } catch {
    setError("No se pudo acceder a la sesión. Inicia sesión de nuevo.", { expired: true });
    return;
  }
  if (!token) {
    setError("Necesitas iniciar sesión para ver esta lección.", { expired: true });
    return;
  }

  let response: Response;
  try {
    response = await fetch(
      `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(contentId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    setError("Comprueba la conexión con el servidor e inténtalo de nuevo.", {
      title: "No se pudo conectar",
    });
    return;
  }
  if (response.status === 401) {
    try {
      window.sessionStorage.removeItem("480_access_token");
    } catch {
      // La sesión queda inválida en el servidor aunque el almacenamiento local no esté disponible.
    }
    setError("Tu sesión ha caducado. Inicia sesión de nuevo para continuar.", { expired: true });
    return;
  }

  const result = await response.json().catch(() => ({})) as LessonResponse;
  if (response.status === 403) {
    setError("No tienes una matrícula autorizada para acceder a este curso.", {
      title: "Acceso no autorizado",
    });
    return;
  }
  if (response.status === 404) {
    setError(result.error ?? "No se encontró esta lección en el curso.", {
      title: "Lección no disponible",
    });
    return;
  }
  if (!response.ok) {
    setError(result.error ?? "El servidor no pudo cargar la lección.", {
      title: "Error del servidor",
    });
    return;
  }
  if (!result.leccion) {
    setError("El servidor devolvió datos de lección incompletos.", {
      title: "No se pudo cargar la lección",
    });
    return;
  }

  renderLesson(result.leccion);
  try {
    await loadNavigation(token, result.leccion);
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      try {
        window.sessionStorage.removeItem("480_access_token");
      } catch {
        // La sesión queda inválida en el servidor aunque el almacenamiento local no esté disponible.
      }
      setError("Tu sesión ha caducado. Inicia sesión de nuevo para continuar.", { expired: true });
      return;
    }
    setNavigationStatus("No se pudo cargar la navegación entre lecciones.");
  }
}

video.addEventListener("error", () => {
  showUnavailableVideo("No se pudo reproducir el vídeo. Puede que la fuente no esté disponible.");
});

if (preview) {
  renderLesson(DEMO_LESSON, 5);
} else {
  void loadRealLesson();
}

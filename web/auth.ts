type AuthResponse = {
  usuario: {
    nombreCompleto: string;
    correo: string;
  };
  token?: string;
  error?: string;
};

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
const successTitle = byId<HTMLHeadingElement>("success-title");
const successCopy = byId<HTMLParagraphElement>("success-copy");

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

function showSuccess(result: AuthResponse, created: boolean): void {
  loginView.hidden = true;
  registerView.hidden = true;
  successView.hidden = false;
  loginModeButton.setAttribute("aria-pressed", "false");
  registerModeButton.setAttribute("aria-pressed", "false");
  loginModeButton.classList.remove("is-active");
  registerModeButton.classList.remove("is-active");
  loginModeButton.disabled = true;
  registerModeButton.disabled = true;
  authTitle.textContent = created ? "Cuenta creada" : "Sesión iniciada";
  authDescription.textContent = "";
  successTitle.textContent = `Hola, ${result.usuario.nombreCompleto.split(" ")[0]}`;
  successCopy.textContent = created
    ? "Tu cuenta está lista y la sesión se ha iniciado correctamente."
    : "Has iniciado sesión correctamente en 480 Academy.";
  if (result.token) saveSession(result.token);
  byId<HTMLButtonElement>("logout-button").focus();
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
  try {
    window.sessionStorage.removeItem("480_access_token");
  } catch {
    // El estado visual vuelve a acceso aunque el almacenamiento no esté disponible.
  }
  loginForm.reset();
  stepOneForm.reset();
  stepTwoForm.reset();
  updateEmploymentOption();
  setMode("login");
  byId<HTMLInputElement>("login-email").focus();
});

setMode(window.location.hash === "#registro" ? "register" : "login");
updateEmploymentOption();
void restoreSession();

export {};

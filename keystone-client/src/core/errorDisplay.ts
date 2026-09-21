import type { Language } from "./i18n";
import type { CoreError } from "./types";

const MESSAGES: Readonly<Record<string, Readonly<Record<Language, string>>>> = {
  SESSION_EXPIRED: { es: "La sesión ha caducado. Inicia sesión de nuevo.", en: "Your session has expired. Sign in again." },
  API_TIMEOUT: { es: "La API tardó demasiado en responder.", en: "The API took too long to respond." },
  API_UNAVAILABLE: { es: "No se pudo conectar con la API.", en: "Could not connect to the API." },
  API_THROTTLED: { es: "La API ha limitado temporalmente las solicitudes.", en: "The API has temporarily limited requests." },
  AUTH_INVALID_CREDENTIALS: { es: "El usuario o la contraseña no son válidos.", en: "The username or password is invalid." },
  AUTH_CONNECTION_ERROR: { es: "No se pudo conectar con el servicio de autenticación.", en: "Could not connect to the authentication service." },
  AUTH_SERVER_ERROR: { es: "El servicio de autenticación no está disponible.", en: "The authentication service is unavailable." },
  AUTH_INVALID_RESPONSE: { es: "El servicio de autenticación devolvió una respuesta no válida.", en: "The authentication service returned an invalid response." },
  AUTH_REGISTRATION_FAILED: { es: "No se pudo completar el registro.", en: "Registration could not be completed." },
  AUTH_BATTLENET_FAILED: { es: "No se pudo completar la vinculación con Battle.net.", en: "Battle.net linking could not be completed." },
  TEAM_ACCESS_DENIED: { es: "Ya no tienes acceso a este equipo.", en: "You no longer have access to this Team." },
  TEAM_NOT_FOUND: { es: "No se encontró el equipo.", en: "The Team was not found." },
  INVALID_TEAM_RESPONSE: { es: "La respuesta del equipo no es válida.", en: "The Team response is invalid." },
  INVALID_SELECTOR_RESPONSE: { es: "La respuesta de objetivos no es válida.", en: "The objectives response is invalid." },
  INVALID_PLANNER_RESPONSE: { es: "La respuesta del Planificador no es válida.", en: "The Planner response is invalid." },
  INVALID_PLANNER_PREFERENCES_RESPONSE: { es: "Las preferencias del Planificador no son válidas.", en: "The Planner preferences are invalid." },
  SYNC_NOT_AUTHENTICATED: { es: "Inicia sesión para sincronizar.", en: "Sign in to synchronize." },
  SYNC_NO_ACCOUNT_SELECTED: { es: "Selecciona al menos una cuenta de WoW.", en: "Select at least one WoW account." },
  SYNC_SAVEDVARS_NOT_FOUND: { es: "No se encontró el archivo de datos del addon.", en: "The addon data file was not found." },
  SYNC_NETWORK_ERROR: { es: "No se pudo enviar la sincronización.", en: "The synchronization could not be sent." },
  SYNC_PARSE_ERROR: { es: "No se pudieron leer los datos del addon.", en: "The addon data could not be read." },
  ADDON_OPERATION_RUNNING: { es: "Ya hay una operación del addon en curso.", en: "An addon operation is already running." },
  ADDON_CHECK_FAILED: { es: "No se pudo comprobar el addon.", en: "The addon could not be checked." },
  ADDON_INSTALL_FAILED: { es: "No se pudo instalar el addon.", en: "The addon could not be installed." },
  PROFILE_UPDATE_FAILED: { es: "No se pudo actualizar el perfil.", en: "The profile could not be updated." },
  WOW_INVALID_INSTALL: { es: "La instalación de WoW seleccionada no es válida.", en: "The selected WoW installation is invalid." },
  WOW_INVALID_ACCOUNT_SELECTION: { es: "La selección de cuentas de WoW no es válida.", en: "The WoW account selection is invalid." },
  INVALID_REQUEST: { es: "La solicitud no es válida.", en: "The request is invalid." },
  BRIDGE_UNHEALTHY: { es: "No se pudo iniciar el servicio local de KeystoneClient.", en: "The KeystoneClient local service could not start." },
};

export function localizedCoreError(error: unknown, language: Language, fallback: string): CoreError {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as CoreError).code) : "UNKNOWN";
  return { code, message: MESSAGES[code]?.[language] ?? fallback };
}

export function localizedCoreErrorMessage(error: unknown, language: Language, fallback: string): string {
  return localizedCoreError(error, language, fallback).message;
}

import { createHttpError } from '../utils/http.js';
import { parsePositiveInteger, toBoolean } from '../utils/normalize.js';

export function validatePilotRegistrationInput(input = {}) {
  const userId = parsePositiveInteger(input.user_id);
  if (!userId) {
    throw createHttpError(400, 'El ID de piloto debe ser un número entero positivo.');
  }

  const name = String(input.name || '').trim();
  if (name.length < 2) {
    throw createHttpError(400, 'El nombre del piloto debe tener al menos 2 caracteres.');
  }

  if (name.length > 80) {
    throw createHttpError(400, 'El nombre del piloto no puede superar los 80 caracteres.');
  }

  const country = String(input.country || '').trim();
  if (country.length > 80) {
    throw createHttpError(400, 'El país no puede superar los 80 caracteres.');
  }

  return {
    user_id: userId,
    name,
    country: country || null
  };
}

export function validatePilotStatusInput(input = {}) {
  if (input.active === undefined) {
    throw createHttpError(400, 'Debes indicar si el piloto queda activo o inactivo.');
  }

  return {
    active: toBoolean(input.active)
  };
}

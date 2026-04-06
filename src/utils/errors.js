/**
 * Manejo centralizado de errores.
 * Loguea de forma estructurada y devuelve un mensaje legible para el usuario.
 */
export function handleError(err, context = '') {
  const msg = err?.message || 'Operación fallida';
  console.warn(`[${context}]`, msg, err);
  return msg;
}

/**
 * Wrapper con timeout para promesas (por defecto 15s).
 * Lanza un error si la promesa no resuelve a tiempo.
 */
export function withTimeout(promise, ms, label = 'Operación') {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label}: tiempo de espera agotado`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Duración del lockout tras MAX_LOGIN_ATTEMPTS intentos fallidos (5 minutos)
export const LOCKOUT_DURATION_MS = 300_000;

// Intentos fallidos antes de bloquear
export const MAX_LOGIN_ATTEMPTS = 3;

// Días de duración de una licencia demo
export const DEMO_DAYS = 7;

// Umbral para considerar un dispositivo "en línea" (15 minutos)
export const ACTIVITY_THRESHOLD_MS = 15 * 60 * 1000;

// Timeout para llamadas RPC a Supabase (15 segundos)
export const RPC_TIMEOUT_MS = 15_000;

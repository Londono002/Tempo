/**
 * timer.js — Lógica pura del temporizador.
 *
 * Regla fundamental: ninguna función aquí importa React ni conoce la UI.
 * Solo recibe datos, calcula y devuelve valores.
 * Esto facilita probar la lógica sin montar componentes.
 *
 * ─── Modelo de tiempo efectivo ──────────────────────────────────────────────
 *
 * Una sesión puede estar:
 *   active  → corriendo sin pausas activas
 *   paused  → hay una pausa sin resumed_at
 *
 * El tiempo efectivo se calcula así:
 *   1. Para cada pausa COMPLETADA (tiene paused_at y resumed_at):
 *      tiempo_pausa = resumed_at - paused_at
 *   2. Si hay una pausa ACTIVA (tiene paused_at pero no resumed_at):
 *      no se suma tiempo desde ese punto
 *   3. Tiempo efectivo = (ahora - started_at) - suma_de_tiempos_en_pausa
 *
 * La fuente de verdad es siempre la base de datos (timestamps ISO 8601),
 * NUNCA un contador visual.
 */

/**
 * Calcula el tiempo efectivo acumulado de una sesión.
 *
 * @param {object} params
 * @param {string}  params.startedAt  - ISO 8601 de inicio de sesión
 * @param {Array}   params.pauses     - Array de { paused_at, resumed_at }
 * @param {Date}    [params.now]      - Momento actual (por defecto: new Date())
 * @returns {number} Milisegundos efectivos trabajados
 */
export function calcularTiempoEfectivo({ startedAt, pauses = [], now = new Date() }) {
  const inicio     = new Date(startedAt).getTime();
  const ahora      = now.getTime();
  const totalBruto = ahora - inicio;

  // Sumar tiempo de cada pausa completada
  const tiempoPausado = pauses.reduce((acc, pausa) => {
    if (pausa.paused_at && pausa.resumed_at) {
      return acc + (new Date(pausa.resumed_at).getTime() - new Date(pausa.paused_at).getTime());
    }
    // Pausa activa: desde que se pausó hasta ahora no cuenta
    if (pausa.paused_at && !pausa.resumed_at) {
      return acc + (ahora - new Date(pausa.paused_at).getTime());
    }
    return acc;
  }, 0);

  return Math.max(0, totalBruto - tiempoPausado);
}

/**
 * Formatea una duración en milisegundos como HH:MM:SS.
 * Se usa en el temporizador y en el historial.
 *
 * @param {number} ms - Milisegundos
 * @returns {string}  - 'HH:MM:SS' (ej. '01:23:45')
 */
export function formatearTiempo(ms) {
  if (ms < 0) ms = 0;
  const totalSeg = Math.floor(ms / 1000);
  const horas    = Math.floor(totalSeg / 3600);
  const minutos  = Math.floor((totalSeg % 3600) / 60);
  const segundos = totalSeg % 60;

  return [horas, minutos, segundos]
    .map(v => String(v).padStart(2, '0'))
    .join(':');
}

/**
 * Formatea una duración en milisegundos como texto legible.
 * Se usa en resúmenes y estadísticas (no en el contador del temporizador).
 *
 * @param {number} ms
 * @returns {string} - ej. '2h 30m', '45m', '5m'
 */
export function formatearDuracion(ms) {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);

  if (totalMin < 1)  return 'menos de 1 min';
  if (totalMin < 60) return `${totalMin}m`;

  const horas   = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;

  return minutos === 0 ? `${horas}h` : `${horas}h ${minutos}m`;
}

/**
 * Devuelve el saludo apropiado según la hora del día.
 * @returns {string}
 */
export function obtenerSaludo() {
  const hora = new Date().getHours();
  if (hora >= 5  && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Devuelve el emoji del saludo según la hora.
 * @returns {string}
 */
export function obtenerEmojiSaludo() {
  const hora = new Date().getHours();
  if (hora >= 5  && hora < 12) return '☀️';
  if (hora >= 12 && hora < 19) return '🌤️';
  return '🌙';
}

/**
 * Formatea una fecha ISO 8601 como texto relativo en español.
 * @param {string} isoString
 * @returns {string} - 'hace 5 min', 'hace 2h', 'ayer'
 */
export function formatearRelativo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const min  = Math.floor(diff / 60000);
  const h    = Math.floor(diff / 3600000);
  const dias = Math.floor(diff / 86400000);

  if (min < 1)  return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  if (h   < 24) return `hace ${h}h`;
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

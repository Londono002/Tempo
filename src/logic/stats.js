/**
 * stats.js — Cálculo de estadísticas de sesiones.
 *
 * Regla: ninguna función aquí importa React ni conoce la UI.
 * Recibe arrays de sesiones (ya leídos de la BD) y devuelve datos calculados.
 *
 * Diseño deliberado: las consultas SQL están en sessionsService.js;
 * los cálculos sobre los datos obtenidos están aquí.
 * Esto facilita probar la lógica sin base de datos.
 */

/**
 * Calcula el total de milisegundos efectivos de un array de sesiones.
 * @param {Session[]} sessions
 * @returns {number} ms totales
 */
export function totalEfectivo(sessions) {
  return sessions.reduce((acc, s) => acc + (s.effective_ms ?? 0), 0);
}

/**
 * Agrupa sesiones por actividad y suma el tiempo efectivo de cada una.
 * @param {Session[]} sessions
 * @returns {{ activityId, name, icon, color, totalMs, count }[]}
 *   Ordenado de mayor a menor tiempo.
 */
export function agruparPorActividad(sessions) {
  const mapa = new Map();

  sessions.forEach(s => {
    const id = s.activity_id;
    if (!mapa.has(id)) {
      mapa.set(id, {
        activityId: id,
        name:       s.activity_name  ?? 'Eliminada',
        icon:       s.activity_icon  ?? 'timer-outline',
        color:      s.activity_color ?? '#8B5CF6',
        totalMs:    0,
        count:      0,
      });
    }
    const entry = mapa.get(id);
    entry.totalMs += s.effective_ms ?? 0;
    entry.count   += 1;
  });

  return Array.from(mapa.values()).sort((a, b) => b.totalMs - a.totalMs);
}

/**
 * Agrupa sesiones por día y suma el tiempo efectivo.
 * @param {Session[]} sessions
 * @returns {{ date: string, totalMs: number, count: number }[]}
 *   date en formato 'YYYY-MM-DD', ordenado ascendentemente.
 */
export function agruparPorDia(sessions) {
  const mapa = new Map();

  sessions.forEach(s => {
    const dia = fechaLocalISO(new Date(s.started_at));
    if (!mapa.has(dia)) mapa.set(dia, { date: dia, totalMs: 0, count: 0 });
    const entry = mapa.get(dia);
    entry.totalMs += s.effective_ms ?? 0;
    entry.count   += 1;
  });

  return Array.from(mapa.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function fechaLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Devuelve el rango de fechas (ISO 8601) para un período predefinido.
 * @param {'today'|'week'|'month'|'all'} period
 * @returns {{ from: string|null, to: string|null }}
 */
export function rangoDelPeriodo(period) {
  const ahora = new Date();

  if (period === 'today') {
    const inicio = startOfDay(ahora).toISOString();
    const fin    = endOfDay(ahora).toISOString();
    return { from: inicio, to: fin };
  }

  if (period === 'week') {
    const lunes  = startOfWeek(ahora);
    const fin    = endOfDay(ahora).toISOString();
    return { from: lunes.toISOString(), to: fin };
  }

  if (period === 'month') {
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const fin    = endOfDay(ahora).toISOString();
    return { from: inicio.toISOString(), to: fin };
  }

  // 'all' → sin filtro de fecha
  return { from: null, to: null };
}

// ─── Utilidades internas ──────────────────────────────────────────────────────

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date) {
  // Lunes como primer día de la semana
  const d   = new Date(date);
  const dia = d.getDay(); // 0 = domingo
  const diff = (dia === 0 ? -6 : 1 - dia);
  d.setDate(d.getDate() + diff);
  return startOfDay(d);
}

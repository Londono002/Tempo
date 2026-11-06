/**
 * sessionsService.js — Operaciones CRUD completas para sesiones.
 *
 * ─── Modelo de estados ────────────────────────────────────────────────────────
 *  'active'    → sesión corriendo, sin pausa activa
 *  'paused'    → hay una fila en session_pauses sin resumed_at
 *  'completed' → sesión terminada normalmente (tiene ended_at y effective_ms)
 *  'cancelled' → sesión descartada (tiene ended_at, sin effective_ms)
 *
 * ─── Regla de consistencia ────────────────────────────────────────────────────
 *  Solo puede existir una sesión con status 'active' o 'paused' a la vez.
 *  startSession() lanza error si ya existe una sesión abierta.
 *
 * ─── Fuente de verdad del tiempo ─────────────────────────────────────────────
 *  El tiempo efectivo se calcula SIEMPRE a partir de timestamps de la DB,
 *  nunca desde un contador de pantalla. completeSession() recibe el valor
 *  ya calculado por calcularTiempoEfectivo() del módulo logic/timer.js.
 */

import { getDatabase } from './database';

// ─── Lecturas ─────────────────────────────────────────────────────────────────

/**
 * Devuelve sesiones completadas filtradas por período y/o actividad.
 *
 * @param {object} opts
 * @param {string|null} opts.from        - ISO 8601 inicio del rango (null = sin límite)
 * @param {string|null} opts.to          - ISO 8601 fin del rango   (null = sin límite)
 * @param {number|null} opts.activityId  - Filtrar por actividad específica (null = todas)
 * @param {number}      opts.limit       - Máximo de resultados
 * @returns {Promise<Session[]>}
 */
export async function getSessionsByFilter({ from = null, to = null, activityId = null, limit = 200 } = {}) {
  const db     = getDatabase();
  const params = [];
  const where  = ["s.status = 'completed'"];

  if (from)       { where.push('s.started_at >= ?'); params.push(from); }
  if (to)         { where.push('s.started_at <= ?'); params.push(to);   }
  if (activityId) { where.push('s.activity_id = ?'); params.push(activityId); }

  params.push(limit);

  return db.getAllAsync(
    `SELECT s.*,
            a.name  AS activity_name,
            a.icon  AS activity_icon,
            a.color AS activity_color
     FROM sessions s
     LEFT JOIN activities a ON s.activity_id = a.id
     WHERE ${where.join(' AND ')}
     ORDER BY s.started_at DESC
     LIMIT ?`,
    params
  );
}


export async function getActiveSession() {
  const db = getDatabase();
  return db.getFirstAsync(
    `SELECT s.*,
            a.name  AS activity_name,
            a.icon  AS activity_icon,
            a.color AS activity_color
     FROM sessions s
     LEFT JOIN activities a ON s.activity_id = a.id
     WHERE s.status IN ('active', 'paused')
     LIMIT 1`
  );
}

/**
 * Devuelve las pausas de una sesión, ordenadas cronológicamente.
 * @param {number} sessionId
 * @returns {Promise<SessionPause[]>}
 */
export async function getSessionPauses(sessionId) {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM session_pauses WHERE session_id = ? ORDER BY paused_at ASC',
    [sessionId]
  );
}

/**
 * Devuelve sesiones completadas para el historial.
 * @param {number} limit
 * @returns {Promise<Session[]>}
 */
export async function getSessionHistory(limit = 50) {
  const db = getDatabase();
  return db.getAllAsync(
    `SELECT s.*,
            a.name  AS activity_name,
            a.icon  AS activity_icon,
            a.color AS activity_color
     FROM sessions s
     LEFT JOIN activities a ON s.activity_id = a.id
     WHERE s.status = 'completed'
     ORDER BY s.started_at DESC
     LIMIT ?`,
    [limit]
  );
}

/**
 * Devuelve sesiones de hoy (no canceladas).
 */
export async function getTodaySessions() {
  const db  = getDatabase();
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date();
  fin.setHours(23, 59, 59, 999);
  return db.getAllAsync(
    `SELECT s.*,
            a.name  AS activity_name,
            a.icon  AS activity_icon,
            a.color AS activity_color
     FROM sessions s
     LEFT JOIN activities a ON s.activity_id = a.id
     WHERE s.started_at >= ? AND s.started_at <= ? AND s.status != 'cancelled'
     ORDER BY s.started_at DESC`,
    [inicio.toISOString(), fin.toISOString()]
  );
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

/**
 * Inicia una nueva sesión.
 * Lanza Error si ya hay una sesión activa o en pausa.
 *
 * @param {number} activityId
 * @returns {Promise<Session>} La sesión creada, con datos de la actividad
 */
export async function startSession(activityId) {
  const db = getDatabase();

  // Garantizar unicidad: solo una sesión activa a la vez
  const existente = await getActiveSession();
  if (existente) {
    throw new Error(
      'Ya hay una sesión en curso. Termínala antes de iniciar otra.'
    );
  }

  const now = new Date().toISOString();
  const resultado = await db.runAsync(
    `INSERT INTO sessions (activity_id, started_at, status, created_at)
     VALUES (?, ?, 'active', ?)`,
    [activityId, now, now]
  );

  // Devolver la sesión completa (con JOIN) para que useTimer tenga todos los datos
  return db.getFirstAsync(
    `SELECT s.*,
            a.name  AS activity_name,
            a.icon  AS activity_icon,
            a.color AS activity_color
     FROM sessions s
     LEFT JOIN activities a ON s.activity_id = a.id
     WHERE s.id = ?`,
    [resultado.lastInsertRowId]
  );
}

/**
 * Pausa una sesión activa.
 * Crea una fila en session_pauses sin resumed_at.
 *
 * @param {number} sessionId
 * @returns {Promise<{ pauseId: number, pausedAt: string }>}
 */
export async function pauseSession(sessionId) {
  const db  = getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    "UPDATE sessions SET status = 'paused' WHERE id = ?",
    [sessionId]
  );

  const resultado = await db.runAsync(
    'INSERT INTO session_pauses (session_id, paused_at) VALUES (?, ?)',
    [sessionId, now]
  );

  return { pauseId: resultado.lastInsertRowId, pausedAt: now };
}

/**
 * Reanuda una sesión pausada.
 * Cierra la pausa activa con resumed_at = ahora.
 *
 * @param {number} sessionId
 * @param {number} pauseId - ID de la pausa activa (sin resumed_at)
 * @returns {Promise<string>} La fecha de reanudación (ISO 8601)
 */
export async function resumeSession(sessionId, pauseId) {
  const db  = getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    'UPDATE session_pauses SET resumed_at = ? WHERE id = ?',
    [now, pauseId]
  );
  await db.runAsync(
    "UPDATE sessions SET status = 'active' WHERE id = ?",
    [sessionId]
  );

  return now;
}

/**
 * Completa una sesión correctamente.
 * Guarda el tiempo efectivo calculado (fuente de verdad = timestamps de DB).
 *
 * @param {number} sessionId
 * @param {number} effectiveMs - Tiempo efectivo en ms, calculado con calcularTiempoEfectivo()
 */
export async function completeSession(sessionId, effectiveMs) {
  const db  = getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE sessions
     SET status = 'completed', ended_at = ?, effective_ms = ?
     WHERE id = ?`,
    [now, Math.round(effectiveMs), sessionId]
  );
}

/**
 * Cancela una sesión (la descarta sin guardar tiempo efectivo).
 * @param {number} sessionId
 */
export async function cancelSession(sessionId) {
  const db  = getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    "UPDATE sessions SET status = 'cancelled', ended_at = ? WHERE id = ?",
    [now, sessionId]
  );
}


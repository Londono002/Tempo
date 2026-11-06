/**
 * activitiesService.js — Operaciones CRUD para actividades.
 *
 * Reglas de diseño:
 *
 * 1. Eliminación lógica (softDelete):
 *    Si la actividad ya tiene sesiones registradas, solo se marca deleted_at.
 *    La actividad deja de aparecer en la lista pero su historial se conserva.
 *
 * 2. Eliminación física (hardDelete):
 *    Solo se permite si la actividad NO tiene ninguna sesión.
 *    Borra el registro definitivamente de la base de datos.
 *
 * 3. Todas las funciones son async y devuelven Promises.
 *    Los errores no se silencian; se propagan para que las pantallas
 *    puedan mostrarlos al usuario si es necesario.
 */

import { getDatabase } from './database';

// ─── Consultas ────────────────────────────────────────────────────────────────

/**
 * Devuelve todas las actividades activas (no eliminadas), ordenadas por nombre.
 * @returns {Promise<Activity[]>}
 */
export async function getAllActivities() {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM activities WHERE deleted_at IS NULL ORDER BY name ASC'
  );
}

/**
 * Devuelve una actividad por su id, independientemente de si fue eliminada.
 * Útil para mostrar el nombre en el historial de sesiones antiguas.
 * @param {number} id
 * @returns {Promise<Activity|null>}
 */
export async function getActivityById(id) {
  const db = getDatabase();
  return db.getFirstAsync('SELECT * FROM activities WHERE id = ?', [id]);
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

/**
 * Crea una nueva actividad.
 * @param {string} name  - Nombre visible
 * @param {string} icon  - Nombre del icono de Ionicons (ej. 'book-outline')
 * @param {string} color - Color hex (ej. '#8B5CF6')
 * @returns {Promise<number>} id de la actividad creada
 */
export async function createActivity(name, icon, color) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const result = await db.runAsync(
    'INSERT INTO activities (name, icon, color, created_at) VALUES (?, ?, ?, ?)',
    [name.trim(), icon, color, now]
  );

  return result.lastInsertRowId;
}

/**
 * Actualiza el nombre, icono y color de una actividad existente.
 * @param {number} id
 * @param {string} name
 * @param {string} icon
 * @param {string} color
 */
export async function updateActivity(id, name, icon, color) {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE activities SET name = ?, icon = ?, color = ? WHERE id = ?',
    [name.trim(), icon, color, id]
  );
}

/**
 * Eliminación lógica: marca la actividad como eliminada sin borrar su historial.
 * Usar cuando la actividad tiene sesiones asociadas.
 * @param {number} id
 */
export async function softDeleteActivity(id) {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE activities SET deleted_at = ? WHERE id = ?',
    [now, id]
  );
}

/**
 * Eliminación física: borra la actividad definitivamente.
 * Solo segura cuando la actividad no tiene sesiones.
 * La pantalla debe verificar esto antes de llamar a esta función.
 * @param {number} id
 */
export async function hardDeleteActivity(id) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM activities WHERE id = ?', [id]);
}

/**
 * Comprueba si una actividad tiene sesiones registradas (incluso canceladas).
 * Se usa para decidir entre softDelete y hardDelete.
 * @param {number} activityId
 * @returns {Promise<boolean>}
 */
export async function activityHasSessions(activityId) {
  const db = getDatabase();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM sessions WHERE activity_id = ?',
    [activityId]
  );
  return row.count > 0;
}

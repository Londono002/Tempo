/**
 * database.js — Inicialización de la base de datos SQLite.
 *
 * Expo SDK 58 usa la API asíncrona de expo-sqlite:
 *   - openDatabaseAsync()   → abre (o crea) la base de datos
 *   - execAsync()           → ejecuta sentencias DDL (CREATE TABLE)
 *   - runAsync()            → INSERT / UPDATE / DELETE
 *   - getFirstAsync()       → SELECT que devuelve una fila
 *   - getAllAsync()          → SELECT que devuelve todas las filas
 *
 * La base de datos se crea en el directorio de datos privado de la app;
 * el usuario no puede acceder a ella directamente, lo que está bien para
 * datos locales de la aplicación.
 *
 * Esquema de tablas:
 *
 *  activities
 *    id          INTEGER PK AUTOINCREMENT
 *    name        TEXT    NOT NULL
 *    icon        TEXT    NOT NULL   (nombre del icono de Ionicons)
 *    color       TEXT    NOT NULL   (hex color)
 *    created_at  TEXT    NOT NULL   (ISO 8601)
 *    deleted_at  TEXT               (NULL = activa; fecha = eliminada lógicamente)
 *
 *  sessions
 *    id           INTEGER PK AUTOINCREMENT
 *    activity_id  INTEGER REFERENCES activities(id)
 *    started_at   TEXT    NOT NULL   (ISO 8601)
 *    ended_at     TEXT               (NULL = sesión en curso)
 *    effective_ms INTEGER            (tiempo efectivo en ms, calculado al cerrar)
 *    status       TEXT    NOT NULL   ('active' | 'paused' | 'completed' | 'cancelled')
 *    note         TEXT
 *    created_at   TEXT    NOT NULL
 *
 *  session_pauses
 *    id          INTEGER PK AUTOINCREMENT
 *    session_id  INTEGER REFERENCES sessions(id)
 *    paused_at   TEXT    NOT NULL
 *    resumed_at  TEXT               (NULL = pausa en curso)
 *
 * Regla: este archivo solo contiene la apertura y el DDL.
 * Las operaciones CRUD están en activitiesService.js y sessionsService.js.
 */

import * as SQLite from 'expo-sqlite';

let _db = null;

/**
 * Abre la base de datos y crea las tablas si no existen.
 * Se llama una sola vez al arrancar la app.
 * Las llamadas posteriores devuelven la instancia ya abierta.
 */
export async function initDatabase() {
  if (_db) return _db;

  _db = await SQLite.openDatabaseAsync('cozy_tracker.db');

  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS activities (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      icon       TEXT    NOT NULL DEFAULT 'leaf-outline',
      color      TEXT    NOT NULL DEFAULT '#8B5CF6',
      created_at TEXT    NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id  INTEGER REFERENCES activities(id),
      started_at   TEXT    NOT NULL,
      ended_at     TEXT,
      effective_ms INTEGER,
      status       TEXT    NOT NULL DEFAULT 'active',
      note         TEXT,
      created_at   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_pauses (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id),
      paused_at  TEXT    NOT NULL,
      resumed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  return _db;
}

/**
 * Devuelve la instancia de la base de datos.
 * Solo debe llamarse después de que initDatabase() haya resuelto.
 */
export function getDatabase() {
  if (!_db) {
    throw new Error(
      'getDatabase() llamado antes de initDatabase(). ' +
      'Asegúrate de llamar initDatabase() al arrancar la app.'
    );
  }
  return _db;
}

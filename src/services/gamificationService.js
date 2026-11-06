/**
 * gamificationService.js — Consulta el estado de gamificación desde la BD.
 *
 * Calcula todo dinámicamente desde las sesiones completadas.
 * No requiere tabla propia: los datos son siempre consistentes con la BD.
 */

import { getDatabase } from './database';
import {
  calcularXP,
  getLevelInfo,
  calcularRacha,
  getUnlockedAchievements,
} from '../logic/gamification';
import { fechaLocalISO } from '../logic/stats';

/**
 * Devuelve el estado completo de gamificación del usuario.
 *
 * @returns {Promise<GamificationState>}
 *   {
 *     xp, level, levelName, levelEmoji,
 *     xpProgress, xpInLevel, xpToNext, isMaxLevel,
 *     streak,
 *     totalMs, totalSessions, longestSessionMs, totalActivities,
 *     unlockedAchievements: string[]
 *   }
 */
export async function getGamificationState() {
  const db = getDatabase();

  // Una sola consulta: todas las sesiones completadas
  const sessions = await db.getAllAsync(
    `SELECT s.effective_ms, s.started_at, s.activity_id
     FROM sessions s
     WHERE s.status = 'completed'`
  );

  // Métricas base
  const totalMs         = sessions.reduce((acc, s) => acc + (s.effective_ms ?? 0), 0);
  const totalSessions   = sessions.length;
  const longestSessionMs = sessions.reduce((max, s) => Math.max(max, s.effective_ms ?? 0), 0);
  const totalActivities = new Set(sessions.map(s => s.activity_id)).size;

  // XP y nivel
  const xp        = calcularXP(totalMs);
  const levelInfo = getLevelInfo(xp);

  // Racha: extraer fechas 'YYYY-MM-DD' de cada sesión
  const fechas = sessions.map(s => fechaLocalISO(new Date(s.started_at)));
  const streak = calcularRacha(fechas);

  // Logros desbloqueados
  const unlockedAchievements = getUnlockedAchievements({
    totalSessions,
    totalMs,
    streak,
    longestSessionMs,
    totalActivities,
  });

  return {
    xp,
    level:       levelInfo.level,
    levelName:   levelInfo.name,
    levelEmoji:  levelInfo.emoji,
    xpProgress:  levelInfo.xpProgress,
    xpInLevel:   levelInfo.xpInLevel,
    xpToNext:    levelInfo.xpToNext,
    isMaxLevel:  levelInfo.isMaxLevel,
    streak,
    totalMs,
    totalSessions,
    longestSessionMs,
    totalActivities,
    unlockedAchievements,
  };
}

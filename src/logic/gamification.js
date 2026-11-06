/**
 * gamification.js — Lógica pura del sistema de progresión.
 *
 * Regla: ninguna función importa React ni accede a la BD.
 * Recibe datos ya calculados y devuelve estado de gamificación.
 *
 * ─── Sistema de XP ────────────────────────────────────────────────────────────
 *  1 XP = 1 minuto de tiempo efectivo completado.
 *  Simple, transparente y directamente ligado al esfuerzo real.
 *
 * ─── Niveles ──────────────────────────────────────────────────────────────────
 *  10 niveles con nombres cozy inspirados en el mundo natural.
 *  Cada umbral equivale a un hito de tiempo total realista.
 *
 * ─── Racha (streak) ───────────────────────────────────────────────────────────
 *  Días consecutivos con al menos una sesión completada.
 *  Si el último día activo fue hace 2+ días, la racha se rompe.
 *  Se permite un día de gracia (ayer cuenta como racha activa).
 *
 * ─── Logros ───────────────────────────────────────────────────────────────────
 *  Se calculan dinámicamente desde el estado actual.
 *  No requieren tabla extra en la BD.
 */

// ─── Niveles ──────────────────────────────────────────────────────────────────

/**
 * Tabla de niveles.
 * xp = umbral mínimo para alcanzar ese nivel.
 * emoji = elemento decorativo que se muestra junto al nivel.
 */
export const LEVELS = [
  { level: 1,  name: 'Brote',    emoji: '🌱', xp: 0     },
  { level: 2,  name: 'Semilla',  emoji: '🌿', xp: 60    },  // ~1 hora
  { level: 3,  name: 'Plántula', emoji: '🍃', xp: 200   },  // ~3 horas
  { level: 4,  name: 'Arbusto',  emoji: '🌾', xp: 500   },  // ~8 horas
  { level: 5,  name: 'Árbol',    emoji: '🌳', xp: 1000  },  // ~17 horas
  { level: 6,  name: 'Jardín',   emoji: '🌸', xp: 2000  },  // ~33 horas
  { level: 7,  name: 'Bosque',   emoji: '🌲', xp: 3500  },  // ~58 horas
  { level: 8,  name: 'Selva',    emoji: '🌴', xp: 6000  },  // ~100 horas
  { level: 9,  name: 'Oasis',    emoji: '🏝️', xp: 10000 },  // ~167 horas
  { level: 10, name: 'Cosmos',   emoji: '✨', xp: 20000 },  // ~333 horas
];

/**
 * Devuelve la información de nivel para una cantidad de XP dada.
 * @param {number} xp
 * @returns {{ level, name, emoji, xpForCurrentLevel, xpForNextLevel, xpProgress }}
 */
export function getLevelInfo(xp) {
  let current = LEVELS[0];
  let next    = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      current = LEVELS[i];
      next    = LEVELS[i + 1] ?? null; // null en el nivel máximo
      break;
    }
  }

  const xpInLevel   = xp - current.xp;
  const xpToNext    = next ? next.xp - current.xp : 1;
  const xpProgress  = next ? Math.min(xpInLevel / xpToNext, 1) : 1;

  return {
    level:             current.level,
    name:              current.name,
    emoji:             current.emoji,
    xpForCurrentLevel: current.xp,
    xpForNextLevel:    next?.xp ?? null,
    xpProgress,       // 0.0 → 1.0 para la barra de progreso
    xpInLevel,        // XP acumulados dentro del nivel actual
    xpToNext:         next ? next.xp - current.xp : null,
    isMaxLevel:       !next,
  };
}

// ─── XP ───────────────────────────────────────────────────────────────────────

/**
 * Calcula el XP total a partir del tiempo efectivo acumulado.
 * @param {number} totalMs
 * @returns {number}
 */
export function calcularXP(totalMs) {
  return Math.floor(totalMs / 60000); // 1 XP por minuto
}

// ─── Racha ────────────────────────────────────────────────────────────────────

/**
 * Calcula la racha de días consecutivos con sesiones completadas.
 *
 * @param {string[]} fechasSesiones - Array de fechas 'YYYY-MM-DD' (puede haber duplicados)
 * @returns {number} Número de días consecutivos (0 si no hay sesiones o la racha se rompió)
 */
export function calcularRacha(fechasSesiones) {
  if (fechasSesiones.length === 0) return 0;

  // Días únicos con actividad, ordenados descendentemente
  const diasUnicos = [...new Set(fechasSesiones)].sort().reverse();

  const hoy  = isoHoy();
  const ayer  = isoAyer();

  // Si el último día activo no es hoy ni ayer, la racha se rompió
  if (diasUnicos[0] !== hoy && diasUnicos[0] !== ayer) return 0;

  // Contar días consecutivos desde el más reciente
  let racha        = 1;
  let diaAnterior  = diasUnicos[0];

  for (let i = 1; i < diasUnicos.length; i++) {
    const esperado = isoRestar1Dia(diaAnterior);
    if (diasUnicos[i] === esperado) {
      racha++;
      diaAnterior = diasUnicos[i];
    } else {
      break;
    }
  }

  return racha;
}

// ─── Logros ───────────────────────────────────────────────────────────────────

/**
 * Catálogo de todos los logros posibles.
 * condition recibe el estado de gamificación y devuelve true si está desbloqueado.
 */
export const ACHIEVEMENTS = [
  {
    key:   'primera_sesion',
    title: 'Primera chispa',
    desc:  'Completaste tu primera sesión',
    icon:  'sparkles-outline',
    check: (s) => s.totalSessions >= 1,
  },
  {
    key:   'media_hora',
    title: '30 minutos',
    desc:  'Sesión continua de al menos 30 minutos',
    icon:  'hourglass-outline',
    check: (s) => s.longestSessionMs >= 30 * 60 * 1000,
  },
  {
    key:   'primera_hora',
    title: 'Primera hora',
    desc:  'Acumulaste 60 minutos en total',
    icon:  'time-outline',
    check: (s) => s.totalMs >= 60 * 60 * 1000,
  },
  {
    key:   'racha_3',
    title: '3 días seguidos',
    desc:  'Racha de 3 días consecutivos',
    icon:  'flame-outline',
    check: (s) => s.streak >= 3,
  },
  {
    key:   'racha_7',
    title: 'Semana perfecta',
    desc:  'Racha de 7 días consecutivos',
    icon:  'trophy-outline',
    check: (s) => s.streak >= 7,
  },
  {
    key:   'diez_horas',
    title: '10 horas',
    desc:  'Acumulaste 10 horas en total',
    icon:  'star-outline',
    check: (s) => s.totalMs >= 10 * 60 * 60 * 1000,
  },
  {
    key:   'multitarea',
    title: 'Multitarea cozy',
    desc:  'Usaste 5 actividades distintas',
    icon:  'grid-outline',
    check: (s) => s.totalActivities >= 5,
  },
  {
    key:   'cincuenta_horas',
    title: '50 horas',
    desc:  'Acumulaste 50 horas en total',
    icon:  'ribbon-outline',
    check: (s) => s.totalMs >= 50 * 60 * 60 * 1000,
  },
];

/**
 * Devuelve las claves de los logros desbloqueados según el estado actual.
 * @param {object} state
 * @returns {string[]} claves de logros desbloqueados
 */
export function getUnlockedAchievements(state) {
  return ACHIEVEMENTS
    .filter(a => a.check(state))
    .map(a => a.key);
}

// ─── Utilidades de fecha ───────────────────────────────────────────────────────

function isoHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function isoAyer() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function isoRestar1Dia(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  fecha.setDate(fecha.getDate() - 1);
  return `${fecha.getFullYear()}-${pad(fecha.getMonth()+1)}-${pad(fecha.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

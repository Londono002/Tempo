/**
 * colors.js — Paletas de colores del proyecto.
 *
 * Se exportan dos paletas completas (light / dark) y una función
 * getColors(scheme) que devuelve la paleta correcta.
 *
 * Criterio de diseño oscuro:
 * - Fondos: púrpura-negro profundo con tonos cálidos (no gris frío)
 * - Texto: lavanda claro con buena legibilidad
 * - Accentos y primarios: se mantienen igual en ambos modos
 */

// ─── Tokens compartidos (no cambian entre modos) ───────────────────────────────

const shared = {
  primary: {
    50:  '#F5F0FF',
    100: '#EDE5FF',
    200: '#D8C8FF',
    300: '#BFA3FF',
    400: '#A57EFF',
    500: '#8B5CF6',
    600: '#7C3AED',
  },
  accent: {
    100: '#E8F0E9',
    200: '#C8DEC9',
    400: '#7EAA80',
    500: '#5C8B5E',
  },
  rose: {
    100: '#FFE8EF',
    200: '#FFC4D4',
    400: '#F48CAA',
  },
  state: {
    active:  '#5C8B5E',
    paused:  '#A57EFF',
    idle:    '#A898C0',
  },
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
};

// ─── Paleta clara ─────────────────────────────────────────────────────────────

export const lightColors = {
  ...shared,
  cream: {
    50:  '#FDFAF5',
    100: '#FAF5EB',
    200: '#F2E9D4',
  },
  text: {
    primary:   '#2D2040',
    secondary: '#6B5B8A',
    muted:     '#A898C0',
    inverse:   '#FFFFFF',
  },
  background: {
    screen:  '#F5F0FF',
    card:    '#FFFFFF',
    cardAlt: '#FAF5EB',
    overlay: 'rgba(45, 32, 64, 0.4)',
  },
  tab: {
    active:     '#8B5CF6',
    inactive:   '#A898C0',
    border:     '#EDE5FF',
    background: '#FFFFFF',
  },
  shadow: '#2D2040',
};

// ─── Paleta oscura ────────────────────────────────────────────────────────────

export const darkColors = {
  ...shared,
  cream: {
    50:  '#1E1A2C',
    100: '#221E30',
    200: '#2A2440',
  },
  text: {
    primary:   '#EDE5FF',
    secondary: '#B8A9D4',
    muted:     '#7A6B9A',
    inverse:   '#14101E',
  },
  background: {
    screen:  '#14101E',
    card:    '#1E1830',
    cardAlt: '#1A2820',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  tab: {
    active:     '#A57EFF',
    inactive:   '#5A4E7A',
    border:     '#2D2248',
    background: '#1A1628',
  },
  shadow: '#000000',
};

/**
 * Devuelve la paleta correcta según el esquema del sistema.
 * @param {'light'|'dark'|null|undefined} scheme
 * @returns {typeof lightColors}
 */
export function getColors(scheme) {
  return scheme === 'dark' ? darkColors : lightColors;
}

// Export por defecto: paleta clara (retrocompatibilidad con código existente)
export default lightColors;

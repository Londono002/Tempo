/**
 * spacing.js
 * Sistema de espaciado consistente basado en una cuadrícula de 4 puntos.
 *
 * Uso: spacing.md (16), spacing.lg (24), etc.
 * Evitar usar números mágicos directamente en los estilos.
 */

const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   24,
  xl:   32,
  xxl:  48,
  huge: 64,

  // Radios de borde — accesibles como spacing.radius.lg
  radius: {
    sm:   8,
    md:   12,
    lg:   16,
    xl:   24,
    full: 9999,
  },
};

export default spacing;


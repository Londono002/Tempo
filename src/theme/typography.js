/**
 * typography.js
 * Sistema tipográfico con Nunito.
 *
 * Las fuentes se cargan en App.js con expo-font.
 * Este archivo define las constantes de tamaño, peso y altura de línea
 * para usarlas de forma consistente en toda la app.
 */

/**
 * Nombres de fuente disponibles después de cargar Nunito con expo-font.
 * Se usan como valor de `fontFamily` en StyleSheet.
 */
export const fonts = {
  regular:  'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold:     'Nunito_700Bold',
};

/**
 * Escala de tamaños tipográficos.
 * Criterio: mínimo 14px para legibilidad en móvil.
 */
export const fontSize = {
  xs:    12,  // etiquetas muy pequeñas, metadata
  sm:    14,  // cuerpo secundario, descripciones
  base:  16,  // cuerpo principal
  md:    18,  // subtítulos, valores destacados
  lg:    22,  // títulos de sección
  xl:    28,  // títulos de pantalla
  xxl:   40,  // display grande (ej. tiempo en temporizador)
  timer: 56,  // dígitos del temporizador en la pantalla de sesión
};

/**
 * Alturas de línea recomendadas por tamaño.
 * Nunito funciona bien con multiplicadores de 1.4–1.6.
 */
export const lineHeight = {
  tight:   1.2,  // títulos grandes
  normal:  1.4,  // cuerpo de texto
  relaxed: 1.6,  // texto de apoyo, listas
};

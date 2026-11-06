/**
 * activityOptions.js
 * Catálogo curado de iconos y colores disponibles para actividades.
 *
 * Criterios de selección:
 * - ~20 iconos de Ionicons que cubren las actividades cotidianas más comunes.
 * - 8 colores armónicos con la paleta cozy del proyecto.
 * - Usados en el selector de icono y color al crear/editar una actividad.
 */

// ─── Iconos ───────────────────────────────────────────────────────────────────
// Cada entrada tiene:
//   key   → nombre del icono Ionicons (variante outline)
//   label → etiqueta visible en español

export const ACTIVITY_ICONS = [
  { key: 'book-outline',             label: 'Leer'         },
  { key: 'laptop-outline',           label: 'Trabajar'     },
  { key: 'school-outline',           label: 'Estudiar'     },
  { key: 'barbell-outline',          label: 'Ejercicio'    },
  { key: 'walk-outline',             label: 'Caminar'      },
  { key: 'bicycle-outline',          label: 'Bicicleta'    },
  { key: 'leaf-outline',             label: 'Naturaleza'   },
  { key: 'musical-notes-outline',    label: 'Música'       },
  { key: 'brush-outline',            label: 'Arte'         },
  { key: 'pencil-outline',           label: 'Escribir'     },
  { key: 'code-slash-outline',       label: 'Programar'    },
  { key: 'language-outline',         label: 'Idiomas'      },
  { key: 'camera-outline',           label: 'Fotografía'   },
  { key: 'headset-outline',          label: 'Podcast'      },
  { key: 'game-controller-outline',  label: 'Juegos'       },
  { key: 'restaurant-outline',       label: 'Cocinar'      },
  { key: 'cafe-outline',             label: 'Descanso'     },
  { key: 'heart-outline',            label: 'Bienestar'    },
  { key: 'people-outline',           label: 'Social'       },
  { key: 'planet-outline',           label: 'Ciencia'      },
];

// ─── Colores ──────────────────────────────────────────────────────────────────
// Paleta de 8 colores armónicos con el tema cozy del proyecto.

export const ACTIVITY_COLORS = [
  { hex: '#8B5CF6', label: 'Lavanda'  },
  { hex: '#F472B6', label: 'Rosa'     },
  { hex: '#FB923C', label: 'Naranja'  },
  { hex: '#FBBF24', label: 'Amarillo' },
  { hex: '#5C8B5E', label: 'Salvia'   },
  { hex: '#60A5FA', label: 'Cielo'    },
  { hex: '#F87171', label: 'Coral'    },
  { hex: '#A78BFA', label: 'Lila'     },
];

// Valores por defecto al crear una nueva actividad
export const DEFAULT_ICON  = 'leaf-outline';
export const DEFAULT_COLOR = '#8B5CF6';

/**
 * ThemeContext.js — Proveedor y hook del tema visual.
 *
 * Detecta automáticamente el esquema del sistema (claro u oscuro)
 * y provee la paleta de colores correcta a toda la app.
 *
 * Uso en cualquier componente:
 *   const { colors, scheme } = useTheme();
 *
 * No es necesario hacer nada extra: si el usuario cambia el modo
 * en Configuración del sistema, la app se actualiza sola.
 */

import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { getColors } from '../theme/colors';

const ThemeContext = createContext({ colors: getColors('light'), scheme: 'light' });

/**
 * Envuelve la app y provee el tema detectado del sistema.
 */
export function ThemeProvider({ children }) {
  const scheme = useColorScheme(); // 'light' | 'dark' | null
  const colors = getColors(scheme);

  return (
    <ThemeContext.Provider value={{ colors, scheme: scheme ?? 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook para acceder al tema desde cualquier componente.
 * @returns {{ colors: Colors, scheme: 'light' | 'dark' }}
 */
export function useTheme() {
  return useContext(ThemeContext);
}

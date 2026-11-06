/**
 * App.js — Punto de entrada de la aplicación.
 *
 * Responsabilidades:
 * 1. Cargar la fuente Nunito con expo-font (useFonts).
 * 2. Inicializar la base de datos SQLite (initDatabase).
 * 3. Mantener la splash screen visible hasta que ambas operaciones terminen.
 * 4. Proveer ThemeProvider (modo claro/oscuro automático).
 * 5. Montar el NavigationContainer con el AppNavigator.
 *
 * No contiene lógica de negocio. Solo configuración de la shell de la app.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { initDatabase } from './src/services/database';

// Mantener la splash screen visible mientras cargamos recursos
SplashScreen.preventAutoHideAsync();

// ─── Shell interna (necesita acceso al theme) ──────────────────────────────────

function AppShell({ onLayout }) {
  const { colors, scheme } = useTheme();

  // Personalizar el tema de React Navigation para que los fondos coincidan
  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background:   colors.background.screen,
      card:         colors.tab.background,
      border:       colors.tab.border,
      text:         colors.text.primary,
      primary:      colors.primary[500],
      notification: colors.primary[400],
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.screen }} onLayout={onLayout}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <AppNavigator />
      </NavigationContainer>
    </View>
  );
}

// ─── Componente raíz ──────────────────────────────────────────────────────────

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  const [dbReady, setDbReady] = useState(false);

  // Inicializar SQLite en paralelo con la carga de fuentes
  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch(err => {
        console.error('Error al inicializar la base de datos:', err);
        setDbReady(true); // Siempre mostrar la app aunque haya fallo de BD
      });
  }, []);

  const appReady = (fontsLoaded || fontError) && dbReady;

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell onLayout={onLayoutRootView} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

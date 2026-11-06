/**
 * index.js — Punto de entrada de Expo.
 *
 * IMPORTANTE: react-native-gesture-handler DEBE ser el primer import.
 * React Navigation lo requiere así o la app falla en runtime.
 */

import 'react-native-gesture-handler';   // ← SIEMPRE PRIMERO
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);

/**
 * PomodoroSphere.js — Tomate 3D animado para la pantalla del temporizador.
 *
 * Usa el Animated API nativo de React Native:
 * - transform: [{ perspective }, { rotateY }] → rotación 3D real con perspectiva
 * - Animación de balanceo suave (oscila ±20°) para mantener el texto legible
 * - Animación de respiración (scale sube y baja) cuando está activo
 * - Capas anidadas para simular profundidad y luz del tomate
 * - Hoja y tallo decorativos con CSS shapes
 *
 * No requiere paquetes adicionales — funciona con React Native puro.
 *
 * Props:
 *   status       'idle' | 'active' | 'paused'
 *   elapsedMs    milisegundos efectivos (para el contador encima)
 *   timerText    string ya formateado (HH:MM:SS)
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts, fontSize } from '../theme/typography';

// ─── Constantes de animación ──────────────────────────────────────────────────

const SWING_DURATION_ACTIVE  = 3200;   // ms por ciclo completo cuando corre
const SWING_DURATION_PAUSED  = 6000;   // más lento cuando en pausa
const SWING_DURATION_IDLE    = 9000;   // muy lento en reposo
const SWING_ANGLE            = 22;     // grados de balanceo máximo
const BREATHE_DURATION       = 2200;   // ms por ciclo de respiración
const BREATHE_SCALE_MAX      = 1.03;   // expansión al respirar

// ─── Colores del tomate ───────────────────────────────────────────────────────

const TOMATO = {
  base:      '#E53935',  // rojo tomate
  light:     '#EF5350',  // más claro (lado iluminado)
  dark:      '#B71C1C',  // oscuro (lado en sombra)
  highlight: 'rgba(255, 255, 255, 0.35)', // brillo especular
  leaf:      '#2E7D32',
  leafLight: '#43A047',
  stem:      '#33691E',
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PomodoroSphere({ status = 'idle', timerText = '00:00:00' }) {
  const { colors, scheme } = useTheme();

  const swingAnim  = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(0)).current;

  // ─── Animación de balanceo ────────────────────────────────────────────────

  useEffect(() => {
    const duration =
      status === 'active' ? SWING_DURATION_ACTIVE :
      status === 'paused' ? SWING_DURATION_PAUSED :
      SWING_DURATION_IDLE;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(swingAnim, {
          toValue:         1,
          duration:        duration / 2,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(swingAnim, {
          toValue:         -1,
          duration:        duration,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(swingAnim, {
          toValue:         0,
          duration:        duration / 2,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [status]);

  // ─── Animación de respiración (solo cuando activo) ────────────────────────

  useEffect(() => {
    if (status !== 'active') {
      breatheAnim.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue:         1,
          duration:        BREATHE_DURATION,
          easing:          Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue:         0,
          duration:        BREATHE_DURATION,
          easing:          Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [status]);

  // ─── Interpolaciones ──────────────────────────────────────────────────────

  const rotateY = swingAnim.interpolate({
    inputRange:  [-1, 1],
    outputRange: [`-${SWING_ANGLE}deg`, `${SWING_ANGLE}deg`],
  });

  const rotateZ = swingAnim.interpolate({
    inputRange:  [-1, 1],
    outputRange: ['-3deg', '3deg'],
  });

  const scale = breatheAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [1, BREATHE_SCALE_MAX],
  });

  const opacity = status === 'paused' ? 0.72 : 1;

  return (
    <View style={styles.container}>

      {/* Sombra en el suelo */}
      <Animated.View style={[styles.shadow, {
        transform: [{ scaleX: scale }],
        opacity:   status === 'paused' ? 0.2 : 0.3,
      }]} />

      {/* Tomate 3D */}
      <Animated.View
        style={[
          styles.sphereWrapper,
          {
            opacity,
            transform: [
              { perspective: 900 },
              { rotateY },
              { rotateZ },
              { scale },
            ],
          },
        ]}
      >
        {/* Cuerpo del tomate */}
        <View style={styles.tomatoBody}>

          {/* Lado oscuro (derecha, sombra) */}
          <View style={styles.darkSide} />

          {/* Brillo especular (arriba-izquierda) */}
          <View style={styles.highlight} />

          {/* Brillo secundario (más pequeño) */}
          <View style={styles.highlight2} />

          {/* Líneas de segmento del tomate */}
          <View style={[styles.segment, { transform: [{ rotate: '0deg'   }] }]} />
          <View style={[styles.segment, { transform: [{ rotate: '60deg'  }] }]} />
          <View style={[styles.segment, { transform: [{ rotate: '120deg' }] }]} />

          {/* Texto del timer encima */}
          <View style={styles.timerContainer}>
            <Text style={[
              styles.timerText,
              status === 'paused' && styles.timerTextPaused,
            ]}>
              {timerText}
            </Text>
            <Text style={styles.timerLabel}>
              {status === 'active' ? 'en curso' : status === 'paused' ? 'pausado' : ''}
            </Text>
          </View>

        </View>

        {/* Hoja izquierda */}
        <View style={[styles.leaf, styles.leafLeft]} />
        {/* Hoja derecha */}
        <View style={[styles.leaf, styles.leafRight]} />
        {/* Tallo */}
        <View style={styles.stem} />

      </Animated.View>

    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const SIZE = 200; // diámetro del tomate en px

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: SIZE + 60,
  },

  // Sombra debajo del tomate
  shadow: {
    position:        'absolute',
    bottom:          0,
    width:           SIZE * 0.7,
    height:          20,
    borderRadius:    SIZE * 0.35,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  // Wrapper animable (recibe las transformaciones 3D)
  sphereWrapper: {
    alignItems:     'center',
    justifyContent: 'flex-end',
    marginBottom:   20,
  },

  // Cuerpo principal del tomate
  tomatoBody: {
    width:           SIZE,
    height:          SIZE,
    borderRadius:    SIZE / 2,
    backgroundColor: TOMATO.base,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',

    // Elevación para profundidad
    shadowColor:   '#000',
    shadowOffset:  { width: 8, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius:  20,
    elevation:     20,
  },

  // Lado oscuro (sombra derecha interna)
  darkSide: {
    position:        'absolute',
    right:           0,
    top:             0,
    width:           SIZE * 0.42,
    height:          SIZE,
    borderTopRightRadius:    SIZE / 2,
    borderBottomRightRadius: SIZE / 2,
    backgroundColor:         TOMATO.dark,
    opacity:                 0.55,
  },

  // Brillo principal (arriba izquierda)
  highlight: {
    position:        'absolute',
    top:             SIZE * 0.1,
    left:            SIZE * 0.12,
    width:           SIZE * 0.3,
    height:          SIZE * 0.22,
    borderRadius:    SIZE * 0.15,
    backgroundColor: TOMATO.highlight,
    transform:       [{ rotate: '-30deg' }],
  },

  // Brillo secundario (más pequeño)
  highlight2: {
    position:        'absolute',
    top:             SIZE * 0.26,
    left:            SIZE * 0.15,
    width:           SIZE * 0.13,
    height:          SIZE * 0.09,
    borderRadius:    SIZE * 0.07,
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform:       [{ rotate: '-20deg' }],
  },

  // Líneas de segmento (simula las divisiones de un tomate)
  segment: {
    position:        'absolute',
    width:           1.5,
    height:          SIZE,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },

  // Timer text
  timerContainer: {
    alignItems: 'center',
    gap:        2,
  },
  timerText: {
    fontFamily: fonts.bold,
    fontSize:   fontSize.timer,
    color:      'rgba(255,255,255,0.95)',
    letterSpacing: 1.5,
    textShadowColor:  'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
  },
  timerTextPaused: {
    color: 'rgba(255,255,255,0.65)',
  },
  timerLabel: {
    fontFamily: fonts.semibold,
    fontSize:   fontSize.xs,
    color:      'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textShadowColor:  'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Tallo
  stem: {
    width:           5,
    height:          18,
    backgroundColor: TOMATO.stem,
    borderRadius:    3,
    marginTop:       -2,
  },

  // Hojas
  leaf: {
    position:        'absolute',
    width:           22,
    height:          14,
    backgroundColor: TOMATO.leaf,
    borderRadius:    100,
    top:             0,
  },
  leafLeft: {
    left:      SIZE / 2 - 28,
    transform: [{ rotate: '-40deg' }],
  },
  leafRight: {
    left:            SIZE / 2 + 6,
    backgroundColor: TOMATO.leafLight,
    transform:       [{ rotate: '40deg' }],
  },
});

/**
 * PlantWidget.js — Planta cozy animada para la pantalla principal.
 *
 * La planta crece visualmente según el nivel del usuario (1-10).
 * Se balancea suavemente de forma continua simulando el viento.
 *
 * Arquitectura visual:
 *   [Hojas / flor]  ← aparecen progresivamente con el nivel
 *      |
 *   [Tallo]         ← altura aumenta con el nivel
 *      |
 *   [Maceta]        ← siempre visible, terracota
 *
 * Animaciones:
 *   - Balanceo: rotateZ ±4° lentamente (Animated API, useNativeDriver)
 *   - No usa WebGL ni paquetes externos
 *
 * Props:
 *   level      number (1-10)  — nivel actual del usuario
 *   xpProgress number (0-1)  — fracción dentro del nivel actual
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts, fontSize } from '../theme/typography';
import spacing from '../theme/spacing';

// ─── Paleta de la planta ──────────────────────────────────────────────────────

const GREEN = {
  stem:       '#388E3C',
  leafDark:   '#2E7D32',
  leafMid:    '#43A047',
  leafLight:  '#66BB6A',
  bud:        '#A5D6A7',
  flower:     '#F48FB1',
  flowerCore: '#FFF176',
};
const POT = {
  body:       '#BF6A3D',
  rim:        '#D2845A',
  soil:       '#4E342E',
  soilLight:  '#6D4C41',
};

// ─── Configuración por nivel ──────────────────────────────────────────────────

/**
 * Devuelve la configuración visual de la planta para un nivel dado.
 * stemH:  altura del tallo en px
 * leaves: array de hojas { side, yFrac, size }
 *          side: 'left' | 'right'
 *          yFrac: fracción desde abajo del tallo (0 = base, 1 = punta)
 *          size:  ancho de la hoja en px
 * hasBud, hasFlower, hasFruit: booleanos decorativos
 */
function getPlantConfig(level) {
  switch (level) {
    case 1:
      return { stemH: 28, leaves: [], hasBud: false, hasFlower: false, hasFruit: false };
    case 2:
      return {
        stemH: 55,
        leaves: [
          { side: 'left',  yFrac: 0.55, size: 30 },
          { side: 'right', yFrac: 0.55, size: 30 },
        ],
        hasBud: false, hasFlower: false, hasFruit: false,
      };
    case 3:
      return {
        stemH: 80,
        leaves: [
          { side: 'left',  yFrac: 0.60, size: 36 },
          { side: 'right', yFrac: 0.60, size: 36 },
          { side: 'left',  yFrac: 0.30, size: 26 },
          { side: 'right', yFrac: 0.30, size: 26 },
        ],
        hasBud: false, hasFlower: false, hasFruit: false,
      };
    case 4:
      return {
        stemH: 100,
        leaves: [
          { side: 'left',  yFrac: 0.65, size: 40 },
          { side: 'right', yFrac: 0.65, size: 40 },
          { side: 'left',  yFrac: 0.35, size: 30 },
          { side: 'right', yFrac: 0.35, size: 30 },
        ],
        hasBud: true, hasFlower: false, hasFruit: false,
      };
    case 5:
      return {
        stemH: 120,
        leaves: [
          { side: 'left',  yFrac: 0.70, size: 44 },
          { side: 'right', yFrac: 0.70, size: 44 },
          { side: 'left',  yFrac: 0.45, size: 34 },
          { side: 'right', yFrac: 0.45, size: 34 },
          { side: 'left',  yFrac: 0.20, size: 24 },
          { side: 'right', yFrac: 0.20, size: 24 },
        ],
        hasBud: false, hasFlower: true, hasFruit: false,
      };
    case 6:
      return {
        stemH: 138,
        leaves: [
          { side: 'left',  yFrac: 0.72, size: 48 },
          { side: 'right', yFrac: 0.72, size: 48 },
          { side: 'left',  yFrac: 0.50, size: 38 },
          { side: 'right', yFrac: 0.50, size: 38 },
          { side: 'left',  yFrac: 0.25, size: 28 },
          { side: 'right', yFrac: 0.25, size: 28 },
        ],
        hasBud: false, hasFlower: true, hasFruit: false,
      };
    case 7:
      return {
        stemH: 150,
        leaves: [
          { side: 'left',  yFrac: 0.75, size: 50 },
          { side: 'right', yFrac: 0.75, size: 50 },
          { side: 'left',  yFrac: 0.55, size: 42 },
          { side: 'right', yFrac: 0.55, size: 42 },
          { side: 'left',  yFrac: 0.32, size: 34 },
          { side: 'right', yFrac: 0.32, size: 34 },
          { side: 'left',  yFrac: 0.12, size: 24 },
          { side: 'right', yFrac: 0.12, size: 24 },
        ],
        hasBud: false, hasFlower: true, hasFruit: true,
      };
    case 8:
      return {
        stemH: 160,
        leaves: [
          { side: 'left',  yFrac: 0.78, size: 54 },
          { side: 'right', yFrac: 0.78, size: 54 },
          { side: 'left',  yFrac: 0.58, size: 46 },
          { side: 'right', yFrac: 0.58, size: 46 },
          { side: 'left',  yFrac: 0.36, size: 38 },
          { side: 'right', yFrac: 0.36, size: 38 },
          { side: 'left',  yFrac: 0.16, size: 28 },
          { side: 'right', yFrac: 0.16, size: 28 },
        ],
        hasBud: false, hasFlower: true, hasFruit: true,
      };
    case 9:
    case 10:
    default:
      return {
        stemH: 170,
        leaves: [
          { side: 'left',  yFrac: 0.80, size: 56 },
          { side: 'right', yFrac: 0.80, size: 56 },
          { side: 'left',  yFrac: 0.62, size: 50 },
          { side: 'right', yFrac: 0.62, size: 50 },
          { side: 'left',  yFrac: 0.42, size: 42 },
          { side: 'right', yFrac: 0.42, size: 42 },
          { side: 'left',  yFrac: 0.22, size: 34 },
          { side: 'right', yFrac: 0.22, size: 34 },
          { side: 'left',  yFrac: 0.06, size: 24 },
          { side: 'right', yFrac: 0.06, size: 24 },
        ],
        hasBud: false, hasFlower: true, hasFruit: true,
      };
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PlantWidget({ level = 1, xpProgress = 0, levelName = 'Brote' }) {
  const { colors } = useTheme();
  const swingAnim  = useRef(new Animated.Value(0)).current;
  const config     = useMemo(() => getPlantConfig(level), [level]);

  // Animación de balanceo suave (siempre activa)
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(swingAnim, {
          toValue:         1,
          duration:        2800,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(swingAnim, {
          toValue:         -1,
          duration:        2800,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const rotate = swingAnim.interpolate({
    inputRange:  [-1, 1],
    outputRange: ['-4deg', '4deg'],
  });

  const POT_W   = 80;
  const POT_H   = 52;
  const STEM_W  = 5;
  const { stemH, leaves, hasBud, hasFlower, hasFruit } = config;

  return (
    <View style={styles.wrapper}>

      {/* Etiqueta de nivel */}
      <Text style={[styles.levelLabel, { color: colors.text.secondary }]}>
        {levelName}
      </Text>

      {/* Planta animada (gira desde la base del tallo en la maceta) */}
      <Animated.View style={[
        styles.plantContainer,
        { height: stemH + POT_H + 40 },
        { transform: [{ rotate }] },
      ]}>

        {/* Tallo + hojas (posicionados sobre la maceta) */}
        <View style={[styles.stemArea, { height: stemH }]}>

          {/* Tallo */}
          <View style={[styles.stem, { height: stemH, width: STEM_W }]} />

          {/* Hojas */}
          {leaves.map((leaf, i) => {
            const yFromTop = stemH - leaf.yFrac * stemH; // px desde arriba del stemArea
            const isLeft   = leaf.side === 'left';
            const leafH    = leaf.size * 0.42;
            return (
              <View
                key={i}
                style={[
                  styles.leaf,
                  {
                    width:        leaf.size,
                    height:       leafH,
                    borderRadius: leafH / 2,
                    top:          yFromTop - leafH / 2,
                    left:         isLeft ? STEM_W / 2 - leaf.size + 4 : STEM_W / 2 - 4,
                    backgroundColor: i % 3 === 0 ? GREEN.leafDark : i % 3 === 1 ? GREEN.leafMid : GREEN.leafLight,
                    transform: [{ rotate: isLeft ? '-35deg' : '35deg' }],
                  },
                ]}
              />
            );
          })}

          {/* Punta: brote, flor o nada */}
          {hasBud && (
            <View style={[styles.bud, { top: -14 }]} />
          )}
          {hasFlower && (
            <View style={[styles.flower, { top: -22 }]}>
              {[0, 60, 120, 180, 240, 300].map(angle => (
                <View
                  key={angle}
                  style={[styles.petal, { transform: [{ rotate: `${angle}deg` }, { translateY: -9 }] }]}
                />
              ))}
              <View style={styles.flowerCore} />
            </View>
          )}
          {hasFruit && (
            <View style={[styles.fruit, { top: -10, left: STEM_W + 10 }]} />
          )}

          {/* Brote si nivel 1 */}
          {level === 1 && (
            <View style={[styles.sprout, { top: -12 }]} />
          )}

        </View>

        {/* Tierra encima de la maceta */}
        <View style={[styles.soil, { width: POT_W - 8 }]} />

        {/* Maceta */}
        <View style={[styles.potRim, { width: POT_W + 8 }]} />
        <View style={[styles.pot, { width: POT_W, height: POT_H }]} />

      </Animated.View>

      {/* Sombra debajo */}
      <View style={styles.shadow} />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 4,
  },
  levelLabel: {
    fontFamily: fonts.semibold,
    fontSize:   fontSize.sm,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  plantContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stemArea: {
    width: 120,
    alignItems: 'center',
    position: 'relative',
  },
  stem: {
    position:        'absolute',
    bottom:          0,
    borderRadius:    3,
    backgroundColor: GREEN.stem,
  },
  leaf: {
    position: 'absolute',
  },

  // Brote nivel 1
  sprout: {
    position:        'absolute',
    alignSelf:       'center',
    width:           16,
    height:          22,
    backgroundColor: GREEN.leafMid,
    borderRadius:    10,
    transform:       [{ rotate: '-15deg' }],
  },

  // Yema (bud)
  bud: {
    position:        'absolute',
    alignSelf:       'center',
    width:           12,
    height:          16,
    backgroundColor: GREEN.bud,
    borderRadius:    7,
  },

  // Flor
  flower: {
    position:       'absolute',
    alignSelf:      'center',
    width:          32,
    height:         32,
    alignItems:     'center',
    justifyContent: 'center',
  },
  petal: {
    position:        'absolute',
    width:           10,
    height:          16,
    borderRadius:    6,
    backgroundColor: GREEN.flower,
  },
  flowerCore: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: GREEN.flowerCore,
    zIndex:          2,
  },

  // Fruto decorativo
  fruit: {
    position:        'absolute',
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: '#EF5350',
  },

  // Tierra
  soil: {
    height:          8,
    backgroundColor: POT.soilLight,
    borderRadius:    3,
    marginBottom:    -2,
    zIndex:          2,
  },

  // Borde de la maceta (rim)
  potRim: {
    height:                   8,
    backgroundColor:          POT.rim,
    borderTopLeftRadius:      4,
    borderTopRightRadius:     4,
    zIndex:                   1,
  },

  // Cuerpo de la maceta (trapecio aproximado)
  pot: {
    backgroundColor:           POT.body,
    borderBottomLeftRadius:    12,
    borderBottomRightRadius:   12,
    borderTopLeftRadius:       3,
    borderTopRightRadius:      3,
    // Simula trapecio reduciendo ligeramente el ancho inferior
    // (limitación de RN: no hay clip-path, usamos overflow hidden)
  },

  // Sombra proyectada
  shadow: {
    width:           80,
    height:          12,
    borderRadius:    40,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginTop:       -4,
  },
});

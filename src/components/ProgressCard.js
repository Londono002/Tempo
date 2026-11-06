/**
 * ProgressCard.js — Tarjeta de progreso del usuario.
 *
 * Muestra:
 *   - Nivel actual (emoji + nombre)
 *   - Barra de progreso hacia el siguiente nivel
 *   - XP acumulados / XP para el siguiente nivel
 *   - Racha de días (🔥 si hay racha activa)
 *
 * Diseño: tarjeta compacta con gradiente lavanda, usada en HomeScreen.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import spacing from '../theme/spacing';
import { fonts, fontSize } from '../theme/typography';

export default function ProgressCard({ state }) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.primary[500],
      borderRadius: spacing.radius.xl,
      padding: spacing.base,
      gap: spacing.sm,
      shadowColor: colors.primary[600],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },

    // Fila nivel + racha
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    levelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    levelEmoji: {
      fontSize: 32,
    },
    levelNum: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.primary[200],
    },
    levelName: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.white,
    },

    // Racha
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: spacing.radius.lg,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    streakActive: {
      backgroundColor: 'rgba(251, 146, 60, 0.2)',
    },
    streakEmoji: {
      fontSize: 18,
    },
    streakNum: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.white,
      textAlign: 'center',
    },
    streakLabel: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.primary[200],
      textAlign: 'center',
    },

    // Barra de progreso
    progressSection: {
      gap: 5,
    },
    progressTrack: {
      height: 7,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: 7,
      backgroundColor: colors.white,
      borderRadius: 4,
    },
    xpText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.primary[200],
      textAlign: 'right',
    },
  }), [colors]);

  if (!state) return null;

  const {
    xp, level, levelName, levelEmoji,
    xpProgress, xpInLevel, xpToNext, isMaxLevel,
    streak,
  } = state;

  return (
    <View style={styles.card}>

      {/* Fila principal: nivel + racha */}
      <View style={styles.topRow}>

        {/* Nivel */}
        <View style={styles.levelBadge}>
          <Text style={styles.levelEmoji}>{levelEmoji}</Text>
          <View>
            <Text style={styles.levelNum}>Nivel {level}</Text>
            <Text style={styles.levelName}>{levelName}</Text>
          </View>
        </View>

        {/* Racha */}
        <View style={[styles.streakBadge, streak > 0 && styles.streakActive]}>
          <Text style={styles.streakEmoji}>{streak > 0 ? '🔥' : '💤'}</Text>
          <View>
            <Text style={[styles.streakNum, streak > 0 && { color: '#FB923C' }]}>
              {streak}
            </Text>
            <Text style={styles.streakLabel}>
              {streak === 1 ? 'día' : 'días'}
            </Text>
          </View>
        </View>

      </View>

      {/* Barra de progreso */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${Math.round(xpProgress * 100)}%` }]}
          />
        </View>
        <Text style={styles.xpText}>
          {isMaxLevel
            ? `${xp} XP · Nivel máximo ✨`
            : `${xpInLevel} / ${xpToNext} XP para nivel ${level + 1}`}
        </Text>
      </View>

    </View>
  );
}

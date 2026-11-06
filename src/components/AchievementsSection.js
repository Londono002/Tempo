/**
 * AchievementsSection.js — Sección de logros desbloqueados y bloqueados.
 *
 * Muestra los logros en dos grupos:
 *   1. Desbloqueados: con color completo y check
 *   2. Bloqueados: en gris, con el icono opaco (para motivar al usuario)
 *
 * Se usa dentro de HomeScreen como sección inferior colapsable.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ACHIEVEMENTS } from '../logic/gamification';
import { useTheme } from '../context/ThemeContext';
import spacing from '../theme/spacing';
import { fonts, fontSize } from '../theme/typography';

export default function AchievementsSection({ unlockedKeys = [] }) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    headerTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.text.primary,
    },
    countBadge: {
      backgroundColor: colors.primary[100],
      borderRadius: spacing.radius.full,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    countText: {
      fontFamily: fonts.semibold,
      fontSize: fontSize.xs,
      color: colors.primary[500],
    },
    emptyHint: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.text.muted,
      textAlign: 'center',
      paddingVertical: spacing.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    badge: {
      width: '30%',
      flexGrow: 1,
      maxWidth: '47%',
      backgroundColor: colors.background.card,
      borderRadius: spacing.radius.lg,
      padding: spacing.sm,
      alignItems: 'center',
      gap: 4,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
      borderWidth: 1,
      borderColor: colors.primary[100],
    },
    badgeLocked: {
      opacity: 0.55,
      borderStyle: 'dashed',
    },
    badgeIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    checkmark: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.state.active,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeTitle: {
      fontFamily: fonts.semibold,
      fontSize: fontSize.xs,
      color: colors.text.primary,
      textAlign: 'center',
    },
    badgeDesc: {
      fontFamily: fonts.regular,
      fontSize: 10,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 14,
    },
  }), [colors]);

  const [expandido, setExpandido] = useState(false);

  const desbloqueados = ACHIEVEMENTS.filter(a => unlockedKeys.includes(a.key));
  const bloqueados    = ACHIEVEMENTS.filter(a => !unlockedKeys.includes(a.key));

  // Si no hay ningún logro desbloqueado ni está expandido, mostrar solo el botón
  const mostrarBloqueados = expandido && bloqueados.length > 0;

  return (
    <View style={styles.container}>

      {/* Cabecera */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpandido(e => !e)}
        activeOpacity={0.75}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="trophy-outline" size={18} color={colors.primary[500]} />
          <Text style={styles.headerTitle}>Logros</Text>
          {desbloqueados.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{desbloqueados.length}/{ACHIEVEMENTS.length}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={expandido ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.text.muted}
        />
      </TouchableOpacity>

      {/* Logros desbloqueados (siempre visibles si los hay) */}
      {desbloqueados.length === 0 && !expandido ? (
        <Text style={styles.emptyHint}>
          Completa tu primera sesión para desbloquear logros 🌱
        </Text>
      ) : (
        <View style={styles.grid}>
          {desbloqueados.map(a => (
            <AchievementBadge key={a.key} achievement={a} unlocked colors={colors} styles={styles} />
          ))}
          {mostrarBloqueados && bloqueados.map(a => (
            <AchievementBadge key={a.key} achievement={a} unlocked={false} colors={colors} styles={styles} />
          ))}
        </View>
      )}

    </View>
  );
}

// ─── AchievementBadge ─────────────────────────────────────────────────────────

function AchievementBadge({ achievement, unlocked, colors, styles }) {
  return (
    <View style={[styles.badge, !unlocked && styles.badgeLocked]}>
      {/* Icono */}
      <View style={[
        styles.badgeIcon,
        { backgroundColor: unlocked ? colors.primary[100] : colors.primary[50] },
      ]}>
        <Ionicons
          name={achievement.icon}
          size={22}
          color={unlocked ? colors.primary[500] : colors.text.muted}
        />
        {unlocked && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark" size={9} color={colors.white} />
          </View>
        )}
      </View>

      {/* Texto */}
      <Text
        style={[styles.badgeTitle, !unlocked && { color: colors.text.muted }]}
        numberOfLines={1}
      >
        {achievement.title}
      </Text>
      <Text
        style={[styles.badgeDesc, !unlocked && { opacity: 0.5 }]}
        numberOfLines={2}
      >
        {achievement.desc}
      </Text>
    </View>
  );
}

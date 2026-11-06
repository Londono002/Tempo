/**
 * HomeScreen.js — Pantalla principal con modelo 3D giratorio.
 *
 * Layout:
 *   1. Saludo + fecha
 *   2. Model3DViewer — modelo 3D girando lentamente que "crece" con el nivel
 *   3. ProgressCard  — barra de XP, nivel y racha
 *   4. Stats del día
 *   5. Minigráfico semanal (si hay datos)
 *   6. Acceso rápido a actividades
 *   7. Sección de logros
 *
 * El modelo actual es un OBJ de bajo poligonaje en assets/models.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { getAllActivities }              from '../services/activitiesService';
import { getTodaySessions, getActiveSession, getSessionPauses, getSessionsByFilter } from '../services/sessionsService';
import { getGamificationState }          from '../services/gamificationService';
import { agruparPorDia, fechaLocalISO, rangoDelPeriodo, totalEfectivo } from '../logic/stats';
import { calcularTiempoEfectivo, formatearDuracion, obtenerSaludo, obtenerEmojiSaludo } from '../logic/timer';
import { useTheme }          from '../context/ThemeContext';
import Model3DViewer          from '../components/Model3DViewer';
import ProgressCard           from '../components/ProgressCard';
import AchievementsSection    from '../components/AchievementsSection';

const MODEL_URI = require('../../assets/models/base-reduced.glb');

import spacing from '../theme/spacing';
import { fonts, fontSize } from '../theme/typography';

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

const DIAS_ES   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES_ES  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_CORTO = ['L','M','X','J','V','S','D'];

function formatearFechaHoy() {
  const h = new Date();
  return `${DIAS_ES[h.getDay()]}, ${h.getDate()} de ${MESES_ES[h.getMonth()]}`;
}

function diasDeLaSemanaActual() {
  const hoy = new Date();
  const lunes = new Date(hoy);
  const offset = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
  lunes.setDate(hoy.getDate() - offset);
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d  = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dias.push({
      iso:   `${y}-${m}-${dd}`,
      label: DIAS_CORTO[d.getDay() === 0 ? 6 : d.getDay() - 1],
      isHoy: fechaLocalISO(d) === fechaLocalISO(hoy),
    });
  }
  return dias;
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors }  = useTheme();
  const styles      = useMemo(() => makeStyles(colors), [colors]);
  const navigation  = useNavigation();
  const isFocused   = useIsFocused();
  const { width: screenWidth } = useWindowDimensions();

  const [activities,    setActivities]    = useState([]);
  const [todayStats,    setTodayStats]    = useState({ totalMs: 0, count: 0 });
  const [activeSession, setActiveSession] = useState(null);
  const [weekData,      setWeekData]      = useState([]);
  const [gamification,  setGamification]  = useState(null);

  useFocusEffect(useCallback(() => { cargarDatos(); }, []));

  async function cargarDatos() {
    try {
      const { from: weekFrom, to: weekTo } = rangoDelPeriodo('week');
      const [acts, todaySess, active, weekSess, gami] = await Promise.all([
        getAllActivities(),
        getTodaySessions(),
        getActiveSession(),
        getSessionsByFilter({ from: weekFrom, to: weekTo }),
        getGamificationState(),
      ]);

      setActivities(acts);
      setActiveSession(active);
      setGamification(gami);

      let activeMs = 0;
      if (active) {
        const pauses = await getSessionPauses(active.id);
        activeMs = calcularTiempoEfectivo({ startedAt: active.started_at, pauses });
      }

      const activeDay = active ? fechaLocalISO(new Date(active.started_at)) : null;
      const activeIsToday = activeDay === fechaLocalISO(new Date());
      const todayMs = totalEfectivo(todaySess) + (activeIsToday ? activeMs : 0);
      const actIds  = new Set(todaySess.map(s => s.activity_id));
      setTodayStats({ totalMs: todayMs, count: actIds.size });

      const porDia  = agruparPorDia(weekSess);
      const diasMap = new Map(porDia.map(d => [d.date, d.totalMs]));
      const weekDays = diasDeLaSemanaActual();
      if (active && activeDay >= weekDays[0].iso && activeDay <= weekDays[6].iso) {
        diasMap.set(activeDay, (diasMap.get(activeDay) ?? 0) + activeMs);
      }
      setWeekData(weekDays.map(d => ({ ...d, totalMs: diasMap.get(d.iso) ?? 0 })));
    } catch (_) { /* silenciar — UI muestra estado vacío */ }
  }

  function irAlTemporizador(activityId = null) {
    navigation.navigate('Temporizador', activityId ? { activityId } : {});
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Cabecera */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{obtenerSaludo()} {obtenerEmojiSaludo()}</Text>
        <Text style={styles.date}>{formatearFechaHoy()}</Text>
      </View>

      {/* 2. Modelo 3D giratorio — hero visual de la app */}
      <View style={styles.modelCard}>
        {/* Etiqueta de nivel sobre el modelo */}
        <Text style={styles.modelLevelLabel}>
          {gamification?.levelName ?? 'Brote'}  ·  Nivel {gamification?.level ?? 1}
        </Text>
        <Model3DViewer
          modelUri={MODEL_URI}
          size={Math.min(260, Math.max(180, screenWidth - 80))}
          rotationSpeed={0.006}
          growth={Math.min(1.25, 0.68 + ((((gamification?.level ?? 1) - 1) + (gamification?.xpProgress ?? 0)) / 9) * 0.57)}
          isActive={isFocused}
        />
        {/* Subtítulo debajo del modelo */}
        <Text style={styles.modelSubtitle}>
          Sigue enfocándote para hacer crecer tu compañero 🌱
        </Text>
      </View>

      {/* 3. Barra de progreso: XP, nivel, racha */}
      <ProgressCard state={gamification} />

      {/* 4. Sesión activa (si hay una) */}
      {activeSession && (
        <TouchableOpacity
          style={[styles.activeCard, { borderLeftColor: activeSession.activity_color ?? colors.primary[500] }]}
          onPress={() => irAlTemporizador()}
          activeOpacity={0.85}
        >
          <View style={styles.activeLeft}>
            <View style={[styles.activeDot, {
              backgroundColor: activeSession.status === 'paused'
                ? colors.state.paused
                : colors.state.active,
            }]} />
            <View>
              <Text style={styles.activeLabel}>
                {activeSession.status === 'paused' ? '⏸ En pausa' : '▶ En curso'}
              </Text>
              <Text style={styles.activeName}>{activeSession.activity_name}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </TouchableOpacity>
      )}

      {/* 5. Stats del día */}
      {(todayStats.totalMs > 0 || todayStats.count > 0) && (
        <View style={styles.statsRow}>
          <StatCard
            colors={colors} styles={styles}
            icon="time-outline"
            label="Tiempo hoy"
            value={formatearDuracion(todayStats.totalMs)}
          />
          <StatCard
            colors={colors} styles={styles}
            icon="flame-outline"
            label="Actividades"
            value={String(todayStats.count)}
          />
        </View>
      )}

      {/* 6. Minigráfico semanal */}
      {weekData.some(d => d.totalMs > 0) && (
        <View style={styles.weekCard}>
          <Text style={styles.weekTitle}>Esta semana</Text>
          <WeekChart colors={colors} data={weekData} />
          <Text style={styles.weekTotal}>
            {formatearDuracion(weekData.reduce((s, d) => s + d.totalMs, 0))} en total
          </Text>
        </View>
      )}

      {/* 7. Mis actividades */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mis actividades</Text>
        {activities.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyActivities}
            onPress={() => navigation.navigate('Actividades')}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={32} color={colors.primary[400]} />
            <Text style={styles.emptyText}>
              Crea tu primera actividad{'\n'}para empezar a registrar tiempo
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.activityGrid}>
            {activities.map(act => (
              <QuickStartCard
                key={act.id}
                colors={colors}
                styles={styles}
                activity={act}
                onPress={() => irAlTemporizador(act.id)}
              />
            ))}
          </View>
        )}
      </View>

      {/* 8. Logros */}
      {gamification && (
        <AchievementsSection unlockedKeys={gamification.unlockedAchievements} />
      )}

    </ScrollView>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatCard({ colors, styles, icon, label, value }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={colors.primary[500]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WeekChart({ colors, data }) {
  const maxMs = Math.max(...data.map(d => d.totalMs), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 4 }}>
      {data.map(d => {
        const pct = d.totalMs / maxMs;
        return (
          <View key={d.iso} style={{ flex: 1, alignItems: 'center', gap: 4, height: '100%' }}>
            <View style={{
              flex: 1, width: '100%', justifyContent: 'flex-end',
              backgroundColor: colors.primary[100], borderRadius: 3,
            }}>
              <View style={{
                width: '100%', borderRadius: 3,
                height: `${Math.max(pct * 100, d.totalMs > 0 ? 8 : 0)}%`,
                backgroundColor: d.isHoy ? colors.primary[500] : colors.primary[300],
              }} />
            </View>
            <Text style={{
              fontFamily: fonts.regular, fontSize: 10,
              color:      d.isHoy ? colors.primary[500] : colors.text.muted,
              fontWeight: d.isHoy ? 'bold' : 'normal',
            }}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function QuickStartCard({ colors, styles, activity, onPress }) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress} activeOpacity={0.78}>
      <View style={[styles.quickIcon, { backgroundColor: activity.color + '22' }]}>
        <Ionicons name={activity.icon} size={26} color={activity.color} />
      </View>
      <Text style={styles.quickName} numberOfLines={2}>{activity.name}</Text>
      <View style={[styles.quickStart, { backgroundColor: activity.color }]}>
        <Ionicons name="play" size={10} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

function makeStyles(colors) {
  return StyleSheet.create({
    scroll:      { flex: 1, backgroundColor: colors.background.screen },
    container:   { padding: spacing.base, paddingBottom: spacing.xxl, gap: spacing.lg },

    header:      { paddingTop: spacing.sm },
    greeting:    { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.text.primary },
    date:        {
      fontFamily: fonts.regular, fontSize: fontSize.sm,
      color: colors.text.secondary, marginTop: 2, textTransform: 'capitalize',
    },

    // Tarjeta que contiene el modelo 3D
    modelCard: {
      backgroundColor: colors.background.card,
      borderRadius:    spacing.radius.xl,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.base,
      alignItems:      'center',
      gap:             spacing.sm,
      shadowColor:     colors.shadow,
      shadowOffset:    { width: 0, height: 3 },
      shadowOpacity:   0.07,
      shadowRadius:    10,
      elevation:       3,
    },
    modelLevelLabel: {
      fontFamily:  fonts.semibold,
      fontSize:    fontSize.sm,
      color:       colors.text.secondary,
      textTransform: 'capitalize',
    },
    modelSubtitle: {
      fontFamily:  fonts.regular,
      fontSize:    fontSize.xs,
      color:       colors.text.muted,
      textAlign:   'center',
      lineHeight:  fontSize.xs * 1.6,
      maxWidth:    260,
    },

    // Sesión activa
    activeCard: {
      backgroundColor: colors.background.card,
      borderRadius:    spacing.radius.lg,
      borderLeftWidth: 4,
      padding:         spacing.base,
      flexDirection:   'row',
      alignItems:      'center',
      justifyContent:  'space-between',
      shadowColor:     colors.shadow,
      shadowOffset:    { width: 0, height: 2 },
      shadowOpacity:   0.08,
      shadowRadius:    6,
      elevation:       3,
    },
    activeLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    activeDot:   { width: 10, height: 10, borderRadius: 5 },
    activeLabel: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.text.secondary },
    activeName:  { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.text.primary },

    // Stats
    statsRow: { flexDirection: 'row', gap: spacing.sm },
    statCard: {
      flex: 1, backgroundColor: colors.background.card,
      borderRadius: spacing.radius.lg, padding: spacing.base,
      alignItems: 'center', gap: spacing.xs,
      shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    statValue: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text.primary },
    statLabel: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.text.secondary },

    // Gráfico semanal
    weekCard: {
      backgroundColor: colors.background.card,
      borderRadius:    spacing.radius.lg,
      padding:         spacing.base,
      gap:             spacing.sm,
      shadowColor:     colors.shadow,
      shadowOffset:    { width: 0, height: 2 },
      shadowOpacity:   0.05,
      shadowRadius:    4,
      elevation:       2,
    },
    weekTitle: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.text.primary },
    weekTotal: {
      fontFamily: fonts.regular, fontSize: fontSize.xs,
      color: colors.text.secondary, textAlign: 'right',
    },

    // Mis actividades
    section:      { gap: spacing.sm },
    sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.text.primary },
    emptyActivities: {
      backgroundColor: colors.primary[100],
      borderRadius:    spacing.radius.lg,
      padding:         spacing.xl,
      alignItems:      'center',
      gap:             spacing.sm,
      borderWidth:     1.5,
      borderColor:     colors.primary[200],
      borderStyle:     'dashed',
    },
    emptyText: {
      fontFamily: fonts.regular, fontSize: fontSize.sm,
      color: colors.text.secondary, textAlign: 'center',
      lineHeight: fontSize.sm * 1.6,
    },
    activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    quickCard: {
      width:           '47%',
      backgroundColor: colors.background.card,
      borderRadius:    spacing.radius.lg,
      padding:         spacing.base,
      gap:             spacing.xs,
      shadowColor:     colors.shadow,
      shadowOffset:    { width: 0, height: 2 },
      shadowOpacity:   0.06,
      shadowRadius:    5,
      elevation:       2,
    },
    quickIcon: {
      width: 48, height: 48, borderRadius: 24,
      alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs,
    },
    quickName: {
      fontFamily: fonts.semibold, fontSize: fontSize.sm,
      color: colors.text.primary, lineHeight: fontSize.sm * 1.4,
    },
    quickStart: {
      alignSelf: 'flex-start', width: 22, height: 22, borderRadius: 11,
      alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs,
    },
  });
}

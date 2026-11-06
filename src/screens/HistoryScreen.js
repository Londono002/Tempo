/**
 * HistoryScreen.js
 * Historial de sesiones con filtros por período y actividad.
 *
 * Secciones:
 * 1. Selector de período (chips: Hoy / Semana / Mes / Todo)
 * 2. Resumen del período (tiempo total + sesiones + actividades)
 * 3. Filtro por actividad (scroll horizontal de chips)
 * 4. Lista de sesiones agrupadas por día
 *
 * Los datos se recargan cada vez que cambia el filtro o la pantalla recibe foco.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { getSessionsByFilter } from '../services/sessionsService';
import { getAllActivities }     from '../services/activitiesService';
import {
  totalEfectivo,
  agruparPorActividad,
  rangoDelPeriodo,
} from '../logic/stats';
import { formatearDuracion } from '../logic/timer';
import { useTheme } from '../context/ThemeContext';

import spacing from '../theme/spacing';
import { fonts, fontSize } from '../theme/typography';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PERIODOS = [
  { key: 'today', label: 'Hoy'    },
  { key: 'week',  label: 'Semana' },
  { key: 'month', label: 'Mes'    },
  { key: 'all',   label: 'Todo'   },
];

const DIAS_ES  = ['dom','lun','mar','mié','jue','vie','sáb'];
const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function labelFecha(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const hoy   = new Date();
  const ayer  = new Date(); ayer.setDate(hoy.getDate() - 1);

  if (fecha.toDateString() === hoy.toDateString())  return 'Hoy';
  if (fecha.toDateString() === ayer.toDateString()) return 'Ayer';
  return `${DIAS_ES[fecha.getDay()]} ${d} ${MESES_ES[m - 1]}`;
}

function formatHora(isoString) {
  return new Date(isoString).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  });
}

function agruparSesionesPorDia(sessions) {
  const mapa = new Map();
  sessions.forEach(s => {
    const fecha = new Date(s.started_at);
    const dia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
    if (!mapa.has(dia)) mapa.set(dia, []);
    mapa.get(dia).push(s);
  });
  return Array.from(mapa.entries()).map(([dia, data]) => ({
    title:   labelFecha(dia),
    totalMs: data.reduce((sum, s) => sum + (s.effective_ms ?? 0), 0),
    data,
  }));
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: colors.background.screen,
    },

    // Filtros
    filtersContainer: {
      backgroundColor: colors.background.screen,
      paddingTop: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.primary[100],
      gap: spacing.xs,
      paddingBottom: spacing.sm,
    },
    chipRow: {
      paddingHorizontal: spacing.base,
    },

    // Chips de período
    chip: {
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.xs,
      borderRadius: spacing.radius.full,
      backgroundColor: colors.primary[100],
      marginRight: spacing.xs,
    },
    chipActive: {
      backgroundColor: colors.primary[500],
    },
    chipText: {
      fontFamily: fonts.semibold,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
    },
    chipTextActive: {
      color: colors.white,
    },

    // Chips de actividad
    chipAct: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: spacing.radius.full,
      borderWidth: 1,
      borderColor: colors.primary[200],
      marginRight: spacing.xs,
      backgroundColor: colors.background.card,
    },
    chipActActive: {
      backgroundColor: colors.primary[100],
      borderColor: colors.primary[400],
    },
    chipActText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.text.secondary,
    },
    chipActTextActive: {
      color: colors.primary[500],
      fontFamily: fonts.semibold,
    },

    // Resumen
    summary: {
      flexDirection: 'row',
      paddingHorizontal: spacing.base,
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    summaryChip: {
      flex: 1,
      backgroundColor: colors.background.card,
      borderRadius: spacing.radius.md,
      padding: spacing.sm,
      alignItems: 'center',
      gap: 2,
      borderWidth: 1,
      borderColor: colors.primary[100],
    },
    summaryValue: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.text.primary,
    },
    summaryLabel: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.text.muted,
    },

    // Lista
    listContent: {
      padding: spacing.base,
      paddingBottom: spacing.xxl,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.background.screen,
      paddingVertical: spacing.sm,
    },
    sectionTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.sm,
      color: colors.text.primary,
      textTransform: 'capitalize',
    },
    sectionTotal: {
      fontFamily: fonts.semibold,
      fontSize: fontSize.sm,
      color: colors.primary[500],
    },

    // Fila sesión
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      borderRadius: spacing.radius.lg,
      padding: spacing.base,
      gap: spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, gap: 2 },
    rowName: {
      fontFamily: fonts.semibold,
      fontSize: fontSize.sm,
      color: colors.text.primary,
    },
    rowTime: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.text.muted,
    },
    rowNote: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.text.secondary,
      fontStyle: 'italic',
    },
    rowDuration: {
      fontFamily: fonts.bold,
      fontSize: fontSize.sm,
    },

    // Estado vacío
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.xl,
    },
    emptyTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.lg,
      color: colors.text.primary,
      marginTop: spacing.sm,
    },
    emptySubtitle: {
      fontFamily: fonts.regular,
      fontSize: fontSize.base,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: fontSize.base * 1.6,
    },

    // Desglose por actividad
    breakdown: {
      backgroundColor: colors.background.card,
      margin: spacing.base,
      marginTop: 0,
      borderRadius: spacing.radius.lg,
      padding: spacing.base,
      gap: spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 5,
      elevation: 2,
    },
    breakdownTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.sm,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    barBody: { flex: 1, gap: 3 },
    barLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    barName: {
      fontFamily: fonts.semibold,
      fontSize: fontSize.xs,
      color: colors.text.primary,
      flex: 1,
    },
    barDuration: {
      fontFamily: fonts.bold,
      fontSize: fontSize.xs,
    },
    barTrack: {
      height: 5,
      backgroundColor: colors.primary[100],
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill: {
      height: 5,
      borderRadius: 3,
    },
  }), [colors]);

  const [periodo,    setPeriodo]    = useState('week');
  const [actFilter,  setActFilter]  = useState(null); // null = todas
  const [sessions,   setSessions]   = useState([]);
  const [activities, setActivities] = useState([]);
  const [sections,   setSections]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [periodo, actFilter]) // eslint-disable-line
  );

  async function cargarDatos() {
    setLoading(true);
    try {
      const [acts] = await Promise.all([getAllActivities()]);
      setActivities(acts);

      const { from, to } = rangoDelPeriodo(periodo);
      const sess = await getSessionsByFilter({
        from,
        to,
        activityId: actFilter,
      });

      setSessions(sess);
      setSections(agruparSesionesPorDia(sess));
    } catch (e) {
      // silenciar; mostrar estado vacío
    } finally {
      setLoading(false);
    }
  }

  // Stats del período
  const totalMs   = totalEfectivo(sessions);
  const byAct     = agruparPorActividad(sessions);
  const uniqueActs = byAct.length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>

      {/* Filtros pegajosos arriba */}
      <View style={styles.filtersContainer}>

        {/* Período */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {PERIODOS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, periodo === p.key && styles.chipActive]}
              onPress={() => { setPeriodo(p.key); setActFilter(null); }}
            >
              <Text style={[styles.chipText, periodo === p.key && styles.chipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Actividad */}
        {activities.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chipAct, !actFilter && styles.chipActActive]}
              onPress={() => setActFilter(null)}
            >
              <Text style={[styles.chipActText, !actFilter && styles.chipActTextActive]}>
                Todas
              </Text>
            </TouchableOpacity>
            {activities.map(a => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.chipAct,
                  actFilter === a.id && { backgroundColor: a.color + '22', borderColor: a.color },
                ]}
                onPress={() => setActFilter(actFilter === a.id ? null : a.id)}
              >
                <Ionicons
                  name={a.icon}
                  size={12}
                  color={actFilter === a.id ? a.color : colors.text.secondary}
                />
                <Text style={[
                  styles.chipActText,
                  actFilter === a.id && { color: a.color, fontFamily: fonts.semibold },
                ]}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Resumen del período */}
        <View style={styles.summary}>
          <SummaryChip
            icon="time-outline"
            value={totalMs > 0 ? formatearDuracion(totalMs) : '—'}
            label="Total"
            colors={colors}
            styles={styles}
          />
          <SummaryChip
            icon="layers-outline"
            value={sessions.length > 0 ? String(sessions.length) : '—'}
            label="Sesiones"
            colors={colors}
            styles={styles}
          />
          <SummaryChip
            icon="color-palette-outline"
            value={uniqueActs > 0 ? String(uniqueActs) : '—'}
            label="Actividades"
            colors={colors}
            styles={styles}
          />
        </View>

      </View>

      {/* Lista agrupada por día */}
      {!loading && sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={52} color={colors.primary[300]} />
          <Text style={styles.emptyTitle}>Sin sesiones aquí</Text>
          <Text style={styles.emptySubtitle}>
            {periodo === 'today'
              ? 'No registraste tiempo hoy todavía.'
              : 'No hay sesiones en este período.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionTotal}>
                {formatearDuracion(section.totalMs)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => <SessionRow session={item} colors={colors} styles={styles} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}

      {/* Desglose por actividad */}
      {byAct.length > 1 && (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>Por actividad</Text>
          {byAct.map(a => (
            <ActivityBar key={a.activityId} entry={a} maxMs={byAct[0].totalMs} colors={colors} styles={styles} />
          ))}
        </View>
      )}

    </View>
  );
}

// ─── SummaryChip ──────────────────────────────────────────────────────────────

function SummaryChip({ icon, value, label, colors, styles }) {
  return (
    <View style={styles.summaryChip}>
      <Ionicons name={icon} size={14} color={colors.primary[500]} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

// ─── ActivityBar ──────────────────────────────────────────────────────────────

function ActivityBar({ entry, maxMs, colors, styles }) {
  const pct = maxMs > 0 ? entry.totalMs / maxMs : 0;
  return (
    <View style={styles.barRow}>
      <Ionicons name={entry.icon} size={16} color={entry.color} style={{ width: 22 }} />
      <View style={styles.barBody}>
        <View style={styles.barLabelRow}>
          <Text style={styles.barName} numberOfLines={1}>{entry.name}</Text>
          <Text style={[styles.barDuration, { color: entry.color }]}>
            {formatearDuracion(entry.totalMs)}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: entry.color }]} />
        </View>
      </View>
    </View>
  );
}

// ─── SessionRow ───────────────────────────────────────────────────────────────

function SessionRow({ session, colors, styles }) {
  const color = session.activity_color ?? colors.primary[500];
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={session.activity_icon ?? 'timer-outline'} size={18} color={color} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {session.activity_name ?? 'Actividad eliminada'}
        </Text>
        <Text style={styles.rowTime}>
          {formatHora(session.started_at)}
          {session.ended_at ? ` → ${formatHora(session.ended_at)}` : ''}
        </Text>
        {session.note ? (
          <Text style={styles.rowNote} numberOfLines={1}>{session.note}</Text>
        ) : null}
      </View>
      <Text style={[styles.rowDuration, { color }]}>
        {session.effective_ms ? formatearDuracion(session.effective_ms) : '—'}
      </Text>
    </View>
  );
}

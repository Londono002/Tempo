/**
 * TimerScreen.js — Pantalla del temporizador limpia, sin bucles.
 *
 * Correcciones:
 *  - Bug del bucle: después de completar/cancelar, navega a Inicio
 *    y limpia el param activityId. Así el useFocusEffect no se re-dispara.
 *  - Se elimina PomodoroSphere (el 3D va en la pantalla principal)
 *  - Muestra el tiempo con tipografía grande y limpia
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useTimer }          from '../hooks/useTimer';
import { getAllActivities }   from '../services/activitiesService';
import { formatearTiempo }   from '../logic/timer';
import { useTheme }          from '../context/ThemeContext';
import {
  cancelTimerNotifications,
  requestTimerNotificationPermission,
  scheduleTimerNotifications,
} from '../services/notificationsService';
import {
  DEFAULT_FOCUS_INTERVAL_MINUTES,
  MIN_FOCUS_INTERVAL_MINUTES,
  MAX_FOCUS_INTERVAL_MINUTES,
  DEFAULT_BREAK_DURATION_MINUTES,
  MIN_BREAK_DURATION_MINUTES,
  MAX_BREAK_DURATION_MINUTES,
  getFocusIntervalMinutes,
  saveFocusIntervalMinutes,
  getBreakDurationMinutes,
  saveBreakDurationMinutes,
} from '../services/settingsService';

import spacing from '../theme/spacing';
import { fonts, fontSize } from '../theme/typography';

export default function TimerScreen() {
  const { colors } = useTheme();
  const styles      = useMemo(() => makeStyles(colors), [colors]);
  const route       = useRoute();
  const navigation  = useNavigation();

  const activityIdParam = route.params?.activityId ?? null;

  const {
    session, elapsedMs, status, loading,
    startSession, pauseSession, resumeSession,
    completeSession, cancelSession,
  } = useTimer();

  const [activities,      setActivities]      = useState([]);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [starting,        setStarting]        = useState(false);
  const [focusInterval,   setFocusInterval]   = useState(DEFAULT_FOCUS_INTERVAL_MINUTES);
  const [breakDuration,   setBreakDuration]   = useState(DEFAULT_BREAK_DURATION_MINUTES);
  const [settingsReady,   setSettingsReady]   = useState(false);
  const [breakEndsAt,     setBreakEndsAt]     = useState(null);
  const [breakRemaining,  setBreakRemaining]  = useState(0);
  const lastPromptCycleRef = useRef(0);
  const promptSessionIdRef = useRef(null);
  const notificationScheduleGenerationRef = useRef(0);
  const notificationPermissionNoticeRef = useRef(false);

  // ─── Control del auto-inicio ──────────────────────────────────────────────
  // Usamos una ref para que el auto-inicio solo ocurra UNA vez por visita,
  // aunque el status cambie. Esto evita el bucle infinito.
  const hasAutoStartedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      getAllActivities().then(setActivities).catch(() => {});
      Promise.all([getFocusIntervalMinutes(), getBreakDurationMinutes()])
        .then(([focus, rest]) => {
          setFocusInterval(focus);
          setBreakDuration(rest);
        })
        .catch(() => {})
        .finally(() => setSettingsReady(true));
      // Resetear al enfocar de nuevo (navegación hacia esta pantalla)
      hasAutoStartedRef.current = false;
    }, [])
  );

  useEffect(() => {
    if (!settingsReady || !session || status !== 'active') return;
    if (promptSessionIdRef.current !== session.id) {
      promptSessionIdRef.current = session.id;
      lastPromptCycleRef.current = 0;
    }
    const intervalMs = focusInterval * 60 * 1000;
    const cycle = Math.floor(elapsedMs / intervalMs);
    if (cycle < 1 || cycle <= lastPromptCycleRef.current) return;

    lastPromptCycleRef.current = cycle;
    pauseSession().then(() => {
      Alert.alert(
        'Buen trabajo 🌿',
        `Llevas ${focusInterval} minutos enfocándote. ¿Te tomas ${breakDuration} minutos de descanso?`,
        [
          {
            text: `Descansar ${breakDuration} min`,
            onPress: () => {
              const endAt = Date.now() + breakDuration * 60 * 1000;
              setBreakEndsAt(endAt);
              setBreakRemaining(endAt - Date.now());
            },
          },
          { text: 'Seguir trabajando', onPress: () => resumeSession() },
        ],
        { cancelable: false },
      );
    }).catch(error => Alert.alert('No se pudo iniciar el descanso', error.message));
  }, [elapsedMs, focusInterval, breakDuration, pauseSession, resumeSession, session, settingsReady, status]);

  useEffect(() => {
    if (!breakEndsAt) return undefined;
    const updateBreak = () => {
      const remaining = Math.max(0, breakEndsAt - Date.now());
      setBreakRemaining(remaining);
      if (remaining === 0) {
        setBreakEndsAt(null);
        resumeSession().then(() => Alert.alert('Descanso terminado', 'Volvemos al enfoque 🌱'));
      }
    };
    updateBreak();
    const interval = setInterval(updateBreak, 1000);
    return () => clearInterval(interval);
  }, [breakEndsAt, resumeSession]);

  const focusCycle = Math.floor(elapsedMs / (focusInterval * 60 * 1000));

  useEffect(() => {
    const generation = notificationScheduleGenerationRef.current + 1;
    notificationScheduleGenerationRef.current = generation;

    async function updateTimerNotifications() {
      if (!session) {
        await cancelTimerNotifications();
        return;
      }

      if (!settingsReady) return;

      let reminders = [];
      if (breakEndsAt) {
        reminders = [{
          type: 'break-ended',
          seconds: (breakEndsAt - Date.now()) / 1000,
          title: 'Terminó tu descanso 🌱',
          body: 'Cuando quieras, puedes volver a tu actividad.',
        }];
      } else if (status === 'active') {
        const intervalSeconds = focusInterval * 60;
        const intervalMs = intervalSeconds * 1000;
        const nextCycle = Math.floor(elapsedMs / intervalMs) + 1;
        const secondsUntilBreak = Math.max(1, (nextCycle * intervalMs - elapsedMs) / 1000);
        const focusReminder = {
          type: 'focus-ended',
          title: 'Es hora de descansar 🌿',
          body: `Llevas ${focusInterval} minutos enfocándote. Tómate ${breakDuration} minutos de pausa.`,
        };

        reminders = [
          { ...focusReminder, seconds: secondsUntilBreak },
          {
            ...focusReminder,
            seconds: secondsUntilBreak + intervalSeconds,
            repeats: true,
          },
        ];
      }

      await cancelTimerNotifications();
      if (notificationScheduleGenerationRef.current !== generation || reminders.length === 0) return;

      await scheduleTimerNotifications(reminders);
      if (notificationScheduleGenerationRef.current !== generation) {
        await cancelTimerNotifications();
      }
    }

    updateTimerNotifications().catch(error => {
      console.warn('No se pudieron actualizar los avisos de descanso:', error?.message ?? error);
    });

    return () => {
      if (notificationScheduleGenerationRef.current === generation) {
        notificationScheduleGenerationRef.current += 1;
      }
    };
  }, [
    session?.id,
    status,
    settingsReady,
    focusInterval,
    breakDuration,
    focusCycle,
    breakEndsAt,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (
        activityIdParam &&
        status === 'idle' &&
        !loading &&
        !starting &&
        !hasAutoStartedRef.current
      ) {
        hasAutoStartedRef.current = true;
        // Limpiar el param de ruta ANTES de iniciar para que no se re-dispare
        navigation.setParams({ activityId: null });
        handleStart(activityIdParam);
      }
    }, [activityIdParam, status, loading]) // eslint-disable-line
  );

  // ─── Acciones ─────────────────────────────────────────────────────────────

  async function handleStart(activityId) {
    setStarting(true);
    try {
      let notificationsAllowed = false;
      try {
        notificationsAllowed = await requestTimerNotificationPermission();
      } catch (error) {
        console.warn('No se pudo solicitar permiso de notificaciones:', error?.message ?? error);
      }

      await startSession(activityId);

      if (notificationsAllowed === false && !notificationPermissionNoticeRef.current) {
        notificationPermissionNoticeRef.current = true;
        Alert.alert(
          'Avisos de descanso desactivados',
          'El temporizador seguirá funcionando, pero no recibirás notificaciones fuera de la app. Puedes activar los avisos desde los ajustes del teléfono.',
        );
      }
    } catch (e) {
      Alert.alert('No se puede iniciar', e.message);
    } finally {
      setStarting(false);
    }
  }

  async function handleChangeFocusInterval(delta) {
    try {
      const saved = await saveFocusIntervalMinutes(focusInterval + delta);
      setFocusInterval(saved);
    } catch (error) {
      Alert.alert('No se pudo guardar el intervalo', error.message);
    }
  }

  async function handleChangeBreakDuration(delta) {
    try {
      const saved = await saveBreakDurationMinutes(breakDuration + delta);
      setBreakDuration(saved);
    } catch (error) {
      Alert.alert('No se pudo guardar la duración del descanso', error.message);
    }
  }

  async function handleEndBreak() {
    setBreakEndsAt(null);
    setBreakRemaining(0);
    await resumeSession();
  }

  async function handleComplete() {
    Alert.alert(
      '¿Terminar sesión?',
      'Se guardará el tiempo registrado.',
      [
        { text: 'Seguir', style: 'cancel' },
        {
          text: 'Terminar',
          onPress: async () => {
            try {
              setBreakEndsAt(null);
              setBreakRemaining(0);
              await completeSession();
              // Navegar a Inicio después de terminar para limpiar el estado
              navigation.navigate('Inicio');
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  }

  async function handleCancel() {
    Alert.alert(
      '¿Cancelar sesión?',
      'El tiempo no se guardará.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              setBreakEndsAt(null);
              setBreakRemaining(0);
              await cancelSession();
              navigation.navigate('Inicio');
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading || starting) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>
          {loading ? 'Restaurando sesión...' : 'Iniciando...'}
        </Text>
      </View>
    );
  }

  if (status === 'idle') {
    return (
      <SinSesion
        colors={colors}
        styles={styles}
        activities={activities}
        onStart={handleStart}
        selectorVisible={selectorVisible}
        focusInterval={focusInterval}
        onChangeFocusInterval={handleChangeFocusInterval}
        breakDuration={breakDuration}
        onChangeBreakDuration={handleChangeBreakDuration}
        onOpenSelector={() => setSelectorVisible(true)}
        onCloseSelector={() => setSelectorVisible(false)}
      />
    );
  }

  return (
    <SesionActiva
      colors={colors}
      styles={styles}
      session={session}
      elapsedMs={elapsedMs}
      status={status}
      onPause={pauseSession}
      onResume={resumeSession}
      onComplete={handleComplete}
      onCancel={handleCancel}
      focusInterval={focusInterval}
      onChangeFocusInterval={handleChangeFocusInterval}
      breakDuration={breakDuration}
      onChangeBreakDuration={handleChangeBreakDuration}
      breakRemaining={breakRemaining}
      onEndBreak={handleEndBreak}
    />
  );
}

// ─── Vista: sesión activa ─────────────────────────────────────────────────────

function SesionActiva({ colors, styles, session, elapsedMs, status, onPause, onResume, onComplete, onCancel, focusInterval, onChangeFocusInterval, breakDuration, onChangeBreakDuration, breakRemaining, onEndBreak }) {
  const actColor = session?.activity_color ?? colors.primary[500];
  const isActive = status === 'active';
  const isOnBreak = breakRemaining > 0;

  return (
    <View style={styles.container}>

      {/* Actividad en curso */}
      <View style={styles.sessionHeader}>
        <View style={[styles.iconCircle, { backgroundColor: actColor + '22' }]}>
          <Ionicons name={session?.activity_icon ?? 'timer-outline'} size={26} color={actColor} />
        </View>
        <Text style={styles.activityName}>{session?.activity_name}</Text>
        <View style={[styles.statusPill, { backgroundColor: isActive ? colors.state.active + '20' : colors.state.paused + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? colors.state.active : colors.state.paused }]} />
          <Text style={[styles.statusText, { color: isOnBreak ? colors.accent[500] : isActive ? colors.state.active : colors.state.paused }]}>
            {isOnBreak ? 'Descanso' : isActive ? 'En curso' : 'En pausa'}
          </Text>
        </View>
      </View>

      {/* Contador de tiempo */}
      <View style={styles.timerBlock}>
        <Text style={[styles.timerDisplay, !isActive && !isOnBreak && styles.timerPaused]}>
          {formatearTiempo(isOnBreak ? breakRemaining : elapsedMs)}
        </Text>
        <Text style={styles.timerSub}>{isOnBreak ? 'minutos para volver al enfoque' : 'tiempo efectivo'}</Text>
      </View>

      {/* Controles */}
      <View style={styles.controls}>
        {isOnBreak ? (
          <TouchableOpacity
            style={[styles.completeBtn, { backgroundColor: colors.accent[500] }]}
            onPress={onEndBreak}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.completeBtnText}>Volver al enfoque</Text>
          </TouchableOpacity>
        ) : isActive ? (
          <TouchableOpacity
            style={[styles.controlBtn, { borderColor: colors.primary[500] }]}
            onPress={onPause}
            activeOpacity={0.8}
          >
            <Ionicons name="pause" size={20} color={colors.primary[500]} />
            <Text style={[styles.controlLabel, { color: colors.primary[500] }]}>Pausar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.controlBtn, { borderColor: colors.state.active }]}
            onPress={onResume}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={20} color={colors.state.active} />
            <Text style={[styles.controlLabel, { color: colors.state.active }]}>Reanudar</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: actColor }]}
          onPress={onComplete}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.completeBtnText}>Terminar</Text>
        </TouchableOpacity>
      </View>

      <FocusIntervalControl
        colors={colors}
        styles={styles}
        value={focusInterval}
        onChange={onChangeFocusInterval}
        breakDuration={breakDuration}
        onChangeBreakDuration={onChangeBreakDuration}
      />

      <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
        <Text style={styles.cancelText}>Cancelar sesión</Text>
      </TouchableOpacity>

    </View>
  );
}

// ─── Vista: sin sesión ────────────────────────────────────────────────────────

function SinSesion({ colors, styles, activities, onStart, selectorVisible, onOpenSelector, onCloseSelector, focusInterval, onChangeFocusInterval, breakDuration, onChangeBreakDuration }) {
  return (
    <View style={styles.container}>

      {/* Ilustración de espera */}
      <View style={styles.emptyIllustration}>
        <Text style={styles.emptyEmoji}>⏱️</Text>
        <Text style={styles.emptyTitle}>Listo cuando tú lo estés</Text>
        <Text style={styles.emptySubtitle}>
          {activities.length === 0
            ? 'Crea una actividad en la pestaña Actividades para empezar.'
            : 'Elige una actividad para iniciar tu sesión de enfoque.'}
        </Text>
      </View>

      <FocusIntervalControl
        colors={colors}
        styles={styles}
        value={focusInterval}
        onChange={onChangeFocusInterval}
        breakDuration={breakDuration}
        onChangeBreakDuration={onChangeBreakDuration}
      />

      {activities.length > 0 && (
        <TouchableOpacity style={styles.startButtonMain} onPress={onOpenSelector} activeOpacity={0.85}>
          <Ionicons name="play" size={22} color="#fff" />
          <Text style={styles.startButtonText}>Elegir actividad e iniciar</Text>
        </TouchableOpacity>
      )}

      <ActivitySelectorModal
        colors={colors}
        styles={styles}
        visible={selectorVisible}
        activities={activities}
        onSelect={(id) => { onCloseSelector(); handleStartInner(id, onStart); }}
        onClose={onCloseSelector}
      />
    </View>
  );
}

function FocusIntervalControl({ colors, styles, value, onChange, breakDuration, onChangeBreakDuration }) {
  const [recommendationsVisible, setRecommendationsVisible] = useState(false);
  const [tip, setTip] = useState(BREAK_TIPS[0]);

  function openRecommendations() {
    setTip(currentTip => {
      const alternatives = BREAK_TIPS.filter(item => item !== currentTip);
      return alternatives[Math.floor(Math.random() * alternatives.length)];
    });
    setRecommendationsVisible(true);
  }

  return (
    <>
      <View style={styles.intervalCard}>
        <View style={styles.intervalCopy}>
          <Text style={styles.intervalTitle}>Avisarme cada</Text>
          <Text style={styles.intervalHint}>Descanso cada vez</Text>
        </View>
        <TouchableOpacity
          style={styles.intervalButton}
          onPress={() => onChange(-5)}
          disabled={value <= MIN_FOCUS_INTERVAL_MINUTES}
          accessibilityLabel="Reducir intervalo de enfoque"
        >
          <Ionicons name="remove" size={20} color={value <= MIN_FOCUS_INTERVAL_MINUTES ? colors.text.muted : colors.primary[500]} />
        </TouchableOpacity>
        <Text style={styles.intervalValue}>{value} min</Text>
        <TouchableOpacity
          style={styles.intervalButton}
          onPress={() => onChange(5)}
          disabled={value >= MAX_FOCUS_INTERVAL_MINUTES}
          accessibilityLabel="Aumentar intervalo de enfoque"
        >
          <Ionicons name="add" size={20} color={value >= MAX_FOCUS_INTERVAL_MINUTES ? colors.text.muted : colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <View style={styles.intervalCard}>
        <View style={styles.intervalCopy}>
          <Text style={styles.intervalTitle}>Duración del descanso</Text>
          <Text style={styles.intervalHint}>Ajustable de 5 a 60 min</Text>
        </View>
        <TouchableOpacity
          style={styles.intervalButton}
          onPress={() => onChangeBreakDuration(-5)}
          disabled={breakDuration <= MIN_BREAK_DURATION_MINUTES}
          accessibilityLabel="Reducir duración del descanso"
        >
          <Ionicons name="remove" size={20} color={breakDuration <= MIN_BREAK_DURATION_MINUTES ? colors.text.muted : colors.primary[500]} />
        </TouchableOpacity>
        <Text style={styles.intervalValue}>{breakDuration} min</Text>
        <TouchableOpacity
          style={styles.intervalButton}
          onPress={() => onChangeBreakDuration(5)}
          disabled={breakDuration >= MAX_BREAK_DURATION_MINUTES}
          accessibilityLabel="Aumentar duración del descanso"
        >
          <Ionicons name="add" size={20} color={breakDuration >= MAX_BREAK_DURATION_MINUTES ? colors.text.muted : colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.recommendationsLink}
        onPress={openRecommendations}
        activeOpacity={0.75}
        accessibilityRole="button"
      >
        <Ionicons name="help-circle-outline" size={18} color={colors.primary[500]} />
        <Text style={styles.recommendationsLinkText}>¿No sabes cuánto tiempo elegir?</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
      </TouchableOpacity>

      <RecommendationsModal
        visible={recommendationsVisible}
        onClose={() => setRecommendationsVisible(false)}
        colors={colors}
        styles={styles}
        tip={tip}
      />
    </>
  );
}

const BREAK_TIPS = [
  'Una pausa breve puede ayudarte a volver a la tarea con energía renovada.',
  'Cambiar de postura y estirar suavemente puede hacer más cómoda una sesión larga.',
  'Mirar algo lejano durante unos segundos le da a tus ojos un cambio de enfoque.',
  'Tomar un poco de agua es una forma sencilla de aprovechar tu descanso.',
  'Unos minutos de movimiento suave pueden ayudarte a despejar la mente.',
  'Respirar con calma durante la pausa puede marcar un momento claro entre tareas.',
];

function RecommendationsModal({ visible, onClose, colors, styles, tip }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.recommendationsOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Cerrar recomendaciones"
        />
        <View style={styles.recommendationsSheet}>
          <View style={styles.recommendationsHeader}>
            <View style={styles.recommendationsHeading}>
              <Text style={styles.recommendationsTitle}>Encuentra tu ritmo</Text>
              <Text style={styles.recommendationsSubtitle}>Algunas recomendaciones para empezar</Text>
            </View>
            <TouchableOpacity
              style={styles.recommendationsClose}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar recomendaciones"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.recommendationsScroll}
            contentContainerStyle={styles.recommendationsContent}
            showsVerticalScrollIndicator={false}
          >
            <RecommendationCard
              colors={colors}
              styles={styles}
              icon="timer-outline"
              title="Pomodoro clásico"
              tag="Ideal para comenzar"
              accent={colors.primary[500]}
              focus="25"
              rest="5"
            />
            <RecommendationCard
              colors={colors}
              styles={styles}
              icon="hourglass-outline"
              title="Sesiones prolongadas"
              tag="Para actividades que requieren continuidad"
              accent={colors.accent[500]}
              focus="50"
              rest="10"
            />
            <RecommendationCard
              colors={colors}
              styles={styles}
              icon="options-outline"
              title="Tiempo flexible"
              tag="Cada persona tiene su propio ritmo"
              accent={colors.rose[400]}
              flexible
            />

            <View style={styles.tipCard}>
              <View style={styles.tipHeading}>
                <Ionicons name="sparkles-outline" size={18} color={colors.accent[500]} />
                <Text style={styles.tipTitle}>¿Sabías que...?</Text>
              </View>
              <Text style={styles.tipBody}>{tip}</Text>
            </View>

            <Text style={styles.recommendationsNote}>
              No existe un tiempo ideal universal. Encuentra el intervalo que mejor funcione para ti.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RecommendationCard({ colors, styles, icon, title, tag, accent, focus, rest, flexible = false }) {
  return (
    <View style={[styles.recommendationCard, { borderLeftColor: accent }]}>
      <View style={styles.recommendationCardHeader}>
        <View style={[styles.recommendationIcon, { backgroundColor: accent + '20' }]}>
          <Ionicons name={icon} size={20} color={accent} />
        </View>
        <Text style={styles.recommendationCardTitle}>{title}</Text>
      </View>

      {flexible ? (
        <View style={styles.flexibleVisual}>
          <Text style={[styles.flexibleSymbol, { color: accent }]}>∞</Text>
          <Text style={styles.flexibleCopy}>Personaliza tus propios intervalos</Text>
        </View>
      ) : (
        <View style={styles.recommendationMetrics}>
          <View style={styles.recommendationMetric}>
            <Text style={[styles.recommendationNumber, { color: accent }]}>{focus}</Text>
            <Text style={styles.recommendationUnit}>min concentración</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.text.muted} />
          <View style={styles.recommendationMetric}>
            <Text style={[styles.recommendationNumber, { color: accent }]}>{rest}</Text>
            <Text style={styles.recommendationUnit}>min descanso</Text>
          </View>
        </View>
      )}

      <View style={[styles.recommendationTag, { backgroundColor: accent + '18' }]}>
        <Text style={[styles.recommendationTagText, { color: accent }]}>{tag}</Text>
      </View>
    </View>
  );
}

function handleStartInner(id, onStart) { onStart(id); }

// ─── Modal selector ───────────────────────────────────────────────────────────

function ActivitySelectorModal({ colors, styles, visible, activities, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.selectorOverlay}>
        <View style={styles.selectorSheet}>
          <View style={styles.selectorHeader}>
            <Text style={styles.selectorTitle}>¿Qué vas a hacer?</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {activities.map(act => (
              <TouchableOpacity
                key={act.id}
                style={styles.selectorItem}
                onPress={() => onSelect(act.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.selectorIcon, { backgroundColor: act.color + '22' }]}>
                  <Ionicons name={act.icon} size={22} color={act.color} />
                </View>
                <Text style={styles.selectorName}>{act.name}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

function makeStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.screen,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.base,
      gap: spacing.lg,
    },
    centered: {
      flex: 1, backgroundColor: colors.background.screen,
      alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    },
    loadingText: {
      fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.text.secondary,
    },

    // Cabecera de sesión
    sessionHeader: { alignItems: 'center', gap: spacing.xs },
    iconCircle: {
      width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    },
    activityName: {
      fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.text.primary,
    },
    statusPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: spacing.radius.full,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontFamily: fonts.semibold, fontSize: fontSize.xs },

    // Contador de tiempo
    timerBlock: { alignItems: 'center', gap: 4 },
    timerDisplay: {
      fontFamily: fonts.bold,
      fontSize: fontSize.timer,
      color: colors.text.primary,
      letterSpacing: 2,
    },
    timerPaused: { opacity: 0.45 },
    timerSub: {
      fontFamily: fonts.regular, fontSize: fontSize.xs,
      color: colors.text.muted, letterSpacing: 0.5,
    },

    // Controles
    controls: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    controlBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
      borderRadius: spacing.radius.full, borderWidth: 1.5,
    },
    controlLabel: { fontFamily: fonts.semibold, fontSize: fontSize.sm },
    completeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderRadius: spacing.radius.full,
    },
    completeBtnText: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: '#fff' },
    cancelButton: { paddingVertical: spacing.xs },
    cancelText: {
      fontFamily: fonts.regular, fontSize: fontSize.sm,
      color: colors.text.muted, textDecorationLine: 'underline',
    },
    intervalCard: {
      width: '100%',
      maxWidth: 420,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      borderRadius: spacing.radius.lg,
      padding: spacing.sm,
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.primary[100],
    },
    intervalCopy: { flex: 1, paddingLeft: spacing.xs, gap: 2 },
    intervalTitle: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.text.primary },
    intervalHint: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.text.muted },
    intervalButton: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[100],
    },
    intervalValue: {
      minWidth: 54, textAlign: 'center',
      fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.primary[500],
    },
    recommendationsLink: {
      alignSelf: 'center',
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    recommendationsLinkText: {
      fontFamily: fonts.semibold,
      fontSize: fontSize.xs,
      color: colors.primary[500],
    },
    recommendationsOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.base,
      backgroundColor: colors.background.overlay,
    },
    recommendationsSheet: {
      width: '100%',
      maxWidth: 440,
      maxHeight: '92%',
      backgroundColor: colors.background.card,
      borderRadius: spacing.radius.xl,
      padding: spacing.base,
      gap: spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 10,
    },
    recommendationsHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    recommendationsHeading: { flex: 1, gap: 2 },
    recommendationsTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.lg,
      color: colors.text.primary,
    },
    recommendationsSubtitle: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.text.secondary,
    },
    recommendationsClose: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: colors.primary[100],
    },
    recommendationsScroll: { flexShrink: 1 },
    recommendationsContent: { gap: spacing.sm, paddingBottom: spacing.xs },
    recommendationCard: {
      backgroundColor: colors.background.screen,
      borderRadius: spacing.radius.lg,
      borderLeftWidth: 4,
      padding: spacing.md,
      gap: spacing.sm,
    },
    recommendationCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    recommendationIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recommendationCardTitle: {
      flex: 1,
      fontFamily: fonts.bold,
      fontSize: fontSize.base,
      color: colors.text.primary,
    },
    recommendationMetrics: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    recommendationMetric: {
      flex: 1,
      minHeight: 68,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.card,
      borderRadius: spacing.radius.md,
      paddingVertical: spacing.xs,
      paddingHorizontal: 2,
    },
    recommendationNumber: {
      fontFamily: fonts.bold,
      fontSize: 30,
      lineHeight: 34,
    },
    recommendationUnit: {
      fontFamily: fonts.semibold,
      fontSize: 10,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    recommendationTag: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      borderRadius: spacing.radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    recommendationTagText: {
      fontFamily: fonts.semibold,
      fontSize: 11,
    },
    flexibleVisual: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background.card,
      borderRadius: spacing.radius.md,
      paddingHorizontal: spacing.sm,
    },
    flexibleSymbol: {
      fontFamily: fonts.bold,
      fontSize: 42,
      lineHeight: 50,
    },
    flexibleCopy: {
      flexShrink: 1,
      fontFamily: fonts.semibold,
      fontSize: fontSize.sm,
      color: colors.text.primary,
    },
    tipCard: {
      backgroundColor: colors.background.cardAlt,
      borderRadius: spacing.radius.lg,
      padding: spacing.md,
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.accent[200],
    },
    tipHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    tipTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.sm,
      color: colors.text.primary,
    },
    tipBody: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.45,
      color: colors.text.secondary,
    },
    recommendationsNote: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.45,
      color: colors.text.muted,
      textAlign: 'center',
      paddingHorizontal: spacing.xs,
    },

    // Sin sesión
    emptyIllustration: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
    emptyEmoji: { fontSize: 64 },
    emptyTitle: {
      fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text.primary, textAlign: 'center',
    },
    emptySubtitle: {
      fontFamily: fonts.regular, fontSize: fontSize.base,
      color: colors.text.secondary, textAlign: 'center', lineHeight: fontSize.base * 1.6,
    },
    startButtonMain: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: colors.primary[500],
      paddingHorizontal: spacing.xl, paddingVertical: spacing.base,
      borderRadius: spacing.radius.full,
      shadowColor: colors.primary[600],
      shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
    },
    startButtonText: { fontFamily: fonts.bold, fontSize: fontSize.base, color: '#fff' },

    // Selector modal
    selectorOverlay: {
      flex: 1, justifyContent: 'flex-end', backgroundColor: colors.background.overlay,
    },
    selectorSheet: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: spacing.radius.xl, borderTopRightRadius: spacing.radius.xl,
      padding: spacing.lg, paddingBottom: 40, maxHeight: '70%',
    },
    selectorHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: spacing.base,
    },
    selectorTitle: {
      fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.text.primary,
    },
    selectorItem: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.base,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1, borderBottomColor: colors.primary[100],
    },
    selectorIcon: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    },
    selectorName: {
      flex: 1, fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.text.primary,
    },
  });
}

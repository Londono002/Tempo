/**
 * useTimer.js — Hook del motor del temporizador.
 *
 * ─── Responsabilidades ────────────────────────────────────────────────────────
 *  1. Al montar: busca en SQLite si hay una sesión activa o pausada y la restaura.
 *  2. Mantiene un intervalo de 1 segundo que actualiza elapsedMs.
 *  3. Expone funciones de control (start, pause, resume, complete, cancel).
 *  4. Al desmontar: limpia el intervalo para evitar fugas de memoria.
 *
 * ─── Fuente de verdad ─────────────────────────────────────────────────────────
 *  El intervalo NO incrementa un contador; recalcula el tiempo efectivo
 *  a partir de los timestamps almacenados en SQLite. Esto garantiza que:
 *    - Si la app vuelve del fondo, el tiempo salta al valor correcto
 *    - Si el dispositivo cambia de hora, el cálculo sigue siendo correcto
 *    - No hay deriva acumulada de milisegundos
 *
 * ─── Cómo usarlo ─────────────────────────────────────────────────────────────
 *  const {
 *    status,         // 'idle' | 'active' | 'paused'
 *    session,        // objeto de sesión o null
 *    elapsedMs,      // milisegundos efectivos transcurridos
 *    loading,        // true mientras restaura la sesión inicial
 *    startSession,   // (activityId) => Promise<void>
 *    pauseSession,   // () => Promise<void>
 *    resumeSession,  // () => Promise<void>
 *    completeSession,// () => Promise<void>
 *    cancelSession,  // () => Promise<void>
 *  } = useTimer();
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import {
  getActiveSession,
  getSessionPauses,
  startSession  as dbStartSession,
  pauseSession  as dbPauseSession,
  resumeSession as dbResumeSession,
  completeSession as dbCompleteSession,
  cancelSession as dbCancelSession,
} from '../services/sessionsService';

import { calcularTiempoEfectivo } from '../logic/timer';

export function useTimer() {
  const [session,   setSession]   = useState(null);
  const [pauses,    setPauses]    = useState([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [loading,   setLoading]   = useState(true);

  // Ref para que el intervalo siempre lea el estado más reciente
  // sin necesidad de reiniciar el interval en cada render.
  const stateRef = useRef({ session: null, pauses: [] });

  // Sincronizar stateRef con el estado de React
  useEffect(() => {
    stateRef.current = { session, pauses };
  }, [session, pauses]);

  const intervalRef = useRef(null);

  // ─── Intervalo ─────────────────────────────────────────────────────────────

  const iniciarInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const { session: s, pauses: p } = stateRef.current;
      if (s && s.status === 'active') {
        setElapsedMs(calcularTiempoEfectivo({ startedAt: s.started_at, pauses: p }));
      }
    }, 1000);
  }, []);

  const detenerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ─── Restaurar sesión al montar ─────────────────────────────────────────────

  useEffect(() => {
    let cancelado = false;

    async function restaurar() {
      setLoading(true);
      try {
        const s = await getActiveSession();
        if (!s || cancelado) return;

        const p = await getSessionPauses(s.id);
        if (cancelado) return;

        setSession(s);
        setPauses(p);
        setElapsedMs(calcularTiempoEfectivo({ startedAt: s.started_at, pauses: p }));

        if (s.status === 'active') iniciarInterval();
      } catch (e) {
        console.error('useTimer: error al restaurar sesión', e);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    restaurar();

    return () => {
      cancelado = true;
      detenerInterval();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mutaciones públicas ────────────────────────────────────────────────────

  /**
   * Inicia una nueva sesión para la actividad dada.
   * Lanza Error si ya hay una sesión activa.
   */
  const startSession = useCallback(async (activityId) => {
    const s = await dbStartSession(activityId);
    setSession(s);
    setPauses([]);
    setElapsedMs(0);
    iniciarInterval();
  }, [iniciarInterval]);

  /**
   * Pausa la sesión activa.
   */
  const pauseSession = useCallback(async () => {
    const { session: s, pauses: p } = stateRef.current;
    if (!s || s.status !== 'active') return;

    detenerInterval();

    const { pauseId, pausedAt } = await dbPauseSession(s.id);

    const nuevaPausa = {
      id: pauseId,
      session_id: s.id,
      paused_at: pausedAt,
      resumed_at: null,
    };
    const pausasConNueva = [...p, nuevaPausa];

    setPauses(pausasConNueva);
    setSession(prev => ({ ...prev, status: 'paused' }));

    // Congelar el tiempo en el momento exacto de la pausa
    setElapsedMs(calcularTiempoEfectivo({ startedAt: s.started_at, pauses: pausasConNueva }));
  }, [detenerInterval]);

  /**
   * Reanuda la sesión pausada.
   */
  const resumeSession = useCallback(async () => {
    const { session: s, pauses: p } = stateRef.current;
    if (!s || s.status !== 'paused') return;

    // Buscar la última pausa sin resumed_at
    const pausaActiva = [...p].reverse().find(pa => !pa.resumed_at);
    if (!pausaActiva) return;

    const resumedAt = await dbResumeSession(s.id, pausaActiva.id);

    const pausasActualizadas = p.map(pa =>
      pa.id === pausaActiva.id ? { ...pa, resumed_at: resumedAt } : pa
    );

    setPauses(pausasActualizadas);
    setSession(prev => ({ ...prev, status: 'active' }));
    iniciarInterval();
  }, [iniciarInterval]);

  /**
   * Completa la sesión: calcula el tiempo efectivo y lo guarda en SQLite.
   */
  const completeSession = useCallback(async () => {
    const { session: s, pauses: p } = stateRef.current;
    if (!s) return;

    detenerInterval();
    const efectivo = calcularTiempoEfectivo({ startedAt: s.started_at, pauses: p });
    await dbCompleteSession(s.id, efectivo);

    setSession(null);
    setPauses([]);
    setElapsedMs(0);
  }, [detenerInterval]);

  /**
   * Cancela la sesión sin guardar tiempo.
   */
  const cancelSession = useCallback(async () => {
    const { session: s } = stateRef.current;
    if (!s) return;

    detenerInterval();
    await dbCancelSession(s.id);

    setSession(null);
    setPauses([]);
    setElapsedMs(0);
  }, [detenerInterval]);

  // ─── API pública ────────────────────────────────────────────────────────────

  return {
    session,
    pauses,
    elapsedMs,
    loading,
    status: session?.status ?? 'idle',

    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    cancelSession,
  };
}

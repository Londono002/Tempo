/**
 * ActivitiesScreen.js
 *
 * Pantalla de gestión de actividades.
 *
 * BUGS CORREGIDOS:
 *  1. Modal: se eliminó onStartShouldSetResponder (robaba eventos a botones
 *     internos) y TouchableWithoutFeedback anidado. Ahora el backdrop es un
 *     TouchableOpacity flex:1 ARRIBA del sheet en un FlexColumn normal, así
 *     las pulsaciones en el sheet llegan a sus hijos sin interferencia.
 *  2. Loading: loadActivities ya no muestra spinner de pantalla completa
 *     en las recargas post-guardado (solo en la carga inicial). Así el FAB
 *     nunca desaparece mientras la lista se actualiza.
 *  3. Botón guardar: está tanto en el header (rápido) como al final del
 *     ScrollView (accesible con teclado abierto), cubriendo ambos casos.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import {
  getAllActivities,
  createActivity,
  updateActivity,
  softDeleteActivity,
  hardDeleteActivity,
  activityHasSessions,
} from '../services/activitiesService';

import {
  ACTIVITY_ICONS,
  ACTIVITY_COLORS,
  DEFAULT_ICON,
  DEFAULT_COLOR,
} from '../constants/activityOptions';
import { useTheme } from '../context/ThemeContext';
import spacing  from '../theme/spacing';
import { fonts, fontSize } from '../theme/typography';

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ActivitiesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [activities,      setActivities]      = useState([]);
  const [initialLoading,  setInitialLoading]  = useState(true);  // solo primer carga
  const [modalVisible,    setModalVisible]    = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);

  // Campos del formulario
  const [formName,  setFormName]  = useState('');
  const [formIcon,  setFormIcon]  = useState(DEFAULT_ICON);
  const [formColor, setFormColor] = useState(DEFAULT_COLOR);
  const [saving,    setSaving]    = useState(false);

  // Cargar actividades al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      loadActivities(true);
    }, [])
  );

  // ── Carga ──────────────────────────────────────────────────────────────────

  async function loadActivities(showSpinner = false) {
    if (showSpinner) setInitialLoading(true);
    try {
      const data = await getAllActivities();
      setActivities(data);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar las actividades.');
    } finally {
      if (showSpinner) setInitialLoading(false);
    }
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  function openCreateModal() {
    setEditingActivity(null);
    setFormName('');
    setFormIcon(DEFAULT_ICON);
    setFormColor(DEFAULT_COLOR);
    setModalVisible(true);
  }

  function openEditModal(activity) {
    setEditingActivity(activity);
    setFormName(activity.name);
    setFormIcon(activity.icon);
    setFormColor(activity.color);
    setModalVisible(true);
  }

  function closeModal() {
    Keyboard.dismiss();
    setModalVisible(false);
    setEditingActivity(null);
  }

  // ── Guardar ────────────────────────────────────────────────────────────────

  async function handleSave() {
    Keyboard.dismiss();

    const trimmed = formName.trim();
    if (!trimmed) {
      Alert.alert(
        'Nombre requerido',
        'Escribe un nombre para identificar la actividad.',
        [{ text: 'OK', onPress: () => {} }]
      );
      return;
    }

    setSaving(true);
    try {
      if (editingActivity) {
        await updateActivity(editingActivity.id, trimmed, formIcon, formColor);
      } else {
        await createActivity(trimmed, formIcon, formColor);
      }
      // Cerrar modal ANTES de recargar para que el usuario vea el resultado
      closeModal();
      // Recarga silenciosa — sin spinner de pantalla completa
      await loadActivities(false);
    } catch (e) {
      Alert.alert(
        'Error al guardar',
        e?.message ?? 'No se pudo guardar la actividad. Inténtalo de nuevo.'
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────

  async function handleDelete(activity) {
    let hasSessions = false;
    try { hasSessions = await activityHasSessions(activity.id); } catch (_) {}

    const mensaje = hasSessions
      ? `"${activity.name}" tiene sesiones registradas. Se ocultará de la lista pero su historial se conservará.`
      : `¿Eliminar "${activity.name}"? Esta acción no se puede deshacer.`;

    Alert.alert('Eliminar actividad', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            if (hasSessions) {
              await softDeleteActivity(activity.id);
            } else {
              await hardDeleteActivity(activity.id);
            }
            await loadActivities(false);
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar la actividad.');
          }
        },
      },
    ]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {activities.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={56} color={colors.primary[300]} />
          <Text style={styles.emptyTitle}>Sin actividades todavía</Text>
          <Text style={styles.emptySubtitle}>
            Toca el botón "+" para crear tu primera actividad.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ActivityCard
              activity={item}
              onPress={() => openEditModal(item)}
              onLongPress={() => handleDelete(item)}
              colors={colors}
              styles={styles}
            />
          )}
        />
      )}

      {/* Botón flotante añadir */}
      <TouchableOpacity
        style={styles.fab}
        onPress={openCreateModal}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal crear / editar */}
      <ActivityFormModal
        visible={modalVisible}
        editing={editingActivity}
        name={formName}
        icon={formIcon}
        color={formColor}
        saving={saving}
        onChangeName={setFormName}
        onChangeIcon={setFormIcon}
        onChangeColor={setFormColor}
        onSave={handleSave}
        onClose={closeModal}
        colors={colors}
        styles={styles}
      />
    </View>
  );
}

// ─── ActivityCard ─────────────────────────────────────────────────────────────

function ActivityCard({ activity, onPress, onLongPress, colors, styles }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      delayLongPress={400}
    >
      <View style={[styles.iconCircle, { backgroundColor: activity.color + '22' }]}>
        <Ionicons name={activity.icon} size={24} color={activity.color} />
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{activity.name}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
    </TouchableOpacity>
  );
}

// ─── ActivityFormModal ────────────────────────────────────────────────────────
//
// PATRÓN CORRECTO para modales bottom-sheet en Android:
//
//   <Modal>
//     <View style={overlay}>                    ← flex:1, fondo semitransparente
//       <TouchableOpacity flex:1 onPress=cerrar />  ← backdrop (área ENCIMA del sheet)
//       <View style={sheet}>                    ← sheet simple, sin wrappers Touchable
//         <TouchableOpacity onPress=cerrar />   ← botón X
//         <TouchableOpacity onPress=onSave />   ← botón Crear (funciona correctamente)
//         <ScrollView keyboardShouldPersistTaps="handled">
//           ...campos del formulario...
//           <TouchableOpacity onPress=onSave /> ← botón Crear también al final del scroll
//         </ScrollView>
//       </View>
//     </View>
//   </Modal>
//
// Por qué funciona:
//  - El backdrop (TouchableOpacity flex:1) solo cubre el área ARRIBA del sheet.
//  - El sheet es un <View> simple, sin ningún Touchable envolvente.
//  - Los botones dentro del sheet reciben sus eventos con normalidad.
//  - NO se usa onStartShouldSetResponder (que robaba eventos a los hijos).

function ActivityFormModal({
  visible, editing, name, icon, color, saving,
  onChangeName, onChangeIcon, onChangeColor, onSave, onClose,
  colors, styles,
}) {
  const esNueva = !editing;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>

        {/* Backdrop: solo cubre el área oscura ARRIBA del sheet */}
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={onClose}
          activeOpacity={1}
        />

        {/* Sheet: View simple. Sus hijos reciben toques sin interferencia */}
        <View style={styles.modalSheet}>

          {/* ── Cabecera: título + X + botón rápido Crear ── */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {esNueva ? 'Nueva actividad' : 'Editar actividad'}
            </Text>

            {/* Botón guardar en header: visible aunque el teclado esté abierto */}
            <TouchableOpacity
              onPress={onSave}
              disabled={saving}
              style={[styles.headerSaveBtn, saving && { opacity: 0.45 }]}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            >
              {saving
                ? <ActivityIndicator size="small" color={color} />
                : <Text style={[styles.headerSaveBtnText, { color }]}>
                    {esNueva ? '✓ Crear' : '✓ Guardar'}
                  </Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            >
              <Ionicons name="close-circle-outline" size={26} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* ── Contenido desplazable ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalScrollContent}
          >
            {/* Vista previa */}
            <View style={styles.preview}>
              <View style={[styles.previewCircle, { backgroundColor: color + '33' }]}>
                <Ionicons name={icon} size={36} color={color} />
              </View>
              <Text style={[styles.previewName, { color }]}>
                {name.trim() || 'Mi actividad'}
              </Text>
            </View>

            {/* Nombre */}
            <Text style={styles.fieldLabel}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={onChangeName}
              placeholder="ej. Leer, Estudiar, Ejercicio..."
              placeholderTextColor={colors.text.muted}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            {/* Color */}
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorGrid}>
              {ACTIVITY_COLORS.map(c => (
                <TouchableOpacity
                  key={c.hex}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c.hex },
                    color === c.hex && styles.colorDotSelected,
                  ]}
                  onPress={() => onChangeColor(c.hex)}
                  activeOpacity={0.8}
                />
              ))}
            </View>

            {/* Icono */}
            <Text style={styles.fieldLabel}>Icono</Text>
            <View style={styles.iconGrid}>
              {ACTIVITY_ICONS.map(ic => (
                <TouchableOpacity
                  key={ic.key}
                  style={[
                    styles.iconOption,
                    icon === ic.key && { backgroundColor: color + '33', borderColor: color },
                  ]}
                  onPress={() => onChangeIcon(ic.key)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={ic.key}
                    size={22}
                    color={icon === ic.key ? color : colors.text.secondary}
                  />
                  <Text style={[
                    styles.iconLabel,
                    icon === ic.key && { color, fontFamily: fonts.semibold },
                  ]}>
                    {ic.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Botón guardar al final del scroll ──
                Siempre accesible bajando scroll, aunque el teclado esté abierto */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: color }, saving && { opacity: 0.55 }]}
              onPress={onSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveButtonText}>
                    {esNueva ? 'Crear actividad' : 'Guardar cambios'}
                  </Text>
              }
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

function makeStyles(colors) {
  return StyleSheet.create({
    // Pantalla
    container: {
      flex: 1,
      backgroundColor: colors.background.screen,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.screen,
    },

    // Lista
    list: {
      padding: spacing.base,
      paddingBottom: 100,
    },
    separator: { height: spacing.sm },

    // Estado vacío
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.sm,
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

    // Tarjeta de actividad
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.card,
      borderRadius: spacing.radius.lg,
      padding: spacing.base,
      gap: spacing.base,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardName: {
      flex: 1,
      fontFamily: fonts.semibold,
      fontSize: fontSize.base,
      color: colors.text.primary,
    },

    // FAB
    fab: {
      position: 'absolute',
      bottom: spacing.xl,
      right: spacing.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary[500],
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary[600],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },

    // ── Modal ──────────────────────────────────────────────────────────────────

    // Fondo semitransparente — ocupa la pantalla completa
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.background.overlay,
      // NO justifyContent:'flex-end' — el layout flex normal pone backdrop arriba y sheet abajo
    },

    // Backdrop: ocupa TODO el espacio disponible ENCIMA del sheet
    // Al ser TouchableOpacity flex:1, solo cubre el área oscura.
    modalBackdrop: {
      flex: 1,
    },

    // Hoja inferior
    modalSheet: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: spacing.radius.xl,
      borderTopRightRadius: spacing.radius.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.base,
      paddingBottom: spacing.lg,
      maxHeight: '90%',
    },

    // Cabecera del modal
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    modalTitle: {
      flex: 1,
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.text.primary,
    },
    headerSaveBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    headerSaveBtnText: {
      fontFamily: fonts.bold,
      fontSize: fontSize.base,
    },

    // Scroll del modal
    modalScrollContent: {
      paddingBottom: spacing.xl,
    },

    // Vista previa
    preview: {
      alignItems: 'center',
      paddingVertical: spacing.base,
      gap: spacing.sm,
      marginBottom: spacing.base,
    },
    previewCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewName: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
    },

    // Campos
    fieldLabel: {
      fontFamily: fonts.semibold,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      marginBottom: spacing.xs,
      marginTop: spacing.base,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    input: {
      backgroundColor: colors.background.card,
      borderRadius: spacing.radius.md,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm + 2,
      fontFamily: fonts.regular,
      fontSize: fontSize.base,
      color: colors.text.primary,
      borderWidth: 1.5,
      borderColor: colors.primary[300],
    },

    // Selector de color
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    colorDot: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    colorDotSelected: {
      borderWidth: 3,
      borderColor: colors.white,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },

    // Selector de icono
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    iconOption: {
      width: '30%',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: spacing.radius.md,
      borderWidth: 1.5,
      borderColor: colors.primary[100],
      gap: 4,
      backgroundColor: colors.background.card,
    },
    iconLabel: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.text.secondary,
    },

    // Botón guardar grande (dentro del ScrollView)
    saveButton: {
      borderRadius: spacing.radius.lg,
      paddingVertical: spacing.base + 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    saveButtonText: {
      fontFamily: fonts.bold,
      fontSize: fontSize.base,
      color: '#fff',
    },
  });
}

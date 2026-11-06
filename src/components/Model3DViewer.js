/**
 * Model3DViewer.js
 *
 * Renderiza un modelo 3D (.glb / .gltf) girando lentamente.
 * Usa expo-gl (WebGL 1) + three.js r162 (última versión con soporte WebGL 1)
 * + GLTFLoader para cargar el archivo.
 *
 * Uso:
 *   <Model3DViewer
 *     modelUri={require('../../assets/models/potted_seedling.glb')}
 *     size={240}
 *     rotationSpeed={0.006}
 *   />
 */

import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, AppState } from 'react-native';
import { GLView } from 'expo-gl';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

globalThis.THREE = globalThis.THREE || THREE;

export default function Model3DViewer({
  modelUri      = null,
  size          = 260,
  rotationSpeed = 0.006,
  growth        = 1,
  isActive      = true,
}) {
  const rendererRef = useRef(null);
  const rafRef      = useRef(null);
  const timeoutRef  = useRef(null);
  const modelRef    = useRef(null);
  const baseScaleRef = useRef(1);
  const basePositionRef = useRef(new THREE.Vector3());
  const growthRef   = useRef(growth);
  let previousFrameAt = Date.now();
  const activeRef   = useRef(isActive);
  const appStateRef = useRef(AppState.currentState);
  const [loading, setLoading] = useState(true);
  const [errMsg,  setErrMsg]  = useState(null);

  activeRef.current = isActive;
  growthRef.current = growth;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      appStateRef.current = state;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rendererRef.current) rendererRef.current.dispose();
    };
  }, []);

  async function onContextCreate(gl) {
    try {
      // ── Renderer (expo-three maneja el contexto WebGL 1 de expo-gl) ──────────
      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000000, 0); // fondo transparente
      rendererRef.current = renderer;

      // ── Escena ────────────────────────────────────────────────────────────────
      const scene  = new THREE.Scene();
      const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      const camera = new THREE.PerspectiveCamera(40, aspect, 0.01, 1000);
      camera.position.set(0, 0.5, 4);
      camera.lookAt(0, 0, 0);

      // ── Iluminación cálida y suave ────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xfff8f0, 1.2));

      const sun = new THREE.DirectionalLight(0xffeedd, 1.5);
      sun.position.set(3, 6, 4);
      scene.add(sun);

      const fill = new THREE.DirectionalLight(0xd0e8ff, 0.5);
      fill.position.set(-3, 0, 3);
      scene.add(fill);

      // Lee el GLB desde el sistema de archivos nativo y lo parsea en memoria.
      // No se usa el placeholder giratorio: ante un error se muestra un mensaje.
      if (!modelUri) throw new Error('No se configuró un modelo 3D.');
      const model = await loadGLB(modelUri);
      baseScaleRef.current = fitModelToView(model, camera);
      basePositionRef.current.copy(model.position);
      scene.add(model);
      modelRef.current = model;

      setLoading(false);

      // ── Loop de animación ─────────────────────────────────────────────────────
      const animate = () => {
        const shouldAnimate = activeRef.current && appStateRef.current === 'active';
        if (!shouldAnimate) {
          timeoutRef.current = setTimeout(animate, 250);
          return;
        }
        rafRef.current = requestAnimationFrame(animate);
        if (modelRef.current) {
          const now = Date.now();
          const frameScale = Math.min((now - previousFrameAt) / 16.67, 3);
          previousFrameAt = now;
          modelRef.current.rotation.y += rotationSpeed * frameScale;
          const targetScale = baseScaleRef.current * growthRef.current;
          const currentScale = modelRef.current.scale.x;
          modelRef.current.scale.setScalar(currentScale + (targetScale - currentScale) * Math.min(1, 0.06 * frameScale));
          // Ligero balanceo vertical tipo "flotando"
          modelRef.current.position.y = basePositionRef.current.y + Math.sin(Date.now() * 0.001) * 0.06;
        }
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();

    } catch (e) {
      console.warn('Model3DViewer:', e?.message ?? e);
      setErrMsg(e?.message ?? 'Error inicializando WebGL');
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      {loading && !errMsg && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#7c6bbf" />
        </View>
      )}
      {errMsg && (
        <View style={styles.overlay}>
          <Text style={styles.fallbackPlant}>🌱</Text>
          <Text style={styles.errText}>No se pudo mostrar la planta ahora.</Text>
        </View>
      )}
    </View>
  );
}

// ─── Carga el modelo resolviendo primero el asset local de Expo ───────────────
async function loadGLB(uri) {
  // uri puede ser un número (require()) o un string con ruta/URL
  let localUri;
  if (typeof uri === 'number') {
    const asset = Asset.fromModule(uri);
    await asset.downloadAsync();
    localUri = asset.localUri;
  } else {
    localUri = uri;
  }

  if (!localUri) throw new Error('No se pudo localizar el modelo 3D.');

  const data = await new File(localUri).arrayBuffer();
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(data, '', gltf => resolve(gltf.scene), reject);
  });
}

// ─── Centra y escala el modelo para que quepa bien en la vista ────────────────
function fitModelToView(model, camera) {
  const box    = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size   = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim <= 0) {
    throw new Error('El modelo no tiene dimensiones válidas');
  }

  // Escalar para que el modelo mida ~2 unidades en el eje más grande
  const scale = 2.0 / maxDim;
  model.scale.setScalar(scale);

  // Centrar en el origen (ajustado por el escalado)
  model.position.sub(center.multiplyScalar(scale));

  // Ajustar cámara según el tamaño escalado
  camera.position.z = 3.5;
  return scale;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    padding: 12,
  },
  fallbackPlant: { fontSize: 58 },
});

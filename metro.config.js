// metro.config.js
// Registra extensiones de modelos 3D para que Metro las sirva como assets binarios.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Añadir extensiones de modelos 3D y texturas
config.resolver.assetExts.push(
  'glb',   // GL Binary (el formato más común, todo en un archivo)
  'gltf',  // GL Transmission Format (con archivos externos)
  'mtl',   // Material OBJ
  'obj',   // Wavefront OBJ
  'bin',   // Buffers de datos GLTF
);

module.exports = config;

# TEMPO

![Icono de TEMPO](assets/tempo-logo.png)

TEMPO es una aplicación móvil para organizar sesiones de concentración y descanso. Está construida con Expo y React Native, con Android como plataforma principal.

## Funciones

- Crea actividades y asigna tiempos de concentración y descanso.
- Recibe notificaciones locales cuando llega el momento de descansar y al terminar el descanso.
- Consulta el historial de sesiones y el tiempo dedicado a tus actividades.
- Cuida una planta 3D que crece con el uso y gira en la pantalla principal.
- Encuentra recomendaciones para elegir intervalos y consejos breves sobre concentración.
- Guarda sesiones, actividades y preferencias localmente en el dispositivo mediante SQLite.

## Tecnologías

- Expo SDK 58 y React Native 0.88
- Expo SQLite para almacenamiento local
- Three.js, expo-gl y expo-three para el modelo 3D
- expo-notifications para recordatorios locales

## Requisitos para Android

- Node.js 22 o posterior y npm
- JDK 17
- Android Studio con Android SDK y Build Tools instalados

## Ejecutar en desarrollo

```bash
npm install --legacy-peer-deps
npm start
```

Para iniciar la aplicación Android desde el entorno de desarrollo:

```bash
npm run android
```

Se conserva Three.js 0.162 porque es la versión utilizada por la integración del modelo 3D; por eso la instalación usa `--legacy-peer-deps`.

## Crear un APK Android

En Windows, con JDK 17 y Android SDK configurados:

```powershell
npm install --legacy-peer-deps
npm run android:apk
```

El archivo resultante se guarda en `android/app/build/outputs/apk/release/app-release.apk`. La guía de compilación y firma está en [BUILDING_ANDROID.md](BUILDING_ANDROID.md).

## Datos y actualizaciones

Los datos se guardan en el almacenamiento privado de cada dispositivo; no se sincronizan con la nube. El identificador Android permanece como `com.porta.cozytimetracker` para mantener la continuidad con las instalaciones existentes. Para actualizar una instalación y conservar sus datos, el APK nuevo debe usar el mismo identificador y el mismo certificado de firma.

Las notificaciones locales no requieren cuenta ni conexión a Internet. Android puede pedir permiso para mostrarlas y algunos fabricantes pueden retrasar avisos debido a sus políticas de batería.

## Estructura del proyecto

- `src/`: pantallas, navegación, componentes y servicios de la aplicación.
- `assets/`: iconos, imágenes y modelos 3D.
- `android/`: proyecto nativo Android generado por Expo y ajustes de compilación.
- `scripts/build-apk.ps1`: script de Windows para compilar el APK.


# Build Android local

Requisitos en Windows: Node.js/npm, Android SDK (API 37; SDK Manager lo instala si falta) y JDK 17. El script mapea temporalmente el proyecto a una unidad corta y crea un alias de carpeta junto al proyecto para que CMake/Ninja no exceda el límite de rutas de Windows. Ambos alias se eliminan al terminar.

```powershell
npm install --legacy-peer-deps
npm run android:apk
```

El flag de npm conserva la versión de Three.js usada por el modelo 3D, aunque `expo-three` declare una versión peer más reciente.

El APK independiente queda en `android/app/build/outputs/apk/release/app-release.apk`. Incluye el bundle JavaScript y los recursos locales; no usa Expo Go ni Metro al ejecutarse. La base de datos SQLite sigue siendo privada y local a cada dispositivo.

El identificador estable es `com.porta.cozytimetracker`. La configuración generada soporta Android 7 (API 24) y posteriores. Para conservar datos durante una actualización, instalar sobre la versión anterior con el mismo identificador y certificado; no desinstalar antes.

El APK actual se firma con la clave debug local de Gradle y mantiene R8 desactivado mientras verificamos el arranque en dispositivos. Para distribuir una versión de producción con certificado propio, define `COZY_RELEASE_STORE_FILE`, `COZY_RELEASE_STORE_PASSWORD`, `COZY_RELEASE_KEY_ALIAS` y `COZY_RELEASE_KEY_PASSWORD` antes de ejecutar el mismo comando. Mantén esa clave y sus credenciales fuera del repositorio y usa el mismo certificado en futuras actualizaciones.

Al iniciar una sesión, la app solicita permiso para mostrar notificaciones y programa los avisos de descanso en Android. También programa el final del descanso y cancela los recordatorios pendientes al pausar o terminar. En Android 13 y posteriores, el usuario debe permitir las notificaciones; si las desactiva, los avisos solo aparecen dentro de la app. Android puede retrasar algunos avisos por las políticas de batería del fabricante.

Las sesiones y el contador se recuperan desde timestamps/SQLite cuando la app vuelve al primer plano. El proyecto incluye `expo-notifications`; las notificaciones locales no requieren servidor ni conexión a Internet.

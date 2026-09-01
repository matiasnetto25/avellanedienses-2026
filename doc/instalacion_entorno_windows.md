# Instalación del entorno de desarrollo (Windows)

Guía personal de instalación para poder desarrollar la app del TFI (Angular + Ionic + Capacitor + Android). El orden importa: cada herramienta depende de la anterior.

## 1. Node.js (LTS)

**Qué es y para qué sirve:** el motor que ejecuta JavaScript/TypeScript fuera del navegador. Angular CLI, Ionic CLI y todos los paquetes de `npm` corren sobre Node. Es la base de todo lo demás.

**Instalación (winget):**
```powershell
winget install OpenJS.NodeJS.LTS
```

**Verificar** (abrir una terminal nueva primero):
```powershell
node -v
npm -v
```

## 2. Git

**Qué es y para qué sirve:** control de versiones. Lo vas a usar para el repositorio privado del grupo en GitHub.

**Instalación (winget):**
```powershell
winget install Git.Git
```

**Verificar:**
```powershell
git --version
```

Configurar identidad (una sola vez):
```powershell
git config --global user.name "Tu Nombre"
git config --global user.email "tu-mail@ejemplo.com"
```

## 3. Angular CLI

**Qué es y para qué sirve:** la herramienta de línea de comandos de Angular (`ng generate`, `ng serve`). Ionic la usa por debajo. Requiere Node.js instalado.

**Instalación:**
```powershell
npm install -g @angular/cli
```

**Verificar:**
```powershell
ng version
```

## 4. Ionic CLI

**Qué es y para qué sirve:** crea el proyecto Ionic (con Angular + Capacitor integrados), sirve la app en el navegador para probar rápido, y sincroniza el código con los proyectos nativos.

**Instalación:**
```powershell
npm install -g @ionic/cli
```

**Verificar:**
```powershell
ionic --version
```

## 5. JDK 17 (Java Development Kit)

**Qué es y para qué sirve:** el sistema de compilación de Android (**Gradle**) corre sobre la JVM. No se escribe Java, pero Gradle lo necesita instalado para compilar el proyecto nativo Android.

**Instalación (winget — distribución Eclipse Temurin, gratuita):**
```powershell
winget install EclipseAdoptium.Temurin.17.JDK
```

**Alternativa manual:** descargar el instalador `.msi` (Windows x64) desde `adoptium.net/temurin/releases/?version=17`, ejecutarlo y tildar "Set JAVA_HOME variable" si el asistente lo ofrece.

**Verificar** (terminal nueva):
```powershell
java -version
javac -version
```

## 6. Android Studio

**Qué es y para qué sirve:** el IDE oficial de Android. Instala de una el **Android SDK** (las APIs de Android contra las que se compila), **Platform Tools** (incluye `adb`, para hablar con el celular por USB), **Gradle** y el **emulador** (AVD Manager). Sin esto no hay forma de generar un APK.

**Instalación (winget):**
```powershell
winget install Google.AndroidStudio
```

**Alternativa manual:** descargar desde `developer.android.com/studio`.

**Configuración inicial (manual, requiere abrir el programa):**
1. Abrir Android Studio y completar el asistente de bienvenida eligiendo instalación **"Standard"** — descarga el SDK, el emulador y una imagen de sistema por defecto.
2. `More Actions → SDK Manager`: confirmar que haya al menos una versión reciente de Android marcada (ej. Android 14, API 34) junto con "Android SDK Build-Tools".
3. `More Actions → Virtual Device Manager → Create Device`: elegir un dispositivo (ej. Pixel 6), descargar una imagen de sistema y finalizar. Esto crea el emulador.
4. `Settings → Languages & Frameworks → Android SDK`: copiar el valor de "Android SDK Location" — es la ruta que va en `ANDROID_HOME` (paso 7).

> Este paso 6 tiene una parte que no se puede automatizar por terminal: el asistente de bienvenida y el SDK Manager son ventanas gráficas que hay que completar a mano la primera vez.

## 7. Variables de entorno

Windows necesita saber dónde quedaron instalados el JDK y el SDK de Android.

- `JAVA_HOME` → carpeta de instalación del JDK 17 (ej. `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`)
- `ANDROID_HOME` → carpeta del SDK (ej. `C:\Users\<usuario>\AppData\Local\Android\Sdk`)
- Agregar al `PATH`: `%ANDROID_HOME%\platform-tools` y `%ANDROID_HOME%\tools`

Se configuran en **Variables de entorno del sistema** (buscar "variables de entorno" en el menú de inicio) o por PowerShell (ver sección de instalación automática más abajo).

> Si `npx cap sync android` o Android Studio no encuentran el SDK, casi siempre es esto.

## 8. VS Code

Ya lo usás. Sumar las extensiones:
- **Angular Language Service**
- **Ionic** (autocompletado de componentes `ion-*`)

## 9. Celular Android con Depuración USB

`Ajustes → Acerca del teléfono` → tocar 7 veces "Número de compilación" para activar "Opciones de desarrollador" → dentro, activar "Depuración USB". Necesario para probar la app en tu dispositivo real.

## Checklist final

- [x] `node -v` y `npm -v` responden — v22.17.0 / 10.9.2 (ya estaba instalado)
- [x] `git --version` responde — 2.42.0 (ya estaba instalado)
- [x] `ng version` responde — Angular CLI 21.2.22 (instalado)
- [x] `ionic --version` responde — 7.2.1 (instalado)
- [x] `java -version` muestra `17.x` — Temurin 17.0.20.1 instalado en `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot`
- [x] `JAVA_HOME` configurado (variable de usuario) → apunta al JDK 17 de arriba
- [x] Android Studio instalado en `C:\Program Files\Android\Android Studio`
- [ ] **Pendiente (manual, es un asistente gráfico):** abrir Android Studio por primera vez y completar el asistente de bienvenida ("Standard") — ahí se descarga el SDK y queda disponible `ANDROID_HOME`
- [ ] **Pendiente (manual):** crear un emulador en `More Actions → Virtual Device Manager → Create Device`
- [ ] **Pendiente (manual):** una vez creado el SDK, setear `ANDROID_HOME` (ver comando abajo)
- [ ] Depuración USB activada en el celular

### Cómo terminar los pasos pendientes

1. Abrir Android Studio (buscarlo en el menú de Inicio) y seguir el asistente eligiendo **"Standard"**. Va a descargar el SDK (puede tardar varios minutos).
2. Cuando termine, confirmar la ruta del SDK en `Settings → Languages & Frameworks → Android SDK` (normalmente `C:\Users\<tu usuario>\AppData\Local\Android\Sdk`).
3. Setear `ANDROID_HOME` en PowerShell (ajustar `<usuario>` si hace falta):
   ```powershell
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   [Environment]::SetEnvironmentVariable(
     "Path",
     [Environment]::GetEnvironmentVariable("Path","User") + ";$env:LOCALAPPDATA\Android\Sdk\platform-tools",
     "User"
   )
   ```
4. Cerrar y volver a abrir la terminal para que las variables nuevas (`JAVA_HOME`, `ANDROID_HOME`, `PATH`) se apliquen. Verificar con `echo $env:JAVA_HOME` y `echo $env:ANDROID_HOME`.
5. Crear el emulador desde `More Actions → Virtual Device Manager → Create Device` dentro de Android Studio.

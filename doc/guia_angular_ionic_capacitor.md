# Guía: Angular, Ionic, Capacitor y Android Studio

> Versión visual (recomendada para el equipo): https://claude.ai/code/artifact/a47b4bd1-7ec5-49e8-b0fe-bd827799fe63

Resumen de la guía interactiva, para tenerlo también como texto plano en el repo.

## 1. Qué instalar (en orden)
1. **Node.js LTS** — motor que corre Node/npm, Angular CLI e Ionic CLI.
2. **Git** — ya lo usan para el repo del grupo.
3. **Angular CLI** (`npm install -g @angular/cli`).
4. **Ionic CLI** (`npm install -g @ionic/cli`) — crea el proyecto, agrega Capacitor, sirve/sincroniza.
5. **JDK 17** — necesario porque Gradle (build system de Android) corre sobre la JVM.
   - Windows + winget: `winget install EclipseAdoptium.Temurin.17.JDK`
   - Manual: instalador `.msi` desde `adoptium.net/temurin/releases/?version=17`, tildando "Set JAVA_HOME variable" si el asistente lo ofrece.
   - Verificar: `java -version` / `javac -version` (abrir una terminal nueva antes).
6. **Android Studio** — trae el Android SDK, Platform Tools (`adb`), Gradle y el emulador (AVD Manager).
   - Descargar desde `developer.android.com/studio` e instalar con el modo **"Standard"**.
   - Abrir `More Actions → SDK Manager` y confirmar una versión reciente de Android (ej. API 34) + Build-Tools.
   - Crear un emulador en `More Actions → Virtual Device Manager → Create Device`.
   - Anotar la ruta del SDK en `Settings → Languages & Frameworks → Android SDK` (va a `ANDROID_HOME`).
7. **Variables de entorno**: `JAVA_HOME` y `ANDROID_HOME` apuntando a las instalaciones, más `platform-tools` en el `PATH`.
8. **VS Code** con extensiones Angular Language Service e Ionic.
9. **Celular Android con Depuración USB activada** (Opciones de desarrollador) — los 4 integrantes lo necesitan para las demos.

**Tip del TFI:** el trabajo prohíbe el modo oscuro. Ionic activa un bloque `@media (prefers-color-scheme: dark)` en `variables.scss` por defecto — hay que sacarlo apenas se crea el proyecto.

## 2. Inicializar el proyecto con todo lo necesario

```bash
# 1. Crear el proyecto (Angular + Ionic, con Capacitor integrado)
ionic start restaurant-app tabs --type=angular
cd restaurant-app

# 2. Agregar la plataforma Android (crea la carpeta /android)
npx cap add android

# 3. Backend
npm install @supabase/supabase-js

# 4. Plugins nativos que este TFI va a necesitar
npm install @capacitor/camera            # fotos (empleados, platos, bebidas, mesas)
npm install @capacitor/geolocation       # mapas para delivery (3ra entrega)
npm install @capacitor/push-notifications
npm install @capacitor/haptics           # vibración en errores (excluyente)
npm install @capacitor/motion            # acelerómetro/giroscopio (punto 31)
npm install @capacitor/preferences       # guardar sesión en el dispositivo
npm install @capacitor/filesystem @capacitor/share  # facturas en PDF

# Leer QR (usa cámara -> plugin nativo)
npm install @capacitor-mlkit/barcode-scanning
# Generar QR (solo dibuja una imagen -> librería JS, no es nativo)
npm install qrcode

# 5. Sincronizar con el proyecto nativo (repetir tras instalar cada plugin)
ionic build
npx cap sync android

# 6. Conectar el repo del grupo (ionic start ya corrió git init + primer commit)
git remote add origin https://github.com/<usuario-lider>/grupo-2026.git
git branch -M main
git push -u origin main

# cada integrante en su propia rama, nombrada por funcionalidad
git checkout -b feature/alta-empleado
```

## 3. Cómo se reparten el trabajo Angular / Ionic / Capacitor
- **Angular** = lógica y estructura: componentes, servicios, routing, forms, HttpClient/RxJS. Lo que ya conocen, sin cambios.
- **Ionic** = componentes de UI mobile (`ion-header`, `ion-list`, `ion-modal`, etc.) usados **dentro** de los templates de Angular, más su CLI (`ionic serve`, `ionic build`). No compite con Angular, se apoya en él.
- **Capacitor** = el puente hacia lo nativo. Empaqueta el build web (HTML/CSS/JS) dentro de un proyecto Android real (carpeta `/android`, WebView) y expone plugins TypeScript (`@capacitor/camera`, `geolocation`, `push-notifications`) que llaman código nativo por debajo. Se usan como funciones async normales desde Angular.

**Flujo de comandos:**
```
código (VS Code) → ionic build → carpeta www/
                  → npx cap sync android → proyecto /android actualizado
                  → npx cap open android → Android Studio
                  → Gradle compila → APK / emulador / celular
```

## 4. Para qué sirve Android Studio
Es el panel de control de la capa nativa (`/android`), no un reemplazo de VS Code. Se usa para:
- Emulador Android (AVD Manager).
- **Logcat**: logs nativos en tiempo real (clave para depurar plugins que fallan — cámara, permisos).
- Declarar/revisar permisos en `AndroidManifest.xml`.
- Generar el APK/AAB firmado (necesario para que los 4 dispositivos tengan la misma versión en cada entrega).
- Ajustar íconos/splash screens por densidad de pantalla si el generador automático no alcanza.

No hace falta escribir Java/Kotlin: todo lo que pide este TFI (cámara, QR, geolocalización, push, vibración, acelerómetro) ya existe como plugin oficial de Capacitor.

## 5. Chuleta de comandos
```bash
# Crear el proyecto (una vez)
ionic start restaurant-app tabs --type=angular
cd restaurant-app
ionic build
npx cap add android

# Desarrollo rápido en navegador (sin plugins nativos)
ionic serve

# Probar en celular/emulador con recarga en vivo
ionic cap run android -l --external

# Después de instalar un plugin o tocar config nativa
ionic build
npx cap sync android
npx cap open android
```

## 6. Un mismo componente, dos mundos: Angular puro vs. Ionic

**Versión A — Angular puro** (corre en cualquier navegador, no sabe que existe un celular):

```typescript
// plato-card.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-plato-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plato-card.component.html',
  styleUrls: ['./plato-card.component.scss']
})
export class PlatoCardComponent {
  @Input() nombre = '';
  @Input() descripcion = '';
  @Input() precio = 0;
  @Input() imagenUrl = '';
  cantidad = 0;
  agregar() { this.cantidad++; }
}
```
```html
<!-- plato-card.component.html -->
<div class="card">
  <img [src]="imagenUrl" [alt]="nombre" class="card-img" />
  <div class="card-body">
    <h3>{{ nombre }}</h3>
    <p>{{ descripcion }}</p>
    <div class="card-footer">
      <span class="precio">${{ precio }}</span>
      <button (click)="agregar()">Agregar ({{ cantidad }})</button>
    </div>
  </div>
</div>
```

**Versión B — con Ionic, pensada para Android** (mismo componente, con un toque de Capacitor):

```typescript
// plato-card.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonImg, IonButton, IonBadge, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Component({
  selector: 'app-plato-card',
  standalone: true,
  imports: [CommonModule, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonImg, IonButton, IonBadge, IonIcon],
  templateUrl: './plato-card.component.html',
  styleUrls: ['./plato-card.component.scss']
})
export class PlatoCardComponent {
  @Input() nombre = '';
  @Input() descripcion = '';
  @Input() precio = 0;
  @Input() imagenUrl = '';
  cantidad = 0;

  constructor() { addIcons({ addOutline }); }

  async agregar() {
    this.cantidad++;
    await Haptics.impact({ style: ImpactStyle.Light }); // vibración corta al tocar
  }
}
```
```html
<!-- plato-card.component.html -->
<ion-card>
  <ion-img [src]="imagenUrl" [alt]="nombre"></ion-img>
  <ion-card-header>
    <ion-card-title>{{ nombre }}</ion-card-title>
  </ion-card-header>
  <ion-card-content>
    <p>{{ descripcion }}</p>
    <div class="footer">
      <ion-badge color="tertiary">${{ precio }}</ion-badge>
      <ion-button (click)="agregar()">
        <ion-icon slot="start" name="add-outline"></ion-icon>
        Agregar ({{ cantidad }})
      </ion-button>
    </div>
  </ion-card-content>
</ion-card>
```

**Qué cambió:** la lógica TypeScript es prácticamente idéntica (sigue siendo un componente standalone de Angular con `@Input` y un método de click). Lo que cambia es el vocabulario del template (`ion-card`/`ion-button` en vez de `div`/`button`, con ripple y estilo nativo incluidos) y los colores, que ahora salen de la paleta global (`color="tertiary"`) en vez de hex hardcodeado. La única línea que de verdad toca hardware es `Haptics.impact()` — ni Angular ni Ionic saben vibrar el teléfono por su cuenta.

**La idea para quedarse:** lógica en Angular, presentación en Ionic, hardware en Capacitor. Ese patrón se repite en las 31 funcionalidades del TFI.

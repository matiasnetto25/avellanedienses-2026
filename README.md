# Trabajo Final Integrador — App de Restaurant
_Trabajo Final Integrador (TFI) de la Tecnicatura Universitaria en Programación (UTN Avellaneda) . App móvil de gestión para restaurante desarrollada en Angular, Ionic, Capacitor y Supabase_

**Grupo:** Avellanedienses  
**Año:** 2026  
**Repositorio:** `avellanedienses-2026`  

---

## 👥 Integrantes y Planificación de Tareas

De acuerdo con lo acordado por el equipo, el desarrollo, planificación e implementación de los requerimientos funcionales (Puntos 1 al 22 de la primera entrega) se realizarán de manera conjunta y transversal por todos los integrantes.

| Integrante (Orden Alfabético) | Módulos (Objetivos) a Desarrollar |
| :--- | :--- |
| **Netto, Matias** | Desarrollo Transversal (Planificación, UI/UX, Supabase, Frontend) | 
| **Oliveto, Agustin** | Desarrollo Transversal (Planificación, UI/UX, Supabase, Frontend) | 
| **Pascual, Christian** | Desarrollo Transversal (Planificación, UI/UX, Supabase, Frontend) |
| **Rodriguez, Thiago** | Desarrollo Transversal (Planificación, UI/UX, Supabase, Frontend) |

---

## 🌿 Modelo de Trabajo en Git (Git Branching)

Para coordinar el desarrollo sin pisar el trabajo de otros compañeros y mantener un historial limpio, utilizaremos un **flujo de trabajo Git Flow simplificado**:

### Ramas Principales
*   **`main`**: Contiene únicamente las versiones estables y aprobadas entregadas a la cátedra (producción). Nadie comitea directamente a `main`.
*   **`dev`**: Rama central de integración. Todos los desarrollos terminados se fusionan aquí. Es la rama base de donde parte el equipo para probar la app en conjunto.

### Ramas de Funcionalidad (Feature Branches)
Por cada punto funcional de la consigna o tarea específica, se creará una rama temporal que nacerá de `develop` y se nombrará según la funcionalidad, **no por persona**:
*   *Formato:* `feature/[nombre-de-la-funcionalidad]` (ej. `feature/alta-plato`, `feature/ingreso-anonimo`, `feature/encuesta-cliente`).
*   Una vez terminada y testeada la tarea en el dispositivo/emulador, se abre un **Pull Request (PR)** hacia `develop`. Al menos otro integrante del equipo debe revisar el código antes de aprobar la fusión (`merge`).

---

## 📷 Índice de Imágenes del Proyecto

*(Las capturas se actualizarán dinámicamente a medida que se completen las pantallas).*

### 🎨 Identidad Visual y Splash Screens
* **Ícono de la aplicación:**
  ![Ícono de la app](restaurant-app/src/assets/icon/icon.png)
  *(Imagen del ícono fuente. Falta reemplazar por una captura real del launcher en dispositivo/emulador — ver tarea 13 de [`planning/2-icono-de-app.md`](planning/2-icono-de-app.md)).*
* **Splash Screen Estática:**
  *[Pendiente captura]*
* **Splash Screen Animada:**
  *[Pendiente captura]*

### 📱 Formularios y Vistas (Primera Fecha)
* **Alta de Empleado (Dueño/Supervisor):** *[Pendiente captura]*
* **Alta de Plato (Cocinero):** *[Pendiente captura]*
* **Alta de Bebida (Cantinero):** *[Pendiente captura]*
* **Alta de Mesa (Dueño/Supervisor):** *[Pendiente captura]*
* **Alta de Cliente Registrado:** *[Pendiente captura]*
* **Listado de Clientes Pendientes de Aprobación:** *[Pendiente captura]*
* **Lista de Espera (Metre):** *[Pendiente captura]*
* **Menú y Chat con el Mozo (Cliente):** *[Pendiente captura]*
* **Detalle del Pedido e Interfaces de Cocina/Bar:** *[Pendiente captura]*
* **Juegos y Encuesta de Satisfacción:** *[Pendiente captura]*
* **Solicitud de Cuenta y Confirmación de Pago:** *[Pendiente captura]*

## 🏁 Códigos QR para Pruebas (Excluyente)

*(QRs pendientes de generación de imágenes en el proyecto).*

### 1. QR de Ingreso al Local (Lista de Espera)
![QR de Ingreso](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-entrada.jpg)

### 2. QRs de Mesas (5 Mesas Precargadas)
| Mesa 1 (Común) | Mesa 2 (VIP) | Mesa 3 (Mov. Reducida) | Mesa 4 (Común) | Mesa 5 (VIP) |
| :---: | :---: | :---: | :---: | :---: |
| ![Mesa 1]([https://placehold.co/120x120?text=Mesa+1](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-6a094fc0-e2ca-44a3-9b71-8484e95b0d11.png)) | ![Mesa 2]([https://placehold.co/120x120?text=Mesa+2](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-0fd66daf-f2e2-4ffc-9e9e-59831f216ed2.png)) | ![Mesa 3]([https://placehold.co/120x120?text=Mesa+3](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-f5b72354-9b2f-4dce-af1f-7ca83bae8b26.png)) | ![Mesa 4](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-6ca9bb57-80b4-40d6-8265-f58e9b21d63e.png) | ![Mesa 5]([https://placehold.co/120x120?text=Mesa+5](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-7a788f74-36f2-43fd-9cc8-86f242aeb505.png)) |

### 3. QRs de Propina (Nivel de Satisfacción)
| Excelente (20%) | Muy Bueno (15%) | Bueno (10%) | Regular (5%) | Malo (0%) |
| :---: | :---: | :---: | :---: | :---: |
| ![Excelente 20%](https://placehold.co/120x120?text=Excelente+20%25) | ![Muy Bueno 15%](https://placehold.co/120x120?text=Muy+Bueno+15%25) | ![Bueno 10%](https://placehold.co/120x120?text=Bueno+10%25) | ![Regular 5%](https://placehold.co/120x120?text=Regular+5%25) | ![Malo 0%](https://placehold.co/120x120?text=Malo+0%25) |

---

## 🛠️ Stack Tecnológico
* **Frontend:** Angular + Ionic (Standalone Components)
* **Backend & Realtime:** Supabase (PostgreSQL + RLS)
* **Hardware Bridge:** Capacitor
* **IDE Nativo:** Android Studio

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

Capturas tomadas en formato mobile (390 × 844, densidad 2x), recorriendo un flujo real de punta a punta: un cliente se anota en la lista de espera, el maître le asigna mesa, hace un pedido, consulta al mozo y el pedido llega a cocina y barra.

### Identidad visual y acceso
| Splash animada | Bienvenida | Login con ingreso rápido | Registro de cliente |
| :---: | :---: | :---: | :---: |
| <img src="doc/screenshots/01-splash-animada.png" width="230" alt="Splash animada"> | <img src="doc/screenshots/02-bienvenida.png" width="230" alt="Bienvenida"> | <img src="doc/screenshots/03-login.png" width="230" alt="Login con ingreso rápido"> | <img src="doc/screenshots/04-registro-cliente.png" width="230" alt="Registro de cliente"> |

**Ícono de la aplicación:**

<img src="restaurant-app/src/assets/icon/icon.png" width="96" alt="Ícono de la app">

### Administración (Dueño / Supervisor)
| Ahora: clientes por aprobar | Usuarios | Alta de empleado |
| :---: | :---: | :---: |
| <img src="doc/screenshots/05-admin-ahora.png" width="230" alt="Ahora: clientes por aprobar"> | <img src="doc/screenshots/06-admin-usuarios.png" width="230" alt="Usuarios"> | <img src="doc/screenshots/07-admin-alta-empleado.png" width="230" alt="Alta de empleado"> |

| Mesas del salón | Alta de mesa |
| :---: | :---: |
| <img src="doc/screenshots/08-admin-mesas.png" width="230" alt="Mesas del salón"> | <img src="doc/screenshots/09-admin-alta-mesa.png" width="230" alt="Alta de mesa"> |

### Maître
| Lista de espera | Asignar mesa |
| :---: | :---: |
| <img src="doc/screenshots/10-metre-lista-espera.png" width="230" alt="Lista de espera"> | <img src="doc/screenshots/11-metre-asignar-mesa.png" width="230" alt="Asignar mesa"> |

### Mozo
| Ahora: resumen del turno | Pedidos por confirmar | Consultas de las mesas |
| :---: | :---: | :---: |
| <img src="doc/screenshots/12-mozo-ahora.png" width="230" alt="Ahora: resumen del turno"> | <img src="doc/screenshots/13-mozo-pedidos.png" width="230" alt="Pedidos por confirmar"> | <img src="doc/screenshots/14-mozo-consultas.png" width="230" alt="Consultas de las mesas"> |

### Cocina y Cantina
| Cocina: comandas | Cocina: platos | Alta de plato | Cantina: bebidas |
| :---: | :---: | :---: | :---: |
| <img src="doc/screenshots/15-cocina-ahora.png" width="230" alt="Cocina: comandas"> | <img src="doc/screenshots/16-cocina-platos.png" width="230" alt="Cocina: platos"> | <img src="doc/screenshots/17-cocina-alta-plato.png" width="230" alt="Alta de plato"> | <img src="doc/screenshots/18-cantina-bebidas.png" width="230" alt="Cantina: bebidas"> |

### Cliente
| En lista de espera | Mi mesa | Menú con total y demora |
| :---: | :---: | :---: |
| <img src="doc/screenshots/19-cliente-inicio-espera.png" width="230" alt="En lista de espera"> | <img src="doc/screenshots/19b-cliente-mi-mesa.png" width="230" alt="Mi mesa"> | <img src="doc/screenshots/20-cliente-menu.png" width="230" alt="Menú con total y demora"> |

| Estado del pedido | Chat con el mozo |
| :---: | :---: |
| <img src="doc/screenshots/21-cliente-estado-pedido.png" width="230" alt="Estado del pedido"> | <img src="doc/screenshots/22-cliente-chat.png" width="230" alt="Chat con el mozo"> |

## 🏁 Códigos QR para Pruebas (Excluyente)

*(QRs pendientes de generación de imágenes en el proyecto).*

### 1. QR de Ingreso al Local (Lista de Espera)
![QR de Ingreso](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-entrada.jpg)

### 2. QRs de Mesas (5 Mesas Precargadas)
| Mesa 1 (Mov. Reducida) | Mesa 2 (Estándar) | Mesa 3 (Estándar) | Mesa 4 (VIP) | Mesa 5 (VIP) |
| :---: | :---: | :---: | :---: | :---: |
| ![Mesa 1](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-6a094fc0-e2ca-44a3-9b71-8484e95b0d11.png) | ![Mesa 2](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-0fd66daf-f2e2-4ffc-9e9e-59831f216ed2.png) | ![Mesa 3](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-f5b72354-9b2f-4dce-af1f-7ca83bae8b26.png) | ![Mesa 4](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-6ca9bb57-80b4-40d6-8265-f58e9b21d63e.png) | ![Mesa 5](https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/qr_mesa/qr-7a788f74-36f2-43fd-9cc8-86f242aeb505.png)) |

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

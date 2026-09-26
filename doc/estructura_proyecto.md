# Estructura de carpetas del proyecto

> Propuesta de organización de `restaurant-app/src/app/` pensada para el alcance completo del TFI (31 puntos funcionales, 3 fechas de entrega) y para que 4 personas trabajen en paralelo sin pisarse el código. Definida en conjunto con el equipo.
>
> **Estado:** acordada con el equipo y aplicada a lo que ya existía en el código (`principal/` → `pages/principal/`, `shared/marca-header/` → `shared/components/marca-header/`, boilerplate de `tabs`/`tab1-3`/`explore-container` del starter de Ionic eliminado). Las carpetas de dominio que todavía no tienen ninguna funcionalidad implementada (`empleados/`, `productos/`, `mesas/`, etc.) no existen todavía en el código — se van creando a medida que se implementa cada una. No hace falta scaffolding de todas ahora.

## Por qué esta organización

El equipo trabaja con una rama por funcionalidad (`feature/<nombre>`, ver `README.md` y `planning/tareas/funcionalidades-1-22.md`), no una rama por persona. Organizar el código por **dominio de negocio** (`pedidos/`, `mesas/`, `productos/`, etc.) en vez de por **tipo de archivo** (todos los componentes juntos, todos los servicios juntos) hace que cada funcionalidad viva en su propia carpeta — así, dos personas trabajando en features distintas casi nunca tocan los mismos archivos, y los merges quedan más simples.

`core/` y `shared/` quedan reservados para lo que de verdad usan **dos o más** dominios. Si un servicio, modelo o componente lo usa una sola feature, vive adentro de la carpeta de esa feature, no en `core/`.

## Árbol propuesto

```
src/app/
├── core/                            # Singletons sin UI propia
│   ├── guards/
│   │   ├── auth.guard.ts                    # spec 6
│   │   └── perfil.guard.ts                  # opcional: restringe rutas por perfil
│   ├── models/                      # Interfaces que reflejan las tablas de Supabase
│   │   ├── usuario.model.ts
│   │   ├── plato.model.ts
│   │   ├── mesa.model.ts
│   │   ├── pedido.model.ts
│   │   └── ...
│   ├── services/                    # Acceso a datos / hardware transversal a varios dominios
│   │   ├── auth.service.ts                  # spec 6 (a recrear — ver planning/4-formulario-login.md)
│   │   ├── supabase.service.ts              # cliente único de supabase-js
│   │   ├── qr.service.ts                    # generar (qrcode) + leer (mlkit) — lo usan mesas, clientes, pedidos, cuenta
│   │   ├── notificaciones.service.ts        # @capacitor/push-notifications
│   │   ├── correo.service.ts                # envío de mails automáticos
│   │   └── haptics.service.ts               # wrapper de @capacitor/haptics (vibrar en error, requisito transversal)
│   ├── identidad-app.ts             # ya existe
│   └── usuarios-demo.ts             # ya existe
│
├── shared/                          # UI reutilizable, sin lógica de negocio de ningún dominio
│   ├── components/
│   │   ├── marca-header/                    # ya existe
│   │   ├── spinner-marca/                   # spinner con logo (requisito transversal, todas las esperas)
│   │   ├── grafico/                         # torta/barra/línea — lo reusan encuestas y cuenta
│   │   └── carrusel-imagenes/               # las 3 fotos de plato/bebida en contenedores individuales
│   ├── pipes/
│   └── directives/
│
├── pages/                           # Un subfolder por dominio del backlog
│   ├── auth/                                # ya existe
│   │   ├── bienvenida/
│   │   ├── login/
│   │   └── registro/                        # punto 5 — destino real del botón "Registrarse"
│   ├── principal/                           # ya existe (placeholder post-login)
│   ├── empleados/                           # punto 1
│   ├── productos/
│   │   ├── platos/                          # punto 2
│   │   └── bebidas/                         # punto 3
│   ├── mesas/                                # puntos 4, 9, 10 (alta, lista de espera, asignación)
│   ├── clientes/                             # puntos 6-8 (aprobar/rechazar, lado dueño-supervisor)
│   ├── pedidos/
│   │   ├── cliente/                          # puntos 11-12, 19, 21 (menú, armar pedido, entrega, cuenta)
│   │   ├── mozo/                             # puntos 11, 13-14, 18-19 (chat, confirmar/rechazar, entrega)
│   │   ├── cocina/                           # punto 16
│   │   └── bar/                              # punto 17
│   ├── juegos/                                # punto 15
│   ├── encuestas/                             # punto 20
│   ├── reservas/                              # puntos 24-26 (2ª/3ª fecha)
│   └── delivery/                              # puntos 27-30 (3ª fecha)
│
├── splash/                          # ya existe, sin cambios (spec 3)
├── theme/                           # ya existe (variables.scss — paleta y tipografías de marca)
├── environments/                    # ya existe (URL/key de Supabase)
├── app-routing.module.ts
├── app.module.ts
└── app.component.*
```

## Mapeo dominio → puntos del backlog

| Carpeta | Puntos del backlog | Perfil(es) principal(es) |
| --- | --- | --- |
| `pages/auth/` | login, bienvenida, punto 5 (registro) | todos / cliente |
| `pages/empleados/` | 1 | dueño, supervisor |
| `pages/productos/platos/` | 2 | cocinero |
| `pages/productos/bebidas/` | 3 | cantinero |
| `pages/mesas/` | 4, 9, 10 | dueño, supervisor, metre, cliente anónimo |
| `pages/clientes/` | 6, 7, 8 | dueño, supervisor |
| `pages/pedidos/cliente/` | 11, 12, 19, 21 | cliente |
| `pages/pedidos/mozo/` | 11, 13, 14, 18, 19 | mozo |
| `pages/pedidos/cocina/` | 16 | cocinero |
| `pages/pedidos/bar/` | 17 | cantinero |
| `pages/juegos/` | 15 | cliente registrado |
| `pages/encuestas/` | 20, parte de 22 (gráficos) | cliente |
| `pages/reservas/` | 24, 25, 26 | cliente registrado, dueño, supervisor |
| `pages/delivery/` | 27, 28, 29, 30 | cliente registrado, dueño/supervisor, repartidor |

`pedidos/` es, por lejos, el dominio más grande (puntos 11 a 19) y el que más gente va a tocar en paralelo — por eso está subdividido por perfil en vez de dejarlo plano.

## Convenciones

- Una página = una carpeta con `<nombre>.page.ts` + `.html` + `.scss` (ya establecido desde `splash/` y `pages/auth/`).
- Si un servicio, modelo o componente lo usa **una sola** feature, vive adentro de esa carpeta de `pages/<dominio>/...` — no en `core/`. `core/` es solo para lo compartido por 2 o más dominios.
- Nombrado de ramas: `feature/<dominio>-<acción>`, alineado a la carpeta que toca (ej. `feature/mesas-alta`, `feature/pedidos-cocina`), consistente con `planning/tareas/funcionalidades-1-22.md`.
- Componentes/páginas standalone (no `NgModule` por feature), con `inject()` en vez de inyección por constructor y `@for`/`@if` en vez de `*ngFor`/`*ngIf` (lint del proyecto: `@angular-eslint/prefer-inject`, `@angular-eslint/template/prefer-control-flow` — correr `npx ng lint` antes de dar por terminada una página).
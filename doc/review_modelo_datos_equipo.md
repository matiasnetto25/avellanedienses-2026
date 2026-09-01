# Review del modelo de datos del equipo (alcance: puntos 1 a 22)

Repaso campo por campo contra lo que piden los puntos 1-22 de la consigna. Ordenado por impacto: primero lo que bloquea o rompe un requisito, después mejoras menores, al final lo que está bien.

## Resumen ejecutivo

Hay 3 huecos estructurales que conviene resolver antes de seguir cargando pantallas, porque todo lo demás (pagos, encuesta, juegos, mensajería) depende de ellos:

1. **Al `Cliente.Estado` le falta el valor "pendiente"** — sin él, el flujo de aprobación (puntos 5-8) no se puede representar.
2. **No existe un "Pedido" como cabecera** — `Comandas` es en realidad una línea de producto, no el pedido completo. Los puntos 12/13/14 tratan al pedido como una unidad (importe acumulado, rechazo/confirmación de todo junto).
3. **No existe el concepto de "estadía" (una visita puntual a una mesa)** — la mesa se reutiliza en el tiempo, y sin algo que delimite "esta visita" no hay forma prolija de saber qué comandas, qué pago, qué encuesta y qué partida de juego pertenecen a la misma pasada por el restaurante. Esto ya se nota en el propio diseño: tanto `Partidas` como `Comandas` intentan resolverlo con una consulta SQL ("traer la fecha más antigua") en vez de una relación — es la señal más clara de que falta una entidad ahí.

## 🔴 Problemas que bloquean requisitos (corregir primero)

### 1. `Cliente.Estado` no tiene un estado "pendiente"
Valores actuales: `APROBADO-RECHAZADO-GENERICO`. El punto 5 dice explícitamente: *"una vez ingresado todos los datos del cliente, el registro estará con estado 'pendiente de aprobación'"*, y el punto 6/7/8 dependen de que ese estado exista para que dueño/supervisor lo vean en un listado y lo aprueben o rechacen. Sin un cuarto valor `PENDIENTE`, no hay forma de distinguir "recién registrado, esperando aprobación" de "aprobado" o "rechazado".

**Cambio:** `Estado: PENDIENTE - APROBADO - RECHAZADO - ANONIMO` (renombraría `GENERICO` a `ANONIMO`, se entiende más directo si es para el cliente anónimo).

También conviene que `Email`, `Contraseña`, `DNI` y `FechaNacimiento` sean **nullable**: el cliente anónimo (punto 9) solo carga nombre y foto.

### 2. Falta una entidad "Pedido" (cabecera) separada de `Comandas` (línea de producto)
`Comandas` tiene un producto + cantidad por fila, con mesa/mozo/cliente repetidos en cada línea. Pero el punto 12 pide:
- ver el **importe acumulado** de todo el pedido en todo momento,
- ver el **tiempo total estimado** de todo el pedido,
- que el cliente "termine" el pedido como una unidad y espere **una** confirmación del mozo.

Y el punto 13 pide que el mozo **rechace el pedido completo** (no una línea suelta) para que el cliente lo modifique. Sin una fila que represente "el pedido" como conjunto, agrupar y confirmar/rechazar todo junto depende de que todas las líneas compartan exactamente el mismo timestamp de inicio — fragil, y no hay dónde guardar el estado del pedido en su conjunto (confirmado/rechazado ya no es un atributo de una línea, es del pedido entero).

**Cambio sugerido:** agregar `Pedido` (cabecera) y dejar `Comandas` como el detalle:

```
Pedido
•  ID_pedido
•  ID_mesa
•  ID_cliente
•  ID_mozo (null hasta que un mozo lo toma)
•  Estado (armando-pendiente_confirmacion-rechazado-confirmado-listo-entregado)
•  Tiempo_estimado_total   -> MAX(demora) de sus Comandas, no la suma (los platos se cocinan en simultáneo)
•  Fecha_creacion
•  Fecha_confirmacion

Comandas (ahora "detalle de pedido")
•  ID_comanda
•  ID_pedido      <- NUEVO: a qué pedido pertenece
•  ID_producto    <- antes "ID-Preparacion => menu"
•  Cantidad
•  Precio_unitario  <- guardar el precio del Menu EN ESE MOMENTO (ver nota de snapshot más abajo)
•  Estado (pendiente-en_preparacion-listo)   <- por sector, ver problema #6
```

El importe acumulado y el tiempo total dejan de ser un cálculo ambiguo y pasan a ser un `SUM`/`MAX` agrupado por `ID_pedido`.

### 3. Falta el concepto de "estadía" (una visita a una mesa)
La mesa es un recurso que se reutiliza: hoy le sirve a un cliente, mañana a otro. Sin algo que diga "esto es UNA visita puntual", quedan sin ancla:

- **Punto 15**: el descuento de los juegos es "no acumulativo" — no acumulativo, ¿respecto a qué? A la visita actual. Sin ese límite, un cliente que vuelve la semana que viene ya no debería poder reusar el descuento de la vez pasada, pero el modelo no tiene forma de distinguirlo.
- **Punto 20**: la encuesta es "una por estadía". `Encuesta.ID-comanda` no alcanza para esto: como ahora una comanda es una línea de producto (o, incluso corrigiendo el punto 2, un pedido puede repetirse varias veces en una misma visita), no hay una sola fila que represente "esta visita completa" contra la cual poner el límite de una encuesta.
- **`Partidas.ID-comanda`** ya lo dice con la propia anotación del equipo: *"SQL CONSULTA (de ID comanda traer la fecha con hora más antigua)"*. Necesitar una consulta para reconstruir "cuál es el pedido/visita actual" es la señal de que falta una tabla ahí — si existiera `Estadia`, sería directamente `Partidas.ID_estadia`, sin subconsultas.

**Cambio sugerido:** agregar una tabla chica:

```
Estadia
•  ID_estadia
•  ID_cliente
•  ID_mesa
•  Fecha_hora_inicio   (cuando el metre asigna la mesa)
•  Fecha_hora_fin       (cuando se libera, punto 22)
•  Estado (en_mesa-cuenta_solicitada-pagada)
```

Y `Pedido`, `Pagos`, `Encuesta` y `Partidas` pasan a referenciar `ID_estadia` en vez de `ID_mesa`/`ID_comanda` sueltos. Esto además simplifica `Lista_espera`: cuando el metre asigna la mesa, esa fila de espera puede pasar a `Estado=OK` y ahí mismo se crea la `Estadia` correspondiente.

## 🟠 Bugs concretos de modelado (no bloquean el requisito, pero rompen la integridad de los datos)

### 4. `Mensajeria.ID-remitente => "clientes y empleados"` no es una relación válida
Una columna de FK solo puede apuntar a **una** tabla. Tal como está escrito, no hay forma de poner una foreign key real ahí — hoy, técnicamente, nada impide guardar un ID que no corresponde a nadie. Además, a la tabla le falta con qué mesa/estadía está asociado cada mensaje: el punto 11 pide que la consulta le llegue **a todos los mozos** y que la respuesta vuelva **al cliente correcto** — sin saber de qué mesa es el mensaje, no hay forma de rutear la respuesta.

**Dos formas válidas de resolverlo, elegir una:**
- **(a)** Agregar dos columnas nullable: `ID_remitente_empleado` y `ID_remitente_cliente`, con la regla de que solo una de las dos tiene valor por fila.
- **(b)** Unificar `Employee` y `Cliente` en una sola tabla de identidad con un campo `Rol`, y ahí sí `ID_remitente` apunta siempre al mismo lugar. Esto también resolvería de raíz cualquier otro campo "quién hizo esto" que en el futuro necesite ser empleado O cliente.

Cualquiera de las dos está bien — lo que no se puede dejar es la versión actual, sin mecanismo.

Sumar también: `ID_mesa` (o `ID_estadia`, una vez que exista) en `Mensajeria`.

### 5. `Pagos` tiene la relación con `Comandas` duplicada y contradictoria
`Comandas` ya tiene `id_pago` (varias comandas → un pago, correcto: un pago cubre todo el consumo de la mesa). Pero `Pagos` **también** tiene `ID-comanda` (singular), que dice lo contrario: un pago → una sola comanda. Son dos formas de expresar la misma relación, apuntando en direcciones distintas. Sacar `Pagos.ID-comanda` — con `Comandas.id_pago` alcanza (y una vez que exista `Pedido`, mejor todavía: `Pagos.ID_estadia`).

`ID-DESCUENTO_comanda` en `Pagos` apunta a una entidad "Descuento" que no está definida en ningún lado del modelo, y además `Pagos` ya tiene una columna `Descuento` con el valor. Sacar el FK fantasma; si el descuento viene de haber ganado un juego, referenciar directamente `Partidas` (`ID_partida`), y de ahí sale el porcentaje.

### 6. Nombre de columna repetido con dos significados distintos en `Comandas`
Aparece `ID-Preparacion` dos veces:
- una vez como FK al `Menu` ("ID-Preparacion => menu"),
- otra vez como FK a `Empleados` ("Id-preparacion => Empleados, quien te prepara el pedido").

Son dos cosas completamente distintas con el mismo nombre — en una base real esto no compila (no se puede repetir el nombre de columna), y en la documentación genera confusión inmediata sobre cuál es cuál. Renombrar: `ID_producto` (al Menu) y `ID_empleado_preparador` (al Empleado) — y ver el punto siguiente, porque esta segunda probablemente ya no hace falta si queda `Registro_preparacion`.

### 7. `Registro_preparacion` duplica lo que ya guarda `Comandas`
Ambas tablas dicen "quién prepara esto": `Comandas.Id-preparacion => Empleados` y `Registro_preparacion.ID-empleado-Responsable`. Si viven en dos lugares, nada garantiza que digan lo mismo (una se actualiza y la otra no). Elegir una sola fuente de verdad:
- Si alcanza con saber quién prepara y cuándo terminó, esos campos van directo en `Comandas` (ya tiene `Id-mozo`, sumar `ID_empleado_preparador` y una `Fecha_listo`) y se elimina `Registro_preparacion`.
- Si de verdad quieren un historial (por ejemplo, reasignar un plato a otro cocinero y guardar el cambio), entonces `Registro_preparacion` se queda pero `Comandas` deja de tener su propio campo de empleado — lo consulta a través de esta tabla.

Para los puntos 16-19 (cocina/bar reciben, marcan listo, mozo entrega) no hace falta el historial: alcanza con la primera opción, más simple.

### 8. A `Comandas.Estado` le faltan estados intermedios
Hoy: `en preparación - entregado - cancelado`. Pero la consigna necesita distinguir, como mínimo:
- **pendiente** (el cliente lo armó, esperando que el mozo confirme — punto 12),
- **rechazado** (el mozo lo devolvió para que se modifique — punto 13; no es lo mismo que "cancelado"),
- **en preparación** (confirmado, en cocina/bar),
- **listo** (el sector terminó pero el mozo todavía no lo entregó — puntos 18-19 son dos eventos distintos),
- **entregado**.

Sin `rechazado` y `listo` como estados propios, los puntos 13 y 18 no tienen dónde reflejarse.

## 🟡 Ajustes menores

- **`Juego` con `PuntajeDescuento10/15/20` en una sola fila**: funciona, pero es más indirecto de lo que pide la consigna ("desarrollar **tres** juegos... que permitan obtener 10%/15%/20%"). Más simple: una fila por juego, con una sola columna `Descuento_Porcentaje` (10, 15 o 20). Menos columnas, y `Partidas.Porcentaje-descuento` deja de necesitar un código `0/1/2/3` — pasa a ser directamente `Descuento_aplicado (sí/no)`, y el valor se lee del `Juego` jugado.
- **`Comandas.Precio = CANxPRECIO`**: buena práctica **si se calcula y se guarda en el momento del pedido** (snapshot). Si en cambio se recalcula después contra el precio actual del `Menu`, un cambio de precio de mañana modificaría el importe de un pedido de ayer. Asegurarse de que `Precio_unitario` quede grabado en la fila, no derivado en el momento de mostrarlo.
- **`Menu.Fotos (3)` como tres columnas fijas** (principal/cerca/contexto): es válido porque la consigna pide exactamente 3 fotos, no una cantidad variable. La única desventaja es en el código: no se puede recorrer con un `*ngFor`, hay que repetir la UI tres veces a mano. Aceptable para este alcance.
- **`Comandas.InicioPedido / PedidoEntregado / finPedido`**: si `PedidoEntregado` es "el sector lo terminó" y `finPedido` es "el mozo lo entregó en la mesa", la distinción es correcta (son los puntos 18 y 19), pero convendría nombrarlos más parecido a lo que significan, por ejemplo `Fecha_listo_sector` y `Fecha_entregado_mozo`, para que no haya que adivinar la diferencia releyendo la consigna.

## 🟢 Lo que está bien

- **Separar `Employee` y `Cliente` en dos tablas** es una decisión válida (no hace falta unificarlas): simplifica listados como "todos los mozos" o "clientes pendientes" sin tener que filtrar por rol dentro de una tabla más grande. El único costo es el problema #4 (`Mensajeria`) — el resto de las relaciones (`Comandas.Id-cliente`, `Comandas.Id-mozo`) ya están tipadas correctamente porque cada columna apunta siempre a una sola tabla.
- **`Employee` con DNI y CUIL, `Cliente` solo con DNI**: coincide exactamente con lo que pide la consigna en los puntos 1 y 5 respectivamente.
- **`Menu` unificando comida/bebida/postre con un campo `Tipo`**: evita duplicar la tabla para cada categoría y permite separar por sector (cocina/bar) filtrando por ese campo, que es justo lo que piden los puntos 16 y 17.
- **Pensar `Demora` como el máximo, no la suma, de los tiempos de elaboración**: es la interpretación correcta del punto 12 (los platos se preparan en simultáneo, no uno después del otro) — hoy está anotado a nivel de línea, pero la lógica en sí es la correcta; solo hay que moverla al nivel del pedido (ver problema #2).
- **`Lista_espera` con `Estado (en fila, ok, cancelado)`**: cubre bien los puntos 9-10, incluyendo el "eliminado del listado" que pide la consigna.

## Prioridad sugerida para corregir

1. Agregar estado `PENDIENTE` a `Cliente`.
2. Agregar `Pedido` como cabecera de `Comandas`.
3. Agregar `Estadia` y reconectar `Pagos`, `Encuesta` y `Partidas` a `ID_estadia`.
4. Resolver el FK polimórfico de `Mensajeria` y sumarle `ID_mesa`/`ID_estadia`.
5. Sacar el FK duplicado (`Pagos.ID-comanda`) y el FK fantasma (`ID-DESCUENTO_comanda`).
6. Renombrar la columna repetida en `Comandas` y decidir si `Registro_preparacion` se queda o se fusiona.
7. Completar los estados que le faltan a `Comandas.Estado`.

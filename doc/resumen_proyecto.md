# Resumen del Trabajo Final Integrador — App de Restaurant

> Documento de referencia rápida para el tutor y el equipo. Basado en `Trabajo práctico - 2026 - TFI.pdf` y la clase 01 del curso.

## Datos administrativos
- Grupo: 4 integrantes. Inscripción cerraba 29-08-2026 (asignación automática de sobrantes: 05-09-2026).
- Fechas de entrega:
  - 1ª: **17-10-2026**
  - 2ª: **07-11-2026**
  - 3ª: **28-11-2026**
- Repo privado en GitHub, nombre `grupo-2026`. README con: apellidos/nombres, módulos asignados, fecha inicio/fin de tarea, branch. Índice de TODAS las imágenes del proyecto. Mantenido por el líder.
- Revisiones semanales obligatorias con todo el grupo presente. Puntos aprobados necesarios: **14** para entrega definitiva en 1ª/2ª fecha, **23** para la 3ª fecha.
- Presentación: máx. 30 min, misma versión de app en todos los dispositivos.

## Stack sugerido por la cátedra
- **Ionic** (o framework equivalente) + **Capacitor**
- **Android Studio**
- **Supabase** (o similar) como backend/BD
- VS Code como editor sugerido

## Perfiles de usuario
- dueño, supervisor, empleados (metre, mozo, cocinero, cantinero), cliente registrado, cliente anónimo.
- Campos mínimos de usuario: apellidos, nombres, DNI/CUIL, correo, clave, perfil.
- Precarga mínima: 1 dueño, 1 supervisor, 1 metre, 1 mozo, 1 cocinero, 1 cantinero, 1 cliente registrado, 5 platos, 5 bebidas, 5 mesas. Simular ≥4 semanas de datos (encuestas, consumos, estadías) en la BD.

## Códigos QR requeridos
1. **QR de ingreso al local**: anuncia al cliente en lista de espera y da acceso a encuestas previas.
2. **QR de mesa**: contenido según perfil (staff ve nº/capacidad/tipo/disponibilidad; cliente ve menú, consultas al mozo, estado de pedido, encuesta, juegos, pago).
3. **QR de propina** (5 códigos, uno por nivel): Excelente 20% / Muy bueno 15% / Bueno 10% / Regular 5% / Malo 0%.
- Deben estar disponibles siempre (README y en pantalla).

## Requerimientos excluyentes transversales (1ª fecha, para promoción)
Splash screens estático+animado (ícono, nombre grupo, integrantes) · todo en español con tildes · sin `alert()`, usar controles propios para errores/info · sonidos distintos al abrir/cerrar · validación de TODOS los campos en TODOS los formularios · spinners con logo en TODAS las esperas · vibración en TODOS los errores · accesos rápidos por perfil (sin combos) · botón de cierre de sesión que borre credenciales · pantalla 100% ocupada (sin espacios neutros) · alto contraste, sin fondos blancos/negros ni modo oscuro · nada de texto/imagen cortado, descentrado o abreviado · encuestas con controles variados · push notifications (app abierta y cerrada) · envío automático de mails desde cuenta empresarial · lectura y generación de QR · 3 juegos simples funcionales · gráficos estadísticos (torta/barra/línea), uno por pantalla · puntos funcionales 1 a 22 completos.

## Funcionalidades por entrega

### 1ª fecha — puntos funcionales 1 a 22
1. Alta de empleado (dueño/supervisor) con foto de cámara + lector QR de DNI.
2. Alta de plato (cocinero), 3 fotos (cámara o galería).
3. Alta de bebida (cantinero), 3 fotos.
4. Alta de mesa (dueño/supervisor), genera QR automático, gestión de disponibilidad.
5. Alta de cliente registrado (cliente o metre), queda "pendiente de aprobación".
6-8. Aprobación/rechazo de cliente por dueño/supervisor, mail automático personalizado, bloqueo de acceso si rechazado.
9. Ingreso como cliente anónimo, escaneo QR de entrada, lista de espera.
10. Metre asigna mesa; cliente escanea QR de mesa; exclusividad mesa-cliente.
11. Menú visible desde QR de mesa; chat tipo WhatsApp cliente-mozos ("consulta al mozo").
12-14. Flujo de pedido: cliente arma pedido → mozo confirma/rechaza → derivación a cocina/bar.
15. Juegos con descuento (solo 1er intento gana descuento).
16-18. Cocina y bar reciben y gestionan pedidos agrupados por mesa; aviso cuando el pedido completo está listo.
19. Entrega del pedido y confirmación del cliente.
20. Encuesta de satisfacción (1 por estadía) + gráficos de resultados.
21. Pedido de cuenta: QR de propina obligatorio antes de cerrar cuenta; detalle estilo Mercado Pago.
22. Mozo confirma pago, libera mesa, notifica a dueño/supervisor.

### 2ª fecha — extras (requiere 1-22 completo)
- Login social (al menos una red).
- Factura en PDF (mail para cliente registrado, notificación+descarga para anónimo), cumpliendo formato de mails de 7/8.
- Ajustar flujo de punto 22 para incluir facturación.

### 3ª fecha — extras (requiere 1-23 completo)
- Mapas y sensores del dispositivo.
24-26. Reservas agendadas (solo clientes registrados, fecha futura), aprobación/rechazo por dueño/supervisor con mail, liberación de mesa a los 45 min si no se presenta.
27-29. Pedidos a domicilio: dirección por texto o mapa, aprobación por dueño/supervisor, repartidor con mapa/ruta y chat con cliente.
30. Entrega a domicilio + factura PDF por mail.
31. Uso de acelerómetro/giroscopio para navegar el menú (fotos y productos) por movimiento.

## Notas de arquitectura a tener en cuenta
- Multi-dispositivo/multi-rol probado en simultáneo (mínimo 4 dispositivos en las demos).
- Todo el estado (pedidos, mesas, lista de espera, encuestas) debe sincronizarse en tiempo real entre roles → pensar en Supabase Realtime o equivalente desde el día 1.
- Push notifications con app cerrada → requiere FCM u otro servicio compatible con Capacitor.
- Mails automáticos desde cuenta empresarial → servicio backend (Edge Function de Supabase, o similar) para no exponer credenciales en el cliente.

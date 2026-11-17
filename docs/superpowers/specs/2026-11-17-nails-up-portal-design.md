# Portal Nails Up: diseño

Fecha: 2026-11-17

## Intención
Nails Up es una boutique de diseño de uñas atendida por una sola persona (la dueña). Hoy las clientas llegan por WhatsApp y Facebook, las citas se anotan en una libreta y el conteo de clientas frecuentes se lleva de memoria. El portal reemplaza la libreta y le quita trabajo manual: agenda, cobros, descuentos y promociones en un solo lugar.

Por qué: no perder el historial de clientas, aplicar descuentos sin acordarse de ellos y tener herramientas para que las clientas regresen y lleguen más.

## Usuaria
Solo la dueña. Uso interno, sin cuentas ni pantallas para clientas. Se usa desde el celular o la computadora, a menudo con una mano ocupada, así que todo debe ser rápido y con botones grandes.

## Metas
- Registrar una cita en pocos toques justo después de hablar con la clienta por WhatsApp.
- Ver el día y la semana de un vistazo.
- Cobrar (efectivo o transferencia) y que el descuento correcto aparezca sugerido.
- Llevar solo el conteo de visitas de cada clienta y su descuento de lealtad.
- Activar promociones por fechas sin recordarlas manualmente.
- Ayudar a traer clientas: lista de quienes llevan tiempo sin venir y textos listos para WhatsApp y Facebook.

## No metas
- Reservas ni pagos hechos por las clientas.
- Cobro con tarjeta o integración con terminales.
- Varias técnicas, turnos o permisos por rol (por ahora).
- Mensajes enviados automáticamente: el portal prepara el texto y ella lo envía.

## Anti-metas
- Que capturar una cita tome más tiempo que anotarla en la libreta.
- Que los datos de clientas (nombres, teléfonos) queden públicos o se puedan perder.

## Restricciones
- Pagos: solo efectivo y transferencia.
- Datos privados, visibles solo para la dueña.
- Debe funcionar bien en celular.

## Aproximaciones consideradas
1. Datos solo en el dispositivo: rápido, pero se pierde todo al borrar el navegador y no se comparte entre equipos.
2. Página web con base de datos en la nube: mismo portal en celular y computadora, con respaldo. **Elegida por la dueña.**
3. Hoja de cálculo con una página encima: incómoda para agenda y descuentos automáticos.

## Funciones, primera etapa
- **Agenda:** vista del día y de la semana; crear, mover y cancelar citas; servicio, duración, notas del diseño y anticipo opcional (monto recibido y saldo).
- **Clientas:** ficha con nombre, teléfono, cumpleaños, canal de origen (WhatsApp o Facebook), historial de citas y visitas acumuladas.
- **Cobros:** al terminar una cita se registra el total, el método (efectivo o transferencia), el anticipo descontado y el descuento aplicado.
- **Servicios:** catálogo con nombre, precio y duración.
- **Descuentos y promociones:**
  - Lealtad: cada cierto número de visitas cobradas, la clienta obtiene un descuento o extra; el número y el beneficio se configuran.
  - Temporada: promociones con fecha de inicio y fin que se activan solas.
  - Cumpleaños: descuento en el mes de la clienta.
  - Al cobrar, el portal sugiere el descuento aplicable y la dueña lo confirma o lo quita.
- **Captación:** lista de clientas sin visita en más de 4 a 6 semanas (el plazo se configura) con botón que abre WhatsApp con mensaje preescrito; texto listo para copiar de cada promoción activa.
- **Resumen:** ingresos del día y del mes, citas pendientes, promociones activas.

## Segunda etapa (no incluida ahora)
Referidos (quién trajo a quién), combos de servicios, descuentos por horarios flojos, reportes más detallados.

## Cómo se construye (decisiones tomadas por Claude, no acordadas)
- Aplicación web que se abre desde el navegador, con diseño pensado primero para celular.
- Base de datos en la nube, privada, con acceso solo de la dueña.
- Textos y teléfono en México (pesos, formato de fecha día/mes/año, español).

## Dirección visual (propuesta, para ajustar)
- Concepto: el color de esmalte como elemento central. Cada tipo de servicio tiene su tono y las citas en la agenda se ven como muestras de color, de modo que el día se lee por colores.
- Paleta base: ciruela oscuro, rosa orquídea, un lila suave, un blanco perlado y un dorado discreto para lo premium. Se evita el crema con terracota y el negro con acento neón.
- Tipografía: una familia expresiva para títulos y otra limpia para datos y formularios.
- Detalle memorable: la agenda con bloques de color, y todo lo demás sobrio.
- Calidad mínima: se ve bien en celular, foco de teclado visible, contraste legible, movimiento reducido respetado.

## Pendiente para quien construye
Detalles de pantallas, nombres exactos de campos, valores iniciales de lealtad (por ejemplo, descuento en la visita 6) y textos de interfaz, siempre en español y con lenguaje simple.

# Operación diaria: recordatorios, anticipos, siguiente cita, horario y reportes

## Por qué
Una auditoría operativa del portal encontró huecos del día a día:
- Confirmar las citas de mañana hay que hacerlo una por una.
- El anticipo de una cita cancelada desaparece de las cuentas.
- La clienta sale sin su próxima cita.
- La agenda no conoce el horario de trabajo ni deja apartar tiempo (comida, vacaciones).
- El Resumen solo da los ingresos de hoy y del mes en curso.

La dueña empieza el negocio, trabaja sola, atiende de lunes a sábado de 8:00 a 18:00, descansa el domingo pero a veces agenda ese día, y aparta su hora de comida solo cuando el día viene lleno.

## Metas
1. **Recordatorios:** en un minuto, mandar por WhatsApp el recordatorio a todas las clientas de mañana, sabiendo a quién ya se le mandó.
2. **Anticipos:** que el anticipo de una cita cancelada quede registrado como retenido o devuelto, y que lo retenido cuente como ingreso.
3. **Siguiente cita:** al cobrar, agendar la siguiente cita en dos toques, con fecha sugerida y los mismos servicios.
4. **Horario y bloqueos:** que la agenda muestre el horario de trabajo y los bloqueos, y avise (sin impedir) al agendar fuera de horario o encima de un bloqueo.
5. **Reportes:** ver cualquier mes con ingresos, comparación, ticket promedio, ventas por servicio y por método, mejores clientas, cancelaciones y anticipos retenidos.

## Fuera de alcance
- Envío automático de mensajes (sin intervención): WhatsApp requiere su API de negocio; aquí cada mensaje lo envía ella con un toque.
- Corte de caja, tarjeta, pago mixto y propinas (siguiente etapa).
- Gastos y utilidad, exportar a Excel, ficha técnica de la clienta.
- Bloqueos que se repiten solos (por ejemplo, comida todos los días a las 14:00).
- Varias personas o sillas en la agenda.

## Lo que no debe pasar
- Que un bloqueo cuente como cita en cobros, reportes, cancelaciones, recordatorios o historial.
- Que el horario impida agendar: fuera de horario y encima de un bloqueo solo hay aviso, con "Guardar de todos modos".
- Que cambien los ingresos ya registrados: los anticipos retenidos se suman a partir de ahora; las cancelaciones anteriores (sin decisión sobre el anticipo) no cuentan como ingreso.
- Que un recordatorio vaya a una cita cancelada o ya cobrada.

## Enfoques considerados (bloqueos)
- **A, elegido:** colección propia `blocks`. No se mezclan con citas, así que nada que cuente citas los ve.
- B: bloqueos como un tipo especial de cita. Descartado: habría que excluirlos en cada cobro, reporte, conteo, recordatorio e historial; olvidar uno mete una "cita" de comida en los números.

El resto tiene una sola forma sensata, descrita abajo.

## Diseño

### 1. Recordatorios de mañana
- En la Agenda, junto a "Nueva cita", un botón "Recordatorios" abre una hoja "Citas de mañana" (el día siguiente a hoy; si mañana es domingo y no hay citas, la hoja lo dice).
- Lista las citas **pendientes** de mañana en orden de hora: hora, clienta, resumen de servicios y un botón "Enviar WhatsApp".
- El mensaje: "Hola Ana, te recuerdo tu cita mañana a las 10:00 en Nails Up. ¿Me confirmas, por favor?" (primer nombre de la clienta).
- Al tocar el botón se abre WhatsApp y la cita guarda `remindedAt` (fecha de hoy); la fila queda marcada "Recordada" y el botón cambia a "Enviar de nuevo".
- Clientas sin teléfono o eliminadas: la fila dice "Sin teléfono" y no tiene botón.
- Un contador en el botón de la Agenda ("Recordatorios · 3") muestra cuántas de mañana faltan por recordar.

### 2. Anticipo al cancelar
- En la pantalla de cancelar, si la cita tiene anticipo, aparece obligatorio: "¿Qué pasó con el anticipo de $200?" con "Me lo quedo" y "Lo devolví".
- La cita guarda `advanceKept: true | false`. Sin anticipo no se pregunta ni se guarda.
- El detalle de una cita cancelada muestra "Anticipo retenido $200" o "Anticipo devuelto $200".
- Ingresos: un anticipo retenido cuenta como ingreso del día de la cancelación (`cancelledAt`). Se suma en los ingresos de Reportes y del día. Las cancelaciones anteriores a este cambio no tienen `advanceKept` y no cuentan.

### 3. Agendar la siguiente cita
- Cada servicio del catálogo tiene un campo opcional "Vuelve cada (semanas)" (`returnWeeks`, número entero, vacío = sin sugerencia).
- Al cobrar con éxito, en lugar de solo cerrar, aparece una hoja "Cobrado" con el total y el botón "Agendar siguiente cita" (y "Listo" para cerrar).
- "Agendar siguiente cita" abre el formulario de cita con la misma clienta, los mismos servicios (con sus precios de catálogo actuales), la misma hora y la fecha sugerida: hoy + el menor `returnWeeks` de sus servicios; si ninguno lo tiene, + 3 semanas. Si la fecha sugerida cae en día no laborable, se mueve al siguiente día laborable.
- Debajo de la fecha, el texto "Sugerida: en 3 semanas" para que se entienda de dónde salió.

### 4. Horario y bloqueos
**Horario.**
- En la configuración (`settings`) queda `hours`: por día de la semana, abierto o cerrado, y hora de apertura y cierre. Valor inicial: lunes a sábado 08:00–18:00, domingo cerrado.
- Se edita en una sección "Horario" (en Promociones no va: se agrega como pestaña "Horario" dentro de Servicios, que es donde se configura el negocio). Por día: casilla "Abierto" y horas "De" y "A".
- La agenda empieza y termina en el horario más amplio de los días abiertos (8 a 18), y se amplía, como hoy, si hay citas fuera de ese rango. Lo que queda fuera del horario de ese día (y el día completo si está cerrado) se ve sombreado; en un día cerrado aparece "Descanso" en la cabecera.
- Las celdas sombreadas siguen respondiendo al toque para crear cita.

**Bloqueos.**
- Colección `blocks`: `{ date, endDate, start, end, allDay, reason }`. Un bloqueo de horas usa `date`, `start` y `end` (`endDate` igual a `date`). Uno de todo el día puede abarcar varios días (`date` a `endDate`, `allDay: true`).
- En la Agenda, un botón "Bloquear horario" abre la hoja "Bloquear horario": motivo (texto, sugerido "Comida"), fecha, casilla "Todo el día" y, según eso, "De"/"A" o "Hasta el día".
- En la agenda un bloqueo se ve como un bloque gris con rayas y su motivo. Tocarlo abre su detalle con "Eliminar bloqueo".
- Un bloqueo no detecta empalmes con citas al crearse (se puede bloquear encima de una cita; la cita sigue ahí).

**Avisos al guardar una cita** (con "Guardar de todos modos", igual que el empalme):
- Día cerrado: "El domingo es tu día de descanso."
- Fuera de horario: "Está fuera de tu horario (8:00 a 18:00)."
- Encima de un bloqueo: "Choca con el bloqueo «Comida» de 14:00 a 15:00." (o "…el bloqueo «Vacaciones» de todo el día").
- Si hay varios avisos, se muestran juntos con un solo "Guardar de todos modos".

### 5. Reportes por mes
- La pestaña "Resumen" se llama "Reportes".
- Arriba se conservan las tarjetas de hoy (ingresos de hoy, citas pendientes hoy) y debajo el reporte de un mes con flechas para cambiar de mes (empieza en el actual).
- **Ingresos del mes:** suma de los totales cobrados (por fecha de cobro) más los anticipos retenidos (por fecha de cancelación), y la comparación con el mes anterior: "+12% que octubre" (o "—" si el anterior es 0).
- **Citas cobradas** y **ticket promedio** (ingresos de citas cobradas ÷ citas cobradas; sin los anticipos retenidos).
- **Ventas por servicio:** cada servicio con veces vendido y monto, ordenado por monto. El monto usa los precios cobrados de cada línea (antes de descuentos); una nota lo aclara: "Montos antes de descuentos". Las citas viejas cuentan con su línea única.
- **Por método de pago:** efectivo y transferencia con su suma de totales.
- **Mejores clientas:** las 5 con más gasto en el mes (nombre, visitas, total).
- **Cancelaciones:** de las citas del mes (por fecha de la cita) que ya pasaron o se cerraron, cuántas se cancelaron con aviso y cuántas no llegaron, con su porcentaje sobre el total de citas cerradas (cobradas + canceladas).
- **Anticipos retenidos** del mes: número y suma.
- Un mes sin datos muestra "Sin cobros este mes."

## Decisiones mías (corrígelas si no)
- El horario se configura en una pestaña "Horario" dentro de Servicios.
- La fecha sugerida para la siguiente cita usa el menor intervalo de sus servicios; sin intervalo, 3 semanas.
- Los recordatorios son solo para mañana (no para pasado mañana ni para hoy).
- Un bloqueo se puede borrar pero no editar (se borra y se crea otro).
- Los porcentajes se redondean a enteros.
- Si una cita recordada cambia de fecha u hora, se borra `remindedAt` para que vuelva a aparecer como pendiente de recordar.
- En "Por método de pago" los anticipos retenidos aparecen como su propia fila ("Anticipos retenidos"), así la suma de la tabla coincide con los ingresos del mes. "Mejores clientas" cuenta solo lo cobrado, sin anticipos retenidos.
- Las reglas (ingresos del mes con anticipos, ventas por servicio, mejores clientas, cancelaciones, fecha sugerida, avisos de horario y bloqueos, rango de la agenda) van en `logic.js` con pruebas; las pantallas se comprueban en el navegador.
- El servidor acepta la colección nueva `blocks`; el formato de las demás no cambia.

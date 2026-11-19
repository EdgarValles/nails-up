# Guardar sin duplicar, eliminar clientas y citas, y seguimiento de cancelaciones

## Por qué
Publicado en Render, guardar tarda uno o varios segundos (Render → Atlas, y el plan gratis despierta). Mientras tanto la pantalla no cambia y el botón sigue activo: cada clic crea otra clienta (o cita). La revisión de teléfono repetido no lo evita porque la primera todavía no llega a la lista.
Además no hay forma de borrar clientas ni citas, así que los duplicados y los errores de captura no se pueden quitar.
Y aunque cancelar una cita ya existe, no se sabe quién cancela seguido: hay que revisar ficha por ficha, y no se distingue a quien avisa de quien no llega.

## Metas
- Un clic en Guardar produce un solo registro, aunque el servidor tarde.
- Se ve que está guardando, y si falla se puede reintentar desde el mismo formulario.
- Se puede eliminar una clienta sin perder el historial de cobros.
- Se puede eliminar una cita capturada por error.
- Al cancelar queda registrado si la clienta avisó o no llegó, y el motivo; y se ve quién tiende a cancelar.

## Fuera de alcance
- Borrar servicios o promociones.
- Fusionar clientas duplicadas (pasar citas de una a otra).
- Papelera o deshacer.
- Bloquear o cobrar penalización a quien cancela.

## Lo que no debe pasar
- Que borrar una clienta o una cita cambie los totales de Cobros.
- Que queden citas pendientes en la agenda sin clienta.
- Que se pueda borrar con un toque accidental.
- Que se use "eliminar" cuando una clienta cancela: eso borraría el historial que queremos.

## Enfoques considerados (para eliminar clienta)
- **A, elegida:** se borra la clienta; sus citas se conservan y muestran "Clienta eliminada" (la app ya lo hace). Si tiene citas pendientes, no se deja borrar.
- B: borrar clienta y todas sus citas. Descartada: cambia los ingresos históricos.
- C: solo clientas sin ninguna cita. Descartada: no sirve para depurar clientas antiguas.

Para cancelaciones hay una sola forma sensata: seguir usando el estado "cancelada" que ya existe y agregarle el tipo y el motivo. Un estado aparte para "no llegó" obligaría a revisar cada lugar que hoy filtra las canceladas (agenda, empalmes, visitas) sin ganar nada.

## Diseño
**Guardar.** Un mismo comportamiento en todos los botones que guardan o borran (cita, clienta, servicio, promoción, cobro, cancelar, eliminar y los de configuración): al tocarlo se desactiva y dice "Guardando…" (o "Eliminando…") hasta que el servidor responde. Si sale bien, todo sigue como hoy (se cierra y aparece el aviso). Si falla, el botón vuelve a su texto y el error se muestra dentro del formulario abierto (hoy aparece detrás de la ventana). Un segundo clic mientras guarda no hace nada.

**Cancelar cita** (el botón que ya existe en el detalle de una cita pendiente). La pantalla de confirmación ahora pide:
- Qué pasó: "Avisó que no viene" o "No llegó" (obligatorio, sin opción marcada de inicio).
- Motivo (opcional, texto libre): por ejemplo "se enfermó", "cambio de trabajo".
- "Sí, cancelar cita" y "No".
La cita guarda el tipo, el motivo y la fecha en que se canceló. Sigue fuera de la agenda, libera el horario y no cuenta como visita, como hoy.
En el detalle de una cita cancelada se ve "Canceló con aviso" o "No llegó", y el motivo si lo hay. En el historial de la ficha, la etiqueta dice "Canceló" o "No llegó" en lugar de "cancelada", con el motivo debajo.

**Tendencia a cancelar.**
- En la ficha de la clienta, junto a las visitas: "6 visitas cobradas · 2 cancelaciones · 1 no llegó" (solo las partes que no son cero).
- Al agendarle una cita nueva (al elegirla en el formulario), un aviso: "Ana canceló 3 de sus últimas 5 citas (1 sin llegar)." El aviso no impide guardar.

**Eliminar cita.** En el detalle de una cita pendiente o cancelada, abajo y separado, un botón discreto "Eliminar cita", con el texto "Solo para citas capturadas por error. Si la clienta canceló, usa Cancelar cita para que quede en su historial." Pide confirmación en la misma pantalla. Las citas cobradas no se pueden eliminar.

**Eliminar clienta.** En la ficha de la clienta, debajo del historial y separado de los demás botones, un botón discreto "Eliminar clienta".
- Si tiene citas pendientes (pasadas sin cobrar o por venir), en lugar de borrar muestra: "Tiene N citas pendientes; cobra o cancela esas citas primero."
- Si no, pide confirmación en la misma ficha: "¿Eliminar a Ana López? Sus N citas del historial se conservan." (o "No tiene citas.") con "Sí, eliminar" y "No".
- Al confirmar: se borra, se cierra la ficha y aparece "Clienta eliminada".

## Decisiones mías (corrígelas si no)
- Cuenta como pendiente cualquier cita con estado "pendiente", aunque su fecha ya pasó: sigue por cobrar.
- El aviso de tendencia aparece cuando la clienta tiene 2 o más cancelaciones (de cualquier tipo) entre sus últimas 5 citas ya cerradas (cobradas o canceladas). Con menos historial no se muestra.
- Las citas canceladas antes de este cambio no tienen tipo: cuentan como cancelación "con aviso" y se muestran como "Canceló".
- Las confirmaciones van dentro del portal y no en ventanas del navegador, para que se vean como el resto.
- Pruebas: las reglas (si se puede borrar una clienta o cita, el conteo de cancelaciones y el aviso de tendencia) van en `logic.js` con pruebas; el comportamiento de los botones se comprueba en el navegador contra un servidor lento.

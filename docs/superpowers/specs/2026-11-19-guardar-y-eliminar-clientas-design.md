# Guardar sin duplicar y eliminar clientas

## Por qué
Publicado en Render, guardar tarda uno o varios segundos (Render → Atlas, y el plan gratis despierta). Mientras tanto la pantalla no cambia y el botón sigue activo: cada clic crea otra clienta (o cita). La revisión de teléfono repetido no lo evita porque la primera todavía no llega a la lista. Además, no hay forma de borrar clientas, así que los duplicados no se pueden quitar y la lista no se puede depurar.

## Metas
- Un clic en Guardar produce un solo registro, aunque el servidor tarde.
- Se ve que está guardando, y si falla se puede reintentar desde el mismo formulario.
- Se puede eliminar una clienta desde su ficha sin perder el historial de cobros.

## Fuera de alcance
- Borrar citas, servicios o promociones.
- Fusionar clientas duplicadas (pasar citas de una a otra).
- Papelera o deshacer.

## Lo que no debe pasar
- Que borrar una clienta cambie los totales de Cobros de meses pasados.
- Que queden citas pendientes en la agenda sin clienta.
- Que se pueda borrar con un toque accidental.

## Enfoques considerados (para eliminar)
- **A, elegida:** se borra la clienta; sus citas se conservan y muestran "Clienta eliminada" (la app ya lo hace). Si tiene citas pendientes, no se deja borrar.
- B: borrar clienta y todas sus citas. Descartada: cambia los ingresos históricos.
- C: solo clientas sin ninguna cita. Descartada: no sirve para depurar clientas antiguas.

## Diseño
**Guardar.** Un mismo comportamiento en todos los botones que guardan (cita, clienta, servicio, promoción, cobro y los de configuración): al tocarlo se desactiva y dice "Guardando…" hasta que el servidor responde. Si sale bien, todo sigue como hoy (se cierra y aparece el aviso). Si falla, el botón vuelve a su texto y el error se muestra dentro del formulario abierto (hoy aparece detrás de la ventana). Un segundo clic mientras guarda no hace nada.

**Eliminar clienta.** En la ficha de la clienta, debajo del historial y separado de los demás botones, un botón discreto "Eliminar clienta".
- Si tiene citas con estado pendiente (pasadas sin cobrar o por venir), en lugar de borrar muestra: "Tiene N citas pendientes; cobra o cancela esas citas primero."
- Si no, pide confirmación en la misma ficha: "¿Eliminar a Ana López? Sus N citas del historial se conservan." (o "No tiene citas." si no tiene) con "Sí, eliminar" y "No".
- Al confirmar: se borra (con el mismo "Eliminando…" que Guardar), se cierra la ficha y aparece "Clienta eliminada".

## Decisiones mías (corrígelas si no)
- Cuenta como pendiente cualquier cita con estado "pendiente", aunque su fecha ya pasó: sigue por cobrar.
- La confirmación va dentro de la ficha y no en una ventana del navegador, para que se vea igual que el resto del portal.
- Pruebas: la regla de "se puede borrar" va en `logic.js` con pruebas; el comportamiento de los botones se comprueba en el navegador contra un servidor lento.

# Varios servicios en una misma cita

## Por qué
Hoy cada cita tiene un solo servicio y al cobrar hay un solo campo "Precio del servicio". En la práctica una clienta recibe varias cosas en la misma visita (por ejemplo manicure en gel + diseño + retiro), a veces agendadas desde antes y a veces pedidas en el momento. Hoy no queda registrado qué se hizo, la agenda no aparta el tiempo real y el precio se calcula a mano.

## Metas
- Agendar una cita con uno o varios servicios; la agenda aparta la suma de sus duraciones.
- Al cobrar, ver lo agendado desglosado, agregar lo que se pidió en el momento, quitar lo que no se hizo y ajustar el precio de cada línea.
- Que lo cobrado quede desglosado en el detalle de la cita, en la ficha de la clienta y en Cobros.
- Que las citas que ya existen sigan viéndose y cobrándose igual, sin migrar datos.

## Fuera de alcance
- Reportes por servicio (cuánto vendió cada servicio). El formato lo permite después.
- Campo de cantidad por línea: para cobrar por pieza se agrega el mismo servicio varias veces o se ajusta el precio de la línea.
- Asignar servicios a distintas personas (manicuristas) o a horarios distintos dentro de la cita.
- Descuentos por línea: el descuento sigue aplicándose al total, como hoy.

## Lo que no debe pasar
- Que una cita existente (de un solo servicio) se vea vacía, pierda su precio o no se pueda cobrar.
- Que cambien los totales de Cobros o Resumen de lo ya cobrado.
- Que vuelva el riesgo de duplicados: la cita se sigue guardando en un solo paso.

## Enfoques considerados
- **A, elegido:** la cita guarda una lista de servicios. Un solo registro por cita; las citas viejas se leen como lista de uno.
- B: servicios de la cita en una colección aparte. Descartado: varios guardados por cita, riesgo de citas a medias y de duplicados, y no se necesita para los reportes actuales.
- C: servicio principal más un campo de "extras" al cobrar. Descartado: la agenda no aparta el tiempo de lo extra y no queda claro qué se cobró.

## Diseño

**Datos.** Cada cita tiene `services`: una lista de líneas `{ serviceId, name, color, price, durationMin }`, copiadas del catálogo al agregarlas (si después cambia el catálogo, la cita conserva lo que tenía). Una cita sin `services` (las de antes) se lee como una lista de una línea formada con sus campos actuales `serviceId`, `serviceName`, `serviceColor`, `price` y `durationMin`.
Al guardar, la cita también sigue escribiendo esos campos de antes como resumen: `serviceId` y `serviceColor` del primer servicio, `serviceName` con el texto resumen (abajo) y `price` con la suma de precios. Así cualquier parte que aún los lea sigue funcionando.

**Texto resumen** de una cita: el nombre del primer servicio, y si hay más, " + N" (por ejemplo "Manicure en gel + 2"). Se usa en el bloque de la agenda, el panel del día, la lista de Cobros y el historial de la ficha.

**Agendar (Nueva cita / Editar cita).**
- En lugar del selector de un servicio, una lista "Servicios": cada línea muestra el color, el nombre, la duración y el precio de catálogo, con un botón para quitarla.
- Debajo, un selector "Agregar servicio" con los servicios activos; al elegir uno se agrega a la lista y el selector vuelve a "Agregar servicio". Se puede agregar el mismo servicio más de una vez.
- La duración se llena sola con la suma de las duraciones. Si la cambias a mano, ya no se recalcula al agregar o quitar servicios en ese formulario.
- Debajo de la lista, el total estimado: "Total estimado: $470 · 1 h 30 min".
- Para guardar se necesita al menos un servicio: "Agrega al menos un servicio."
- Los precios no se editan aquí; se ajustan al cobrar.
- Al editar una cita vieja, su servicio aparece como la primera línea de la lista.

**Cobrar.**
- En lugar del campo "Precio del servicio", la lista de líneas de la cita, cada una con su precio editable y un botón para quitarla, y el selector "Agregar servicio" (agrega con el precio de catálogo).
- El subtotal es la suma de los precios de las líneas; el descuento sugerido, el anticipo, el total y el saldo se calculan como hoy sobre ese subtotal y se actualizan al cambiar cualquier línea.
- Para cobrar se necesita al menos una línea y un subtotal mayor que cero (como hoy): "Agrega al menos un servicio." / "El total de los servicios es $0; escribe los precios."
- Al cobrar, la cita guarda la lista final (lo que realmente se hizo, con los precios cobrados) y el resumen de los campos de antes. La duración agendada no cambia.

**Mostrar.**
- Agenda, panel del día, lista de Cobros e historial de la ficha: el texto resumen y el color del primer servicio.
- Detalle de la cita: la fila "Servicios" muestra cada línea con su color, nombre y precio; para una cita cobrada, los precios cobrados.

## Decisiones mías (corrígelas si no)
- Los precios se ajustan solo al cobrar, no al agendar, para que agendar siga siendo rápido.
- La duración automática se apaga si la editas a mano en ese formulario.
- Se permiten líneas con precio $0 (por ejemplo un retoque de cortesía) mientras el subtotal sea mayor que cero.
- Una línea cuyo servicio ya se desactivó en el catálogo se conserva en las citas que la tienen; solo deja de ofrecerse para agregar.
- Al editar una cita pendiente, las líneas que ya tenía conservan su precio guardado; solo las líneas nuevas toman el precio del catálogo. Así editar la hora no cambia precios aunque el catálogo haya cambiado.
- En el detalle, la fila "Servicios" lista cada línea con su precio para cualquier estado (pendiente y cancelada con el precio guardado, cobrada con el precio cobrado) y reemplaza a la fila "Precio". La fila "Cobrado" con el total se queda igual.
- Una línea con precio $0 se muestra sin precio, y si la suma estimada es $0 el formulario de cita muestra solo la duración ("Total estimado: 1 h 30 min").
- Al cobrar una cita vieja, su única línea empieza con su `price` (o $0 si no tenía) y se puede editar como cualquier otra.
- Las reglas (leer la lista de una cita vieja, el texto resumen, la suma de precios y duraciones) van en `logic.js` con pruebas; las pantallas se comprueban en el navegador.

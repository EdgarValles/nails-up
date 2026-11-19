# Servicios por unidad y duración sugerida

## Por qué
Hay servicios que se cobran por pieza, por ejemplo la decoración por cada uña. Hoy cada línea de una cita vale una vez, así que para 4 uñas habría que agregar el servicio 4 veces. Además, la duración de la cita se calcula sola, pero no queda claro cuál es la sugerida y cuál la que ella decidió.

## Metas
- Que un servicio del catálogo se marque como "Único" o "Por unidad", con su nombre de unidad y un máximo.
- Que en la cita una línea por unidad tenga cantidad (1 al máximo), y que precio y duración se multipliquen.
- Que al cobrar se pueda cambiar la cantidad y el precio por unidad.
- Que la duración de la cita sea editable y muestre la sugerida, con forma de volver a ella.
- Que Reportes cuente unidades vendidas.

## Fuera de alcance
- Cantidades en servicios "Único" (siguen valiendo 1).
- Precios escalonados (por ejemplo, 10 uñas con descuento).

## Lo que no debe pasar
- Que cambien los montos de citas ya agendadas o cobradas: las líneas sin cantidad valen 1.
- Que la cantidad pase del máximo o baje de 1.

## Diseño
**Catálogo.** El formulario de servicio agrega "Cómo se cobra": "Único" o "Por unidad". Con "Por unidad" aparecen "Unidad" (texto, por ejemplo "uña"; obligatorio) y "Máximo" (entero de 2 a 99; valor inicial 10). Precio y duración se leen como "por unidad" (las etiquetas cambian a "Precio por uña" y "Duración por uña (min)"). Se guarda `perUnit: true`, `unitLabel`, `maxUnits`; con "Único" se quitan.
Validaciones: "Escribe la unidad (por ejemplo, uña)." y "El máximo debe ser un número de 2 a 99."

**Líneas.** Una línea guarda además `qty` (entero, 1 si falta) y, si el servicio es por unidad, `unitLabel` y `maxUnits` copiados al agregarla. `price` y `durationMin` de la línea son por unidad; el total de la línea es `price × qty` y su tiempo `durationMin × qty`. Las líneas existentes no tienen `qty` y valen lo mismo que antes.

**Editor de servicios (agendar y cobrar).** Una línea por unidad muestra un control de cantidad (botones "−" y "+" con el número en medio; `aria-label` "Menos uñas"/"Más uñas") limitado de 1 al máximo, y el texto "4 uñas × $30" con el total de la línea a la derecha ("$120") y su tiempo ("20 min"). Al cobrar, el campo de precio editable es el precio por unidad.

**Duración de la cita.** El campo "Duración (min)" queda al final de los datos de la cita, antes de las notas, y debajo dice "Sugerido: 1 h 20 min, según los servicios". Mientras no se toque, sigue a lo sugerido. Si se cambia a mano, se respeta y aparece el enlace "Usar sugerido", que lo devuelve a la suma y vuelve a seguirla.

**Mostrar.** En el detalle de la cita, una línea por unidad dice "Decoración · 4 uñas" con el total de la línea. En Reportes, "Ventas por servicio" suma unidades: para servicios por unidad "24 uñas", para los demás "N veces" como hoy; el monto es la suma de los totales de línea.

**Plural de la unidad.** Se agrega "s" si termina en vocal y "es" si termina en consonante ("uña" → "uñas", "flor" → "flores"); con 1 se usa el singular.

## Decisiones mías
- Máximo de 2 a 99, inicial 10.
- La cantidad inicial al agregar un servicio por unidad es 1.
- Las reglas (total de línea, totales, plural, ventas por unidad) van en `logic.js` con pruebas; las pantallas se comprueban en el navegador.

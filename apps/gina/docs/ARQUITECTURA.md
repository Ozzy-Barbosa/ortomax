# Gimo · arquitectura y conservación de datos

## Alcance real

Aplicación PWA para una usuaria, preparada para el prefijo `/gina/` del sitio Orthomax. React y TypeScript separan las pantallas del dominio financiero y del repositorio local. El estado financiero está en una bóveda cifrada de IndexedDB. No existe servidor financiero, inicio de sesión remoto, copia automática en la nube ni sincronización entre dispositivos.

El modo demostración se crea en memoria y no se escribe en la bóveda real. `emptyState()` empieza con nombres de actividades y categorías, sin cuentas, movimientos, saldos ni metas inventadas. `demoState()` genera únicamente datos ficticios para explorar la interfaz.

## Módulos

| Archivo | Responsabilidad |
| --- | --- |
| `src/types.ts` | Contrato de datos y versión del esquema. |
| `src/domain.ts` | Validación, centavos, periodos, transferencias, saldos, metas, pendientes y analítica. |
| `src/vault.ts` | Cifrado, almacenamiento atómico, exportación, restauración y copias de recuperación. |
| `src/Forms.tsx` | Formularios y validación de cambios antes de persistir. |
| `src/App.tsx` | Navegación, filtros y coordinación de las vistas. |
| `src/components.tsx` | Componentes visuales, importes, gráficas y diálogos. |
| `src/Settings.tsx` | Configuración, respaldo y restauración. |
| `src/exports.ts` | Exportación CSV y descarga de archivos. |
| `scripts/build-sw.mjs` | Construcción del service worker y caché de recursos de la PWA. |

El dominio se desarrolló para estas reglas. Aprovecha los criterios del brief —funciones puras, dinero en centavos y separación de persistencia e interfaz— sin trasladar el modelo de inventario de otros productos. Las pruebas de otros proyectos no se consideran pruebas de esta aplicación.

## Modelo y fuente de verdad

`FinanceState.schemaVersion` es `1`. El estado incluye perfil, fuentes, cuentas, categorías, movimientos, cobros pendientes, metas, apartados, eventos de ahorro, presupuestos, favoritos, recurrencias, auditoría, revisiones mensuales, un borrador y fecha de la última exportación registrada.

Las fuentes iniciales son Orthomax, Secom, Dr. Gaxiola, Dr. Anel, Dr. Iliana y Personal. Existe además una actividad auxiliar de gastos profesionales compartidos; evita atribuir esos gastos a una clínica de forma arbitraria. Las áreas son Consultorio, Colaboraciones y Personal. Profesional y General son filtros de agregación, no cuentas ni fuentes donde duplicar movimientos.

Las cuentas tienen saldo inicial, fecha de corte, área, tipo y bandera de inclusión en dinero libre. Una cuenta mixta aparece solamente en el saldo General. Los movimientos pueden utilizar una cuenta compartida entre fuentes; el saldo de esa cuenta no se reparte entre clínicas por inferencia. Archivar una cuenta o fuente preserva su historia y no borra el dinero que todavía contiene.

Las pantallas calculan sus indicadores a partir de movimientos y eventos de ahorro. No se guardan KPI de cada pantalla como una segunda verdad financiera. Los importes de una revisión mensual son una instantánea administrativa de revisión; no sustituyen la historia de movimientos ni hacen que el mes sea inmutable.

## Reglas financieras

- Los importes se guardan como enteros seguros en centavos. `parseMoney()` valida formato y dos decimales; las acumulaciones se comprueban para evitar exceder la precisión entera. La moneda de presentación es MXN.
- Ingresos, gastos e inversión en equipo se distinguen. Resultado operativo = ingreso cobrado − gasto pagado. Flujo = ingreso cobrado − gasto pagado − inversión en equipo.
- El saldo inicial representa el comienzo de su fecha de corte. Solo los movimientos de esa fecha o posteriores afectan el saldo de la cuenta. Los anteriores continúan participando en reportes de su fecha, sin sumarse una segunda vez al saldo inicial.
- `accountBalance()` rechaza pedir un saldo anterior al corte, porque no existe información suficiente para reconstruirlo. La interfaz debe presentar esa limitación y no inventar un cero.
- Las transferencias son una operación atómica con cuenta de origen y de destino. No generan ingresos, gastos ni avance de metas. En vistas de áreas, la lista incluye ambos extremos pertinentes y los indicadores de transferencias recibidas/enviadas se calculan aparte. En General se compensan.
- Los cobros pendientes no suman dinero. Cada ingreso recibido puede vincularse al pendiente correspondiente; la suma de cobros activos reduce su saldo. Anular un cobro restituye la cantidad pendiente. La validación impide exceder el total y referencias a fuentes diferentes.
- Los apartados son reservas virtuales dentro de una cuenta. Las aportaciones son positivas y las liberaciones negativas. No alteran flujo ni saldo. Se valida el historial para que nunca se libere más de lo apartado ni quede una reserva mayor que el saldo de su cuenta.
- Dinero libre = saldo de cuentas incluidas para gastar − apartados en esas mismas cuentas. Una cuenta de ahorro excluida no se descuenta una segunda vez. El saldo de cuentas mixtas solo aparece en General; una fuente individual no recibe un saldo de cuenta inventado.
- La meta de ingresos suma cobros efectivos del periodo. La meta de ahorro suma aportaciones menos liberaciones del periodo, sin volver a contar ahorros previos. Las metas de ahorro se calculan por área de la cuenta o General, no por fuente clínica.

`validateState()` recibe un valor desconocido y devuelve una copia validada. Rechaza versiones diferentes, campos inesperados, IDs duplicados, fechas inválidas, centavos fraccionarios, referencias rotas y violaciones financieras. La corrupción nunca se sustituye silenciosamente por un estado vacío. La conciliación histórica de reservas usa acumulación por fecha para evitar búsquedas cuadráticas en historiales grandes.

## Fechas, periodos y reportes

Las fechas efectivas son cadenas `YYYY-MM-DD`, sin convertirlas en un instante UTC. `today()` usa `America/Mazatlan`; los instantes de creación y auditoría usan ISO 8601. Los cálculos de cambio de día trabajan sobre una representación UTC controlada para conservar la fecha elegida.

Las semanas son lunes–domingo. La gráfica de un mes utiliza tramos 1–7, 8–14, 15–21, 22–28 y 29–fin. No se confunden con semanas calendario. Los meses bisiestos, los rangos y las semanas que cruzan meses están cubiertos por pruebas. Las metas calculan días de trabajo restantes según el perfil, incluyendo hoy si corresponde. Una meta vencida tiene cero días restantes y no produce infinito.

Una revisión mensual conserva fecha, importes de la revisión y una huella de los registros observados. Cambios posteriores deben señalar que hace falta revisar de nuevo. No es un cierre fiscal ni impide corregir movimientos. Exportar CSV o imprimir un reporte ofrece una copia legible, pero ninguno reemplaza el respaldo completo cifrado.

## Cifrado local

`VaultRepo` usa Web Crypto con AES-256-GCM y una clave derivada de la contraseña mediante PBKDF2-SHA256, 600 000 iteraciones y sal aleatoria de 16 bytes. Cada escritura genera un IV aleatorio nuevo de 12 bytes. Se autentican también versión, parámetros criptográficos, identidad y revisión de la bóveda mediante datos adicionales de AES-GCM.

La contraseña de creación tiene un mínimo de 12 caracteres. No se almacena como texto ni se incrusta en el código. La clave derivada es un `CryptoKey` no exportable y se mantiene únicamente durante la sesión desbloqueada. `lock()` descarta las referencias a clave y sobre; la interfaz descarta los registros visibles. Esto no permite prometer borrado forense de la memoria administrada por JavaScript.

Movimientos, notas, borrador, auditoría y configuración financiera forman parte del contenido cifrado. El sobre conserva metadatos técnicos legibles, como versión y fecha de guardado; no contiene importes financieros legibles. No hay telemetría financiera, anuncios o rastreadores.

El cifrado protege los archivos y el almacenamiento cuando la bóveda está bloqueada. No aísla `/gina/` del resto del mismo origen ni protege frente a código del origen comprometido mientras la aplicación está desbloqueada. La seguridad depende también del dispositivo, la contraseña, el sitio y su publicación.

## Escritura y recuperación

El nombre de base permanece estable: `orthomax-gina-vault`, versión IndexedDB `1`, con almacenes `records` y `recovery`. La inicialización solo crea almacenes cuando la base es realmente nueva. No hay reinicio automático, `clear()` de la bóveda ni borrado de IndexedDB durante una actualización.

Cada guardado valida, cifra y abre una transacción de escritura que compara la revisión leída contra la revisión actual. La transacción guarda el nuevo sobre y la copia anterior juntos. Solo se informa éxito después de `transaction.oncomplete`. Una falta de cuota, conflicto o cancelación conserva el estado persistido anterior y devuelve un error. La opción de durabilidad estricta se solicita cuando el navegador la admite.

Se conservan hasta doce revisiones cifradas recuperables. La copia inmediatamente anterior a una restauración queda protegida de la rotación normal hasta que otra restauración toma su lugar. Estas copias están en el mismo dispositivo: no recuperan datos si se pierde el teléfono o se elimina el almacenamiento del sitio.

Las pestañas utilizan notificación de cambio y comparación de sobres para rechazar escrituras obsoletas. La comparación se realiza dentro de la transacción, por lo que la seguridad no depende exclusivamente de recibir una notificación entre pestañas.

## Respaldos

El respaldo es un sobre JSON cifrado autocontenido. La previsualización comprueba tamaño menor de 20 MB, estructura, versiones, parámetros, autenticación criptográfica y reglas completas del dominio antes de presentar el contenido.

Restaurar **reemplaza**, no fusiona ni sincroniza. En una bóveda existente requiere sesión desbloqueada, guarda una copia previa y cifra los datos restaurados con la clave de la sesión actual. En un dispositivo vacío, crea la nueva bóveda utilizando la contraseña del respaldo. Importar el mismo archivo de nuevo no duplica movimientos.

La función de recuperar una copia local puede reparar explícitamente un sobre principal dañado si existe una copia íntegra y se conoce su contraseña. No existe recuperación por correo ni una clave maestra del desarrollador.

La aplicación puede generar una descarga y registrar la fecha de exportación. No puede asegurar que iCloud, Archivos u otro servicio guardó el archivo; la usuaria debe comprobarlo. El respaldo necesita una copia fuera del dispositivo y la contraseña conservada por separado. El CSV es legible y neutraliza prefijos habituales de fórmulas para reducir inyección al abrirlo en una hoja de cálculo.

## Actualizaciones y evolución

El manifiesto y el service worker se limitan a `/gina/`. El worker guarda recursos estáticos de la aplicación; nunca abre IndexedDB ni manipula datos financieros. Al activar una versión nueva, solo elimina cachés cuyo nombre comienza con `orthomax-gina-shell-`; no toca la web raíz ni otras cachés.

Una versión nueva espera a la activación solicitada por la usuaria. La interfaz deshabilita la actualización con un diálogo abierto y solicita guardar primero. El código financiero y las migraciones futuras deben mantenerse independientes de la caducidad de caché.

La V1 no contiene migraciones a una versión de esquema nueva. Una versión desconocida se rechaza y se conserva sin alterarla. Antes de añadir V2 será necesario implementar una migración validada sobre una copia, conservar el original y probar recuperación. Cambiar de nombre de base o reiniciarla para resolver una actualización sería una pérdida de datos y no es una estrategia aceptable.

La solicitud de almacenamiento persistente depende del soporte y decisión del navegador. Ninguna actualización, cifrado o permiso de persistencia garantiza conservación indefinida ante borrado manual, daño o pérdida de dispositivo. El respaldo externo es parte indispensable de la operación.

## Verificación

`src/domain.test.ts` comprueba reglas financieras; `src/vault.test.ts` comprueba protección y persistencia con almacenamiento simulado. La evidencia del navegador, publicación y dispositivos físicos debe consultarse en `docs/VALIDACION.md`. Las pruebas automatizadas o emuladas no equivalen a validar un iPhone físico.

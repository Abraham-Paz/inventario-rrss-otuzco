# Inventario de dispositivos de almacenamiento público temporal de RR.SS. – Otuzco

Aplicación web para PC y celular de la Municipalidad Provincial de Otuzco (GSMyGA). Funciona sin señal en campo y guarda la información en el **Google Drive del administrador**.

- **Aplicación:** https://abraham-paz.github.io/inventario-rrss-otuzco/
- **Servidor:** un programa de Google Apps Script (`servidor/Codigo.gs`) que el administrador instala en su propia cuenta de Google. No tiene costo.

## Qué guarda en su Drive
En la carpeta configurada en `servidor/Codigo.gs` (`CARPETA_ID`):

| Archivo | Contenido |
|---|---|
| `inventario_rrss.json` | Base de datos. **No editar a mano.** |
| `Fotos/` | Fotografías georreferenciadas. Cada nombre lleva el código y la fecha; la descripción, las coordenadas y el usuario. |
| **Inventario RRSS Otuzco – Respuestas** (Hoja de Google) | INVENTARIO, HISTORIAL, FOTOS GEORREF, EVALUACIÓN VOLUMEN y **BITÁCORA**: quién ingresó y qué cambió. Se actualiza en cada sincronización. |

## Servidor: instalación (una sola vez, unos 10 minutos)
1. Entre a https://script.google.com con **su** cuenta (la dueña de la carpeta de Drive) y pulse **Nuevo proyecto**. Póngale de nombre «Servidor Inventario RRSS».
2. Borre el contenido de `Código.gs` y pegue todo el archivo `servidor/Codigo.gs` de este repositorio.
3. Revise la configuración al inicio del archivo:
   - `CARPETA_ID`: el ID de su carpeta de Drive (ya viene puesto).
   - `ADMIN_CLAVE_INICIAL`: la clave del primer ingreso. Puede cambiarla antes de instalar; en el primer ingreso se le obliga a crear una nueva.
4. Guarde (💾). En el menú de funciones elija **instalar** y pulse **Ejecutar**. Google pedirá permisos para Drive y Hojas de cálculo: *Revisar permisos → su cuenta → Configuración avanzada → Ir a Servidor Inventario RRSS (no seguro) → Permitir*. Es su propio script; el aviso es normal.
5. Pulse **Implementar → Nueva implementación → tipo Aplicación web**:
   - *Ejecutar como:* **Yo** (su cuenta)
   - *Quién tiene acceso:* **Cualquier persona**

   Pulse Implementar y copie la **URL de la aplicación web** (termina en `/exec`).
6. En GitHub, abra `config.js`, pulse el lápiz ✏️, pegue la URL en `apiUrl: '...'` y pulse **Commit changes**. En 1–2 minutos la app ya pedirá usuario y contraseña.

«Quién tiene acceso: Cualquier persona» solo permite **llegar** al servidor. Cada operación exige un usuario y una contraseña válidos y se revisan sus permisos en el servidor. Nadie accede a su Drive directamente.

**Cuando cambie el código del servidor:** *Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar*. Así la URL no cambia.

## Primer ingreso del administrador
1. Abra la app e ingrese con usuario **admin** y la clave inicial.
2. Cree su contraseña personal (mínimo 8 caracteres, con letras y números).
3. La app sube automáticamente el inventario 2025 (114 registros) a su Drive y crea la hoja de respuestas.

## Crear los accesos de los responsables (pestaña Usuarios)
Solo el administrador ve esta pestaña.
1. **+ Nuevo acceso**: usuario (por ejemplo `jperez`), nombres, cargo.
2. Elija un **perfil rápido** o marque una por una las pestañas y acciones permitidas:

| Permiso | Qué permite |
|---|---|
| Panel | Ver indicadores |
| Inventario y fichas | Ver la lista y la ficha con fotos |
| Registrar y editar | Registrar dispositivos nuevos y editar todos sus datos |
| Inspeccionar / actualizar | Solo estado, defectos, llenado, cantidad y fotos |
| Mapa · Evaluación técnica · Dimensionamiento | Ver esas pestañas |
| Descargar Excel y respaldos | Pestaña «Datos y Excel» |
| Corregir y volver a subir Excel | Aplicar correcciones masivas desde Excel o desde la hoja de Drive |
| Eliminar registros | Borrar dispositivos |

   Perfiles rápidos: *Inspector de campo* (panel, inventario, inspeccionar, mapa), *Registrador de inventario*, *Supervisor* y *Solo consulta*.
3. Al crear el acceso, la app muestra **una sola vez** la contraseña temporal para entregarla. El responsable debe cambiarla en su primer ingreso.
4. Desde la misma pestaña puede **editar permisos**, **desactivar** un acceso, generar una **nueva clave** (si la olvidó) o **eliminarlo**. Cualquier cambio cierra de inmediato las sesiones abiertas de ese usuario.

Los permisos se controlan **también en el servidor**: aunque alguien modifique la app en su navegador, el servidor rechaza lo que su usuario no tiene permitido. Después de 5 intentos fallidos se bloquea el ingreso por 15 minutos.

## Excel de respuestas: generar, corregir y volver a subir (pestaña Datos y Excel)
1. **Descargar Excel**, o **Abrir hoja en Drive** para ver la hoja que se actualiza sola.
2. Corrija las celdas en la hoja **INVENTARIO** sin cambiar los encabezados ni las columnas CÓDIGO e ID.
3. Hay dos formas de aplicar las correcciones:
   - **Subir el Excel corregido**, o
   - corregir directamente en la hoja de Google y pulsar **Aplicar las correcciones hechas en la hoja de Drive**.

   Solo se aplican las celdas que cambiaron. Cada cambio queda en el historial del dispositivo con el nombre de quien lo hizo y se sube a Drive. Las columnas calculadas (capacidad total, rango, prioridad, diagnóstico) se recalculan solas.

## Trabajo en campo
- **Sin señal:** se puede registrar e inspeccionar; la etiqueta de la cabecera muestra «↑ N» cambios pendientes. Al recuperar internet se suben solos, y también al tocar la etiqueta → *Sincronizar ahora*.
- **Ubicación automática:** al registrar, la app toma el GPS y lo muestra en el mapa; puede corregir la posición tocando o arrastrando el marcador.
- **Fotos georreferenciadas:** cada foto lleva grabados el código, la fecha, la ubicación UTM 17S, la latitud/longitud y la precisión, y también los guarda en los metadatos EXIF.
- **Ficha:** al abrirla se muestra la foto del dispositivo, la más reciente o la del inventario 2025 que está en Drive. Toque la foto para ampliarla.
- **Instalar en el celular:** abra la dirección en Chrome → ⋮ → «Agregar a pantalla principal».
- La sesión dura 7 días. Para cerrarla o cambiar la contraseña, toque su nombre en la cabecera.

## Modo local
Si `config.js` no tiene `apiUrl`, la app funciona sin usuarios y guarda los datos solo en el equipo. Sirve para probarla antes de instalar el servidor.

## Módulos
Panel · Inventario y ficha · Registrar/Editar · Inspección · Mapa · Evaluación técnica (volumen frente a EN 840 y NTP 900.058:2019) · Dimensionamiento · Datos y Excel · Usuarios.

# Inventario de dispositivos de almacenamiento público temporal de RR.SS. – Otuzco

Aplicación web para PC y celular. No necesita servidor ni base de datos: los datos se guardan en el navegador del equipo y las fotos en su almacenamiento interno. Ya trae cargados los 114 registros del inventario 2025 (depurado).

## Cómo usarla

**En PC:** descomprima la carpeta y abra `index.html` con Chrome o Edge. Funciona sin internet; solo el mapa base necesita conexión.

**En celular (recomendado para campo):** publique la carpeta en un sitio https gratuito, por ejemplo:
- Netlify Drop (app.netlify.com/drop): arrastre la carpeta y obtendrá un enlace.
- GitHub Pages: suba la carpeta a un repositorio y active Pages.

Abra el enlace en Chrome del celular, menú ⋮ → "Agregar a pantalla principal". Queda instalada como app y funciona sin señal. El GPS y la cámara del celular solo funcionan cuando la app se abre desde https.

## Guardado en Google Drive y control de acceso (configurar una sola vez)

La app guarda en la carpeta de Drive de la GSMyGA (ya configurada en `config.js`):
- `inventario_rrss.json`: la base de datos compartida. **No editarla a mano.**
- `Inventario_RRSS_Otuzco.xlsx`: el Excel actualizado en cada sincronización, para consultas.
- `Fotos/`: las fotos georreferenciadas. Cada nombre lleva el código y la fecha, y la descripción lleva las coordenadas.

**Paso 1. Permisos de la carpeta.** En Drive, use Compartir y cambie "Cualquier persona con el enlace" a **Restringido**. Luego agregue como **Editor** solo los correos de los inspectores y del personal autorizado. Este es el control de acceso real.

**Paso 2. Crear el ID de cliente de Google** (unos 10 minutos, con la cuenta dueña de la carpeta):
1. Entre a https://console.cloud.google.com/ y cree un proyecto, por ejemplo "Inventario RRSS Otuzco".
2. En *APIs y servicios → Biblioteca*, habilite **Google Drive API**.
3. En *Pantalla de consentimiento OAuth*, elija tipo Externo, póngale un nombre a la app y su correo. Déjela en estado **Prueba** y agregue en *Usuarios de prueba* los correos autorizados (hasta 100). Si la municipalidad usa Google Workspace, elija **Interno**.
4. En *Credenciales → Crear credenciales → ID de cliente de OAuth*, elija tipo **Aplicación web**. En *Orígenes de JavaScript autorizados* ponga la dirección https donde publicó la app (por ejemplo `https://inventario-otuzco.netlify.app`) y, para pruebas en PC, `http://localhost:8000`.
5. Copie el ID (termina en `.apps.googleusercontent.com`) en `config.js`, en `clientId: '...'`. Vuelva a publicar la carpeta.

Desde ese momento la app pide iniciar sesión con Google. Solo entran las cuentas que son Editor de la carpeta (y, si lo desea, solo las que estén en `allowedEmails`). Google mostrará el aviso "app no verificada" porque es de uso interno: pulse *Continuar*.

Nota: con Google Drive la app debe abrirse desde https (o localhost). Al abrir el archivo directamente con doble clic, Google no permite iniciar sesión.

## Ubicación automática y fotos georreferenciadas
- Al registrar un dispositivo nuevo, la app toma el GPS sola y lo muestra en el mapa con su margen de error. Termina cuando la precisión es de ±5 m o después de 60 s. Puede corregir la posición tocando el mapa o arrastrando el marcador.
- En la pestaña Mapa: toque cualquier punto, o use "Mi ubicación", y luego "Registrar dispositivo aquí".
- Cada foto que se toma con la app lleva grabado sobre la imagen el código, la fecha, las coordenadas UTM 17S, la latitud/longitud y la precisión. También se guardan en los metadatos EXIF, que leen Google Drive, Google Earth y QGIS. Si elige de la galería una foto que ya tenía GPS de la cámara, se usa esa ubicación.
- La ficha muestra las fotos en un mapa y avisa si alguna se tomó a más de 30 m del punto registrado.

## Trabajo en equipo
1. Cada inspector inicia sesión con su cuenta de Google. Puede trabajar sin señal; la etiqueta de la cabecera muestra cuántos cambios faltan subir.
2. Con internet, toque esa etiqueta o *Datos y ajustes → Sincronizar ahora*. Primero se suben las fotos y luego se combina el inventario con lo que subieron los demás. Gana el cambio más reciente, se conserva el historial de todos y las eliminaciones se aplican en todos los equipos.
3. Mientras la sesión está activa (1 hora), cada cambio se sincroniza solo. Después la app pide volver a autorizar.
4. Si no se usa Drive, sigue disponible el intercambio por archivo: *Respaldo JSON* e *Importar / consolidar*.

Los datos quedan en el navegador de cada equipo. Si se borran los datos del navegador, se pierden: exporte un respaldo semanal.

## Módulos
- **Panel:** indicadores y gráficos por tipo, sector, ubicación, defectos, prioridad y año.
- **Inventario:** búsqueda y filtros (incluye alertas técnicas), ficha imprimible, historial.
- **Registrar / Editar:** formulario con códigos automáticos, GPS → UTM 17S, cámara, medición interior y aviso de coordenadas duplicadas.
- **Inspeccionar / actualizar:** estado, defectos, nivel de llenado, residuos alrededor, frecuencia de recojo, nota y foto. Cada cambio queda en el historial.
- **Mapa:** puntos coloreados según su estado.
- **Evaluación técnica:** compara el volumen declarado con el geométrico y con las medidas comerciales EN 840, revisa el código de colores NTP 900.058:2019 y da recomendaciones.
- **Dimensionamiento:** calcula el volumen necesario según la demanda y cuántos recipientes hacen falta.

/* CONFIGURACIÓN GENERAL (la edita el administrador una sola vez; vea LEEME.md, paso 2)
   clientId     : ID de cliente OAuth 2.0 de tipo "Aplicación web" creado en Google Cloud Console.
   folderId     : carpeta de Google Drive donde se guarda el inventario (base JSON, Excel y fotos).
   requireLogin : true = para usar la app se exige iniciar sesión con Google y tener permiso
                  de Editor en la carpeta.
   allowedEmails: lista opcional de correos autorizados (vacía = cualquiera que sea Editor de la carpeta). */
window.CONFIG = {
  clientId: '',
  folderId: '1Phs2Qo_D6yPBAscCLrqfqKnk2w4mcEAW',
  requireLogin: true,
  allowedEmails: []
};

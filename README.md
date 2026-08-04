# Registro COM con TXT independientes en Google Drive

Aplicación web para GitHub Pages que conecta múltiples lectores mediante Web Serial y crea un archivo TXT independiente por cada lectura.

## Funciones

- Múltiples pistolas COM simultáneas.
- Código, fecha, hora con milisegundos, nombre del lector e identificador USB.
- Un TXT independiente por cada lectura.
- Confirmación visual: Enviando, Guardado o Error.
- Cola local y botón para reenviar pendientes si se pierde Internet.
- Registros locales en IndexedDB.
- Exportación CSV.
- Sin Python y sin instalación local.

## Archivos para GitHub Pages

Sube o reemplaza:

- `index.html`
- `styles.css`
- `app.js`

## Backend de Google Drive

- Copia `Code.gs` en un proyecto de Google Apps Script.
- Sigue `CONFIGURACION_GOOGLE_DRIVE.md`.

## Navegador

Usa Microsoft Edge o Google Chrome mediante HTTPS.

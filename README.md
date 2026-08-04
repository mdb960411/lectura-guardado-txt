# Registro de Lecturas COM - Respaldo doble V4

Esta versión crea dos archivos TXT independientes por cada lectura:

1. Un TXT en Google Drive mediante Apps Script.
2. Un TXT en una carpeta local o compartida seleccionada desde Edge o Chrome.

Los registros también continúan guardándose en el navegador y pueden exportarse a CSV.

## Actualización en GitHub

Reemplaza en la raíz del repositorio estos tres archivos:

- `index.html`
- `styles.css`
- `app.js`

No es necesario modificar ni volver a implementar `Code.gs` si el respaldo de Google Drive ya funciona.

Después de hacer Commit:

1. Espera a que GitHub Pages termine la publicación.
2. Cierra la pestaña anterior de la aplicación.
3. Abre nuevamente la página.
4. Presiona `Ctrl + F5` una vez.

## Activar la carpeta local

1. Busca la sección **Respaldo TXT en carpeta local**.
2. Presiona **Seleccionar carpeta local**.
3. Elige una carpeta del PC o una carpeta compartida visible en el selector de Windows.
4. Deja marcada **Activar creación automática de TXT local**.
5. Deja marcada **Crear una subcarpeta por fecha** si deseas ordenar los archivos por día.
6. Presiona **Guardar configuración local**.

Cada lectura generará un archivo parecido a:

`2026-08-04_15-30-22-315_Pistola_1_620396_a1b2c3d4.txt`

Si la opción diaria está activa, la estructura será:

```text
CARPETA_SELECCIONADA/
└── 2026-08-04/
    ├── lectura_1.txt
    └── lectura_2.txt
```

## Permisos al volver a abrir

El navegador recuerda la carpeta seleccionada, pero puede volver a solicitar autorización después de cerrar Edge o Chrome. Cuando el estado muestre **Requiere permiso**, presiona **Autorizar carpeta local** antes de comenzar a escanear.

Las lecturas realizadas sin permiso quedan con estado **Pendiente** y se pueden guardar después con **Reintentar pendientes**.

## Estados de respaldo

### Google Drive

- `Guardado`: Google confirmó la creación.
- `Enviado`: la solicitud fue enviada, aunque Google no confirmó al navegador.
- `Pendiente`: falta enviar.
- `Error`: ocurrió un error real.

### Carpeta local

- `Guardado`: el TXT fue creado.
- `Guardando`: se está escribiendo el archivo.
- `Pendiente`: falta autorización o reintento.
- `Error`: no se pudo crear el archivo.
- `No activo`: el respaldo local estaba desactivado para esa lectura.

## Navegador

Usa Microsoft Edge o Google Chrome y abre la aplicación desde la URL HTTPS de GitHub Pages.

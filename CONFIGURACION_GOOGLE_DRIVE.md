# Configurar un TXT independiente por cada lectura

## Resultado

Cada escaneo crea inmediatamente un archivo independiente, por ejemplo:

```text
2026-08-04_12-54-08.315_Pistola_1_620396_550e8400-e29b-41d4-a716-446655440000.txt
```

Dentro del TXT queda:

```text
REGISTRO DE LECTURA
===================
Código: 620396
Fecha: 04-08-2026
Hora: 12:54:08.315
Lector: Pistola 1
Identificador: USB 1234:5678
Fecha ISO: 2026-08-04T16:54:08.315Z
ID de lectura: 550e8400-e29b-41d4-a716-446655440000
```

## Paso 1: crear la carpeta en Google Drive

1. Crea una carpeta, por ejemplo `LECTURAS_PISTOLAS_COM`.
2. Ábrela.
3. Copia el ID que aparece en la dirección del navegador después de `/folders/`.

Ejemplo:

```text
https://drive.google.com/drive/folders/1AbCDefGhIJklMNopQRstuVWxyz
```

El ID es:

```text
1AbCDefGhIJklMNopQRstuVWxyz
```

## Paso 2: crear el Apps Script

1. Entra a `https://script.google.com/`.
2. Crea un proyecto nuevo.
3. Borra el contenido inicial.
4. Copia todo el archivo `Code.gs` entregado en este proyecto.
5. En `CONFIG`, cambia:

```javascript
FOLDER_ID: 'PEGA_AQUI_EL_ID_DE_LA_CARPETA',
API_KEY: 'CAMBIA_ESTA_CLAVE_POR_UNA_CLAVE_LARGA_Y_PRIVADA',
```

Ejemplo:

```javascript
FOLDER_ID: '1AbCDefGhIJklMNopQRstuVWxyz',
API_KEY: 'DESPACHO-2026-CLAVE-LARGA-9X4P7K2M',
```

6. Guarda el proyecto.

## Paso 3: implementar como aplicación web

1. Presiona `Implementar` > `Nueva implementación`.
2. Tipo: `Aplicación web`.
3. Ejecutar como: `Yo`.
4. Acceso: `Cualquier usuario` o `Cualquier persona`, según las opciones de tu cuenta.
5. Autoriza los permisos de Google Drive.
6. Copia la URL que termina en `/exec`.

Cada vez que cambies `Code.gs`, debes crear una nueva versión desde `Implementar` > `Administrar implementaciones` > `Editar` > `Nueva versión`.

## Paso 4: actualizar GitHub Pages

Reemplaza en tu repositorio estos tres archivos:

- `index.html`
- `styles.css`
- `app.js`

Los demás pueden mantenerse.

## Paso 5: configurar la aplicación

1. Abre tu GitHub Pages en Edge o Chrome.
2. Busca el panel `Respaldo TXT en Google Drive`.
3. Pega la URL `/exec` de Apps Script.
4. Escribe la misma clave privada configurada en `Code.gs`.
5. Marca `Activar creación automática de TXT`.
6. Presiona `Guardar configuración`.
7. Realiza una lectura de prueba.

La tabla mostrará:

- `Enviando` mientras se procesa.
- `Guardado` cuando Apps Script confirma la creación.
- `Error` si no pudo guardarse.

Si se pierde Internet, la lectura queda almacenada localmente. Después puedes presionar `Reenviar pendientes`.

## Organización de archivos

Por defecto, el script crea una subcarpeta por día:

```text
LECTURAS_PISTOLAS_COM/
  2026-08-04/
    lectura_1.txt
    lectura_2.txt
  2026-08-05/
    lectura_3.txt
```

Para guardar todos los archivos directamente en una sola carpeta, cambia:

```javascript
CREATE_DAILY_SUBFOLDERS: false,
```

## Seguridad

La clave privada no se incluye dentro del repositorio GitHub. Se ingresa directamente en la aplicación y queda almacenada solamente en el navegador de ese computador.

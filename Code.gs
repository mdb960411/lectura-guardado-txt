/**
 * BACKEND GOOGLE APPS SCRIPT
 * Crea un archivo TXT independiente por cada lectura recibida.
 *
 * 1) Reemplaza FOLDER_ID por el ID de tu carpeta de Google Drive.
 * 2) Cambia API_KEY por una clave privada larga.
 * 3) Implementa como Aplicación web:
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario / Cualquier persona
 */

const CONFIG = {
  FOLDER_ID: 'PEGA_AQUI_EL_ID_DE_LA_CARPETA',
  API_KEY: 'CAMBIA_ESTA_CLAVE_POR_UNA_CLAVE_LARGA_Y_PRIVADA',
  CREATE_DAILY_SUBFOLDERS: true,
};

function doGet() {
  return HtmlService.createHtmlOutput(
    '<h2>Servicio de registro TXT activo</h2><p>Este enlace recibe las lecturas de la aplicación.</p>'
  );
}

function doPost(e) {
  let requestId = '';

  try {
    if (!e || !e.parameter || !e.parameter.payload) {
      throw new Error('No se recibió el campo payload.');
    }

    const payload = JSON.parse(e.parameter.payload);
    requestId = cleanText_(payload.requestId, 120);

    validatePayload_(payload);

    const result = createTxtFile_(payload);
    return postMessageResponse_({
      type: 'drive-txt-result',
      requestId: requestId,
      success: true,
      duplicate: result.duplicate,
      fileName: result.file.getName(),
      fileUrl: result.file.getUrl(),
    });
  } catch (error) {
    return postMessageResponse_({
      type: 'drive-txt-result',
      requestId: requestId,
      success: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function validatePayload_(payload) {
  if (CONFIG.FOLDER_ID === 'PEGA_AQUI_EL_ID_DE_LA_CARPETA') {
    throw new Error('Debes configurar FOLDER_ID en Code.gs.');
  }

  if (CONFIG.API_KEY === 'CAMBIA_ESTA_CLAVE_POR_UNA_CLAVE_LARGA_Y_PRIVADA') {
    throw new Error('Debes configurar API_KEY en Code.gs.');
  }

  if (!payload || payload.apiKey !== CONFIG.API_KEY) {
    throw new Error('Clave privada incorrecta.');
  }

  if (!cleanText_(payload.requestId, 120)) {
    throw new Error('La lectura no contiene un identificador válido.');
  }

  if (!cleanText_(payload.code, 500)) {
    throw new Error('La lectura no contiene un código válido.');
  }
}

function createTxtFile_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const baseFolder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
    const destinationFolder = CONFIG.CREATE_DAILY_SUBFOLDERS
      ? getOrCreateSubfolder_(baseFolder, cleanDateIso_(payload.dateIso))
      : baseFolder;

    const fileName = buildFileName_(payload);
    const existing = destinationFolder.getFilesByName(fileName);

    if (existing.hasNext()) {
      return { file: existing.next(), duplicate: true };
    }

    const content = buildTxtContent_(payload);
    const file = destinationFolder.createFile(fileName, content, MimeType.PLAIN_TEXT);
    return { file: file, duplicate: false };
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSubfolder_(parent, dateIso) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : 'SIN_FECHA';
  const folders = parent.getFoldersByName(safeDate);
  return folders.hasNext() ? folders.next() : parent.createFolder(safeDate);
}

function buildFileName_(payload) {
  const dateIso = cleanDateIso_(payload.dateIso);
  const time = cleanText_(payload.time, 40)
    .replace(/:/g, '-')
    .replace(/\s+/g, '_');
  const reader = sanitizeFilePart_(payload.readerName, 45) || 'LECTOR';
  const code = sanitizeFilePart_(payload.code, 80) || 'SIN_CODIGO';
  const requestId = sanitizeFilePart_(payload.requestId, 80) || Utilities.getUuid();

  return `${dateIso}_${time}_${reader}_${code}_${requestId}.txt`;
}

function buildTxtContent_(payload) {
  const lines = [
    'REGISTRO DE LECTURA',
    '===================',
    `Código: ${cleanText_(payload.code, 500)}`,
    `Fecha: ${cleanText_(payload.date, 40)}`,
    `Hora: ${cleanText_(payload.time, 40)}`,
    `Lector: ${cleanText_(payload.readerName, 120)}`,
    `Identificador: ${cleanText_(payload.identifier, 160)}`,
    `Fecha ISO: ${cleanText_(payload.timestamp, 80)}`,
    `ID de lectura: ${cleanText_(payload.requestId, 120)}`,
    '',
  ];

  return lines.join('\r\n');
}

function cleanText_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength || 500);
}

function cleanDateIso_(value) {
  const text = cleanText_(value, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : 'SIN_FECHA';
}

function sanitizeFilePart_(value, maxLength) {
  return cleanText_(value, maxLength || 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^[_\.\-]+|[_\.\-]+$/g, '');
}

function postMessageResponse_(data) {
  const safeJson = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"></head>
  <body>
    <script>
      (function () {
        const message = ${safeJson};

        // Apps Script puede envolver la respuesta en más de un iframe.
        // Se envía el resultado tanto al iframe padre como a la página superior.
        try { window.parent.postMessage(message, '*'); } catch (error) {}
        try { window.top.postMessage(message, '*'); } catch (error) {}
      })();
    </script>
  </body>
</html>`;

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

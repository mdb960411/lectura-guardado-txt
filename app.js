'use strict';

const DB_NAME = 'lector-com-db';
const DB_VERSION = 1;
const STORE_NAME = 'lecturas';
const CLOUD_CONFIG_KEY = 'lector-com-drive-config-v1';
const CLOUD_MESSAGE_TYPE = 'drive-txt-result';

const state = {
  db: null,
  readers: new Map(),
  records: [],
  nextReaderNumber: 1,
  cloudConfig: { endpoint: '', apiKey: '', enabled: false },
  cloudRequests: new Map(),
};

const els = {
  compatibilityAlert: document.getElementById('compatibilityAlert'),
  addReaderBtn: document.getElementById('addReaderBtn'),
  readersGrid: document.getElementById('readersGrid'),
  readerTemplate: document.getElementById('readerTemplate'),
  readerCountBadge: document.getElementById('readerCountBadge'),
  connectedMetric: document.getElementById('connectedMetric'),
  todayMetric: document.getElementById('todayMetric'),
  totalMetric: document.getElementById('totalMetric'),
  lastMetric: document.getElementById('lastMetric'),
  pendingMetric: document.getElementById('pendingMetric'),
  searchInput: document.getElementById('searchInput'),
  dateFilter: document.getElementById('dateFilter'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  recordsBody: document.getElementById('recordsBody'),
  emptyState: document.getElementById('emptyState'),
  exportBtn: document.getElementById('exportBtn'),
  clearBtn: document.getElementById('clearBtn'),
  toast: document.getElementById('toast'),
  driveStatusBadge: document.getElementById('driveStatusBadge'),
  driveEndpointInput: document.getElementById('driveEndpointInput'),
  driveApiKeyInput: document.getElementById('driveApiKeyInput'),
  driveEnabledInput: document.getElementById('driveEnabledInput'),
  saveDriveConfigBtn: document.getElementById('saveDriveConfigBtn'),
  retryPendingBtn: document.getElementById('retryPendingBtn'),
  driveStatusText: document.getElementById('driveStatusText'),
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(record) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbClear() {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}


function loadCloudConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || '{}');
    state.cloudConfig = {
      endpoint: typeof saved.endpoint === 'string' ? saved.endpoint.trim() : '',
      apiKey: typeof saved.apiKey === 'string' ? saved.apiKey : '',
      enabled: Boolean(saved.enabled),
    };
  } catch (_) {
    state.cloudConfig = { endpoint: '', apiKey: '', enabled: false };
  }
}

function saveCloudConfig() {
  const endpoint = els.driveEndpointInput.value.trim();
  const apiKey = els.driveApiKeyInput.value;
  const enabled = els.driveEnabledInput.checked;

  if (enabled && (!endpoint || !endpoint.startsWith('https://script.google.com/'))) {
    showToast('Ingresa una URL válida de Apps Script terminada en /exec.', 'error');
    return;
  }

  if (enabled && !apiKey) {
    showToast('Ingresa la clave privada configurada en Code.gs.', 'error');
    return;
  }

  state.cloudConfig = { endpoint, apiKey, enabled };
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(state.cloudConfig));
  updateCloudUI();
  showToast(enabled ? 'Respaldo TXT en Drive activado.' : 'Configuración guardada. Drive está desactivado.');
}

function populateCloudConfigInputs() {
  els.driveEndpointInput.value = state.cloudConfig.endpoint;
  els.driveApiKeyInput.value = state.cloudConfig.apiKey;
  els.driveEnabledInput.checked = state.cloudConfig.enabled;
  updateCloudUI();
}

function cloudIsReady() {
  return Boolean(state.cloudConfig.enabled && state.cloudConfig.endpoint && state.cloudConfig.apiKey);
}

function updateCloudUI() {
  const ready = cloudIsReady();
  const pending = state.records.filter(record => ['pending', 'error'].includes(record.driveStatus)).length;
  const sending = state.records.filter(record => record.driveStatus === 'sending').length;

  els.pendingMetric.textContent = String(pending + sending);
  els.retryPendingBtn.disabled = !ready || pending === 0;

  if (!state.cloudConfig.enabled) {
    els.driveStatusBadge.textContent = 'Desactivado';
    els.driveStatusText.textContent = 'Las lecturas se guardan solo en este navegador.';
  } else if (!ready) {
    els.driveStatusBadge.textContent = 'Falta configurar';
    els.driveStatusText.textContent = 'Completa la URL de Apps Script y la clave privada.';
  } else if (sending > 0) {
    els.driveStatusBadge.textContent = `Enviando ${sending}`;
    els.driveStatusText.textContent = 'Se están creando archivos TXT independientes en Google Drive.';
  } else if (pending > 0) {
    els.driveStatusBadge.textContent = `${pending} pendiente${pending === 1 ? '' : 's'}`;
    els.driveStatusText.textContent = 'Hay lecturas pendientes. Presiona “Reenviar pendientes” cuando tengas conexión.';
  } else {
    els.driveStatusBadge.textContent = 'Activo';
    els.driveStatusText.textContent = 'Cada lectura se guardará como un TXT independiente en Google Drive.';
  }
}

function normalizeCloudStatus(record) {
  if (record.driveStatus) return record.driveStatus;
  return cloudIsReady() ? 'pending' : 'disabled';
}

function makeCloudPayload(record) {
  return {
    requestId: record.id,
    apiKey: state.cloudConfig.apiKey,
    timestamp: record.timestamp,
    date: record.date,
    dateIso: record.dateIso,
    time: record.time,
    code: record.code,
    readerName: record.readerName,
    identifier: record.identifier,
  };
}

function isAllowedAppsScriptOrigin(origin) {
  try {
    const host = new URL(origin).hostname;
    return host === 'script.google.com' || host.endsWith('.googleusercontent.com');
  } catch (_) {
    return false;
  }
}

function submitRecordToDrive(record) {
  return new Promise((resolve, reject) => {
    const requestId = record.id;
    const frameName = `drive-frame-${requestId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const input = document.createElement('input');

    iframe.name = frameName;
    iframe.className = 'hidden';
    iframe.setAttribute('aria-hidden', 'true');

    form.method = 'POST';
    form.action = state.cloudConfig.endpoint;
    form.target = frameName;
    form.className = 'hidden';

    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify(makeCloudPayload(record));
    form.appendChild(input);

    const cleanup = () => {
      window.setTimeout(() => {
        form.remove();
        iframe.remove();
      }, 100);
    };

    const timer = window.setTimeout(() => {
      state.cloudRequests.delete(requestId);
      cleanup();
      reject(new Error('Google Drive no respondió dentro del tiempo esperado.'));
    }, 20000);

    state.cloudRequests.set(requestId, { resolve, reject, cleanup, timer });
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
  });
}

async function sendRecordToDrive(record, showSuccessToast = false) {
  if (!cloudIsReady()) {
    record.driveStatus = 'disabled';
    await dbPut(record);
    updateCloudUI();
    return;
  }

  if (record.driveStatus === 'sending') return;
  record.driveStatus = 'sending';
  record.driveError = '';
  await dbPut(record);
  renderRecords();
  updateCloudUI();

  try {
    const result = await submitRecordToDrive(record);
    record.driveStatus = 'sent';
    record.driveFileName = result.fileName || '';
    record.driveFileUrl = result.fileUrl || '';
    record.driveError = '';
    record.driveSavedAt = new Date().toISOString();
    await dbPut(record);
    if (showSuccessToast) showToast(`TXT creado para el código ${record.code}.`);
  } catch (error) {
    console.error(error);
    record.driveStatus = 'error';
    record.driveError = error.message || 'No fue posible crear el TXT.';
    await dbPut(record);
    showToast(`Lectura local guardada, pero el TXT quedó pendiente: ${record.code}.`, 'error');
  }

  renderRecords();
  updateMetrics();
  updateCloudUI();
}

async function retryPendingRecords() {
  if (!cloudIsReady()) {
    showToast('Configura y activa Google Drive antes de reenviar.', 'error');
    return;
  }

  const pending = state.records.filter(record => ['pending', 'error', 'disabled'].includes(record.driveStatus));
  if (!pending.length) {
    showToast('No hay lecturas pendientes.');
    return;
  }

  els.retryPendingBtn.disabled = true;
  for (const record of pending) {
    await sendRecordToDrive(record, false);
  }
  showToast('Proceso de reenvío finalizado.');
}

function cloudStatusBadge(record) {
  const status = normalizeCloudStatus(record);
  const labels = {
    sent: ['Guardado', 'cloud-sent'],
    sending: ['Enviando', 'cloud-sending'],
    pending: ['Pendiente', 'cloud-pending'],
    error: ['Error', 'cloud-error'],
    disabled: ['Local', 'cloud-disabled'],
  };
  const [label, cssClass] = labels[status] || labels.disabled;
  const title = record.driveError ? ` title="${escapeHtml(record.driveError)}"` : '';
  return `<span class="cloud-badge ${cssClass}"${title}>${label}</span>`;
}

window.addEventListener('message', event => {
  if (!isAllowedAppsScriptOrigin(event.origin)) return;
  const data = event.data;
  if (!data || data.type !== CLOUD_MESSAGE_TYPE || !data.requestId) return;

  const pending = state.cloudRequests.get(data.requestId);
  if (!pending) return;

  window.clearTimeout(pending.timer);
  state.cloudRequests.delete(data.requestId);
  pending.cleanup();

  if (data.success) pending.resolve(data);
  else pending.reject(new Error(data.error || 'Apps Script no pudo crear el archivo TXT.'));
});

function showToast(message, type = 'normal') {
  els.toast.textContent = message;
  els.toast.classList.toggle('error', type === 'error');
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2800);
}

function makeReaderId() {
  return `reader-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addReaderCard() {
  const id = makeReaderId();
  const fragment = els.readerTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.reader-card');
  const defaultName = `Pistola ${state.nextReaderNumber++}`;

  card.dataset.readerId = id;
  card.querySelector('.reader-title').textContent = defaultName;
  card.querySelector('.reader-name').value = defaultName;

  const reader = {
    id,
    card,
    port: null,
    reader: null,
    pipePromise: null,
    buffer: '',
    flushTimer: null,
    connected: false,
    stopping: false,
    identifier: `Lector ${state.readers.size + 1}`,
  };

  state.readers.set(id, reader);
  bindReaderEvents(reader);
  els.readersGrid.appendChild(fragment);
  updateReaderCounters();
}

function bindReaderEvents(reader) {
  const card = reader.card;
  const nameInput = card.querySelector('.reader-name');
  const connectBtn = card.querySelector('.connect-btn');
  const disconnectBtn = card.querySelector('.disconnect-btn');
  const removeBtn = card.querySelector('.remove-reader-btn');

  nameInput.addEventListener('input', () => {
    card.querySelector('.reader-title').textContent = nameInput.value.trim() || 'Pistola';
  });

  connectBtn.addEventListener('click', () => connectReader(reader));
  disconnectBtn.addEventListener('click', () => disconnectReader(reader));
  removeBtn.addEventListener('click', async () => {
    if (reader.connected) await disconnectReader(reader);
    state.readers.delete(reader.id);
    card.remove();
    updateReaderCounters();
    if (state.readers.size === 0) addReaderCard();
  });
}

async function connectReader(reader) {
  if (!('serial' in navigator)) {
    showToast('Este navegador no permite conexión Web Serial.', 'error');
    return;
  }

  const card = reader.card;
  const baudRate = Number(card.querySelector('.reader-baud').value);
  const connectBtn = card.querySelector('.connect-btn');

  connectBtn.disabled = true;
  connectBtn.textContent = 'Solicitando puerto...';

  try {
    const port = await navigator.serial.requestPort();

    for (const other of state.readers.values()) {
      if (other !== reader && other.port === port && other.connected) {
        throw new Error('Ese puerto ya está conectado en otra tarjeta.');
      }
    }

    await port.open({
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
    });

    const info = port.getInfo ? port.getInfo() : {};
    const vendor = info.usbVendorId ? info.usbVendorId.toString(16).toUpperCase().padStart(4, '0') : 'N/D';
    const product = info.usbProductId ? info.usbProductId.toString(16).toUpperCase().padStart(4, '0') : 'N/D';

    reader.port = port;
    reader.connected = true;
    reader.stopping = false;
    reader.identifier = `USB ${vendor}:${product}`;

    setReaderConnectedUI(reader, true);
    updateReaderCounters();
    showToast(`${getReaderName(reader)} conectado correctamente.`);

    readFromPort(reader).catch(error => {
      if (!reader.stopping) {
        console.error(error);
        showToast(`Se perdió la conexión con ${getReaderName(reader)}.`, 'error');
        forceReaderDisconnected(reader);
      }
    });
  } catch (error) {
    console.error(error);
    showToast(error.message || 'No fue posible abrir el puerto COM.', 'error');
  } finally {
    connectBtn.disabled = false;
    connectBtn.textContent = 'Seleccionar puerto COM';
  }
}

async function readFromPort(reader) {
  const decoder = new TextDecoderStream();
  reader.pipePromise = reader.port.readable.pipeTo(decoder.writable).catch(() => {});
  reader.reader = decoder.readable.getReader();

  try {
    while (reader.connected && !reader.stopping) {
      const { value, done } = await reader.reader.read();
      if (done) break;
      if (value) consumeSerialChunk(reader, value);
    }
  } finally {
    try { reader.reader.releaseLock(); } catch (_) {}
    reader.reader = null;
  }
}

function consumeSerialChunk(reader, chunk) {
  reader.buffer += chunk;

  const parts = reader.buffer.split(/\r\n|\n|\r/);
  reader.buffer = parts.pop() || '';

  for (const part of parts) {
    saveCodeFromReader(reader, part);
  }

  window.clearTimeout(reader.flushTimer);
  reader.flushTimer = window.setTimeout(() => {
    if (reader.buffer.trim()) {
      const pending = reader.buffer;
      reader.buffer = '';
      saveCodeFromReader(reader, pending);
    }
  }, 140);
}

async function saveCodeFromReader(reader, rawCode) {
  const code = String(rawCode).replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!code) return;

  const now = new Date();
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    timestamp: now.toISOString(),
    date: formatDate(now),
    dateIso: toLocalDateIso(now),
    time: formatTime(now),
    code,
    readerName: getReaderName(reader),
    identifier: reader.identifier,
    driveStatus: cloudIsReady() ? 'pending' : 'disabled',
    driveFileName: '',
    driveFileUrl: '',
    driveError: '',
  };

  await dbPut(record);
  state.records.unshift(record);

  reader.card.querySelector('.reader-last').textContent = `Última: ${record.time}`;
  renderRecords();
  updateMetrics();
  updateCloudUI();
  showToast(`Código ${code} registrado por ${record.readerName}.`);

  if (cloudIsReady()) {
    void sendRecordToDrive(record, false);
  }
}

async function disconnectReader(reader) {
  if (!reader.port) return;
  reader.stopping = true;
  reader.connected = false;
  window.clearTimeout(reader.flushTimer);

  try { await reader.reader?.cancel(); } catch (_) {}
  try { reader.reader?.releaseLock(); } catch (_) {}
  try { await reader.pipePromise; } catch (_) {}
  try { await reader.port.close(); } catch (error) { console.warn(error); }

  reader.reader = null;
  reader.pipePromise = null;
  reader.port = null;
  reader.buffer = '';
  reader.identifier = 'Sin puerto asignado';
  reader.stopping = false;

  setReaderConnectedUI(reader, false);
  updateReaderCounters();
  showToast(`${getReaderName(reader)} desconectado.`);
}

function forceReaderDisconnected(reader) {
  reader.connected = false;
  reader.stopping = false;
  reader.port = null;
  reader.reader = null;
  reader.pipePromise = null;
  reader.buffer = '';
  reader.identifier = 'Sin puerto asignado';
  setReaderConnectedUI(reader, false);
  updateReaderCounters();
}

function setReaderConnectedUI(reader, connected) {
  const card = reader.card;
  card.classList.toggle('connected', connected);
  card.querySelector('.reader-status').textContent = connected ? 'Conectada y escuchando' : 'Desconectada';
  card.querySelector('.reader-id').textContent = connected ? reader.identifier : 'Sin puerto asignado';
  card.querySelector('.connect-btn').classList.toggle('hidden', connected);
  card.querySelector('.disconnect-btn').classList.toggle('hidden', !connected);
  card.querySelector('.reader-baud').disabled = connected;
}

function getReaderName(reader) {
  return reader.card.querySelector('.reader-name').value.trim() || 'Pistola sin nombre';
}

function updateReaderCounters() {
  const total = state.readers.size;
  const connected = [...state.readers.values()].filter(item => item.connected).length;
  els.readerCountBadge.textContent = `${total} ${total === 1 ? 'lector' : 'lectores'}`;
  els.connectedMetric.textContent = String(connected);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(date);
}

function formatTime(date) {
  const base = new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(date);
  return `${base}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

function toLocalDateIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFilteredRecords() {
  const query = els.searchInput.value.trim().toLowerCase();
  const date = els.dateFilter.value;
  return state.records.filter(record => {
    const matchesQuery = !query || record.code.toLowerCase().includes(query) || record.readerName.toLowerCase().includes(query);
    const matchesDate = !date || record.dateIso === date;
    return matchesQuery && matchesDate;
  });
}

function renderRecords() {
  const records = getFilteredRecords();
  els.recordsBody.replaceChildren();

  for (const record of records) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.time)}</td>
      <td class="code-cell">${escapeHtml(record.code)}</td>
      <td>${escapeHtml(record.readerName)}</td>
      <td>${escapeHtml(record.identifier)}</td>
      <td>${cloudStatusBadge(record)}</td>
      <td><button class="row-delete" type="button" data-id="${escapeHtml(record.id)}">Eliminar</button></td>
    `;
    els.recordsBody.appendChild(row);
  }

  els.emptyState.classList.toggle('hidden', records.length > 0);
  els.recordsBody.parentElement.classList.toggle('hidden', records.length === 0);

  els.recordsBody.querySelectorAll('.row-delete').forEach(button => {
    button.addEventListener('click', async () => {
      await dbDelete(button.dataset.id);
      state.records = state.records.filter(item => item.id !== button.dataset.id);
      renderRecords();
      updateMetrics();
    });
  });
}

function updateMetrics() {
  const today = toLocalDateIso(new Date());
  const todayCount = state.records.filter(record => record.dateIso === today).length;
  els.todayMetric.textContent = String(todayCount);
  els.totalMetric.textContent = String(state.records.length);
  els.lastMetric.textContent = state.records.length ? `${state.records[0].time} · ${state.records[0].code}` : 'Sin lecturas';
  const pending = state.records.filter(record => ['pending', 'error', 'sending'].includes(record.driveStatus)).length;
  els.pendingMetric.textContent = String(pending);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function exportCsv() {
  const records = getFilteredRecords();
  if (!records.length) {
    showToast('No hay registros para exportar.', 'error');
    return;
  }

  const rows = [
    ['Fecha', 'Hora', 'Código', 'Pistola', 'Identificador'],
    ...records.map(record => [record.date, record.time, record.code, record.readerName, record.identifier]),
  ];

  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lecturas_com_${toLocalDateIso(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '').replaceAll('"', '""');
  return `"${text}"`;
}

async function clearAllRecords() {
  if (!state.records.length) return;
  const confirmed = window.confirm('¿Seguro que deseas borrar todos los registros guardados en este navegador?');
  if (!confirmed) return;
  await dbClear();
  state.records = [];
  renderRecords();
  updateMetrics();
  showToast('Todos los registros fueron eliminados.');
}

function setupCompatibilityMessage() {
  if (!window.isSecureContext) {
    els.compatibilityAlert.textContent = 'La conexión COM necesita una página HTTPS. Publica estos archivos con GitHub Pages y abre la dirección publicada.';
    els.compatibilityAlert.classList.remove('hidden');
  } else if (!('serial' in navigator)) {
    els.compatibilityAlert.textContent = 'Este navegador no ofrece Web Serial. Abre la aplicación con Microsoft Edge o Google Chrome actualizado.';
    els.compatibilityAlert.classList.remove('hidden');
  }
}

async function init() {
  setupCompatibilityMessage();
  loadCloudConfig();

  try {
    state.db = await openDatabase();
    state.records = (await dbGetAll())
      .map(record => ({
        ...record,
        driveStatus: record.driveStatus || 'disabled',
        driveFileName: record.driveFileName || '',
        driveFileUrl: record.driveFileUrl || '',
        driveError: record.driveError || '',
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (error) {
    console.error(error);
    showToast('No fue posible abrir el almacenamiento local.', 'error');
  }

  populateCloudConfigInputs();
  addReaderCard();
  addReaderCard();
  renderRecords();
  updateMetrics();
  updateReaderCounters();

  els.addReaderBtn.addEventListener('click', addReaderCard);
  els.searchInput.addEventListener('input', renderRecords);
  els.dateFilter.addEventListener('change', renderRecords);
  els.resetFiltersBtn.addEventListener('click', () => {
    els.searchInput.value = '';
    els.dateFilter.value = '';
    renderRecords();
  });
  els.exportBtn.addEventListener('click', exportCsv);
  els.clearBtn.addEventListener('click', clearAllRecords);
  els.saveDriveConfigBtn.addEventListener('click', saveCloudConfig);
  els.retryPendingBtn.addEventListener('click', retryPendingRecords);

  navigator.serial?.addEventListener('disconnect', event => {
    for (const reader of state.readers.values()) {
      if (reader.port === event.target) {
        showToast(`${getReaderName(reader)} fue desconectado físicamente.`, 'error');
        forceReaderDisconnected(reader);
      }
    }
  });
}

window.addEventListener('beforeunload', () => {
  for (const reader of state.readers.values()) {
    try { reader.reader?.cancel(); } catch (_) {}
    try { reader.port?.close(); } catch (_) {}
  }
});

init();

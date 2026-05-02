// db.js
const DB_NAME = 'MahjongSheetDB';
const DB_VERSION = 2;

const RECORD_STORE = 'game_records';
const META_STORE = 'month_sync_meta';

function getActiveSheetId() {
    return sessionStorage.getItem('currentSheetId') || '';
}

export function getCurrentYearMonth(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getSheetMonthKey(sheetId, yearMonth) {
    return `${sheetId}::${yearMonth}`;
}

function normalizeSyncMillis(record) {
    const uploadTimeFromStr = record.uploadTimeStr ? new Date(record.uploadTimeStr).getTime() : 0;
    return Number(
        record.updatedAtMillis ??
        record.modifiedTime ??
        record.uploadTime ??
        uploadTimeFromStr ??
        0
    );
}

function normalizeRecordForCache(record, sheetId) {
    const normalizedSheetId = record.sheetId || sheetId || getActiveSheetId();
    const uploadTime =
        Number(record.uploadTime) ||
        (record.uploadTimeStr ? new Date(record.uploadTimeStr).getTime() : Date.now());

    const yearMonth =
        record.yearMonth ||
        (record.uploadTimeStr ? record.uploadTimeStr.substring(0, 7) : getCurrentYearMonth(new Date(uploadTime)));

    const isDeleted = record.isDeleted ?? record.deleted ?? record.status === 'DELETED';

    return {
        ...record,
        sheetId: normalizedSheetId,
        uploadTime,
        yearMonth,
        updatedAtMillis: normalizeSyncMillis(record),
        isDeleted,
        deleted: isDeleted,
        status: isDeleted ? 'DELETED' : (record.status || 'SUCCESS'),
        sheetMonthKey: getSheetMonthKey(normalizedSheetId, yearMonth)
    };
}

export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => reject(`IndexedDB 에러: ${event.target.error}`);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            let recordStore;
            if (!db.objectStoreNames.contains(RECORD_STORE)) {
                recordStore = db.createObjectStore(RECORD_STORE, { keyPath: 'uuid' });
                recordStore.createIndex('uploadTime', 'uploadTime', { unique: false });
                recordStore.createIndex('yearMonth', 'yearMonth', { unique: false });
            } else {
                recordStore = event.target.transaction.objectStore(RECORD_STORE);
            }

            if (!recordStore.indexNames.contains('sheetId')) {
                recordStore.createIndex('sheetId', 'sheetId', { unique: false });
            }
            if (!recordStore.indexNames.contains('sheetMonthKey')) {
                recordStore.createIndex('sheetMonthKey', 'sheetMonthKey', { unique: false });
            }
            if (!recordStore.indexNames.contains('updatedAtMillis')) {
                recordStore.createIndex('updatedAtMillis', 'updatedAtMillis', { unique: false });
            }

            if (!db.objectStoreNames.contains(META_STORE)) {
                const metaStore = db.createObjectStore(META_STORE, { keyPath: 'key' });
                metaStore.createIndex('sheetId', 'sheetId', { unique: false });
                metaStore.createIndex('sheetMonthKey', 'sheetMonthKey', { unique: true });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
    });
}

export async function saveRecords(records, sheetId = getActiveSheetId()) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([RECORD_STORE], 'readwrite');
        const store = transaction.objectStore(RECORD_STORE);

        records.forEach(record => {
            store.put(normalizeRecordForCache(record, sheetId));
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

export async function getRecordsBySheetMonth(sheetId, yearMonth) {
    const db = await openDB();
    const key = getSheetMonthKey(sheetId, yearMonth);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([RECORD_STORE], 'readonly');
        const store = transaction.objectStore(RECORD_STORE);
        const index = store.index('sheetMonthKey');
        const request = index.getAll(key);

        request.onsuccess = () => {
            const rows = (request.result || [])
                .map(row => normalizeRecordForCache(row, row.sheetId || sheetId))
                .sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0));
            resolve(rows);
        };

        request.onerror = (event) => reject(event.target.error);
    });
}

// 기존 코드 호환용: 현재 sheet + 현재 month만 반환
export async function getAllRecords() {
    const sheetId = getActiveSheetId();
    if (!sheetId) return [];
    return getRecordsBySheetMonth(sheetId, getCurrentYearMonth());
}

export async function updateRecordStatus(uuid, newStatus, editor = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([RECORD_STORE], 'readwrite');
        const store = transaction.objectStore(RECORD_STORE);
        const request = store.get(uuid);

        request.onsuccess = (event) => {
            const data = event.target.result;
            if (!data) {
                resolve(false);
                return;
            }

            const isDeleted = newStatus === 'DELETED';
            data.status = isDeleted ? 'DELETED' : 'SUCCESS';
            data.isDeleted = isDeleted;
            data.deleted = isDeleted;
            data.updatedAtMillis = Date.now();
            if (editor) {
                data.editor = editor;
            }

            const updateReq = store.put(data);
            updateReq.onsuccess = () => resolve(true);
            updateReq.onerror = () => reject(updateReq.error);
        };

        request.onerror = (event) => reject(event.target.error);
    });
}

export async function replaceMonthRecords(sheetId, yearMonth, records) {
    const db = await openDB();
    const key = getSheetMonthKey(sheetId, yearMonth);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([RECORD_STORE], 'readwrite');
        const store = transaction.objectStore(RECORD_STORE);
        const index = store.index('sheetMonthKey');

        const cursorRequest = index.openCursor(IDBKeyRange.only(key));

        cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
                return;
            }

            records.forEach(record => {
                store.put(normalizeRecordForCache(record, sheetId));
            });
        };

        cursorRequest.onerror = (event) => reject(event.target.error);
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

// 기존 코드 호환용: 현재 sheet + 현재 month만 교체
export async function replaceAllRecords(records) {
    const sheetId = getActiveSheetId();
    if (!sheetId) return;
    return replaceMonthRecords(sheetId, getCurrentYearMonth(), records);
}

export async function getMonthSyncMeta(sheetId, yearMonth) {
    const db = await openDB();
    const key = getSheetMonthKey(sheetId, yearMonth);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([META_STORE], 'readonly');
        const store = transaction.objectStore(META_STORE);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (event) => reject(event.target.error);
    });
}

export async function saveMonthSyncMeta(meta) {
    const db = await openDB();

    const normalized = {
        key: getSheetMonthKey(meta.sheetId, meta.yearMonth),
        sheetId: meta.sheetId,
        yearMonth: meta.yearMonth,
        sheetMonthKey: getSheetMonthKey(meta.sheetId, meta.yearMonth),
        isFullyLoaded: Boolean(meta.isFullyLoaded),
        lastSyncedAtMillis: Number(meta.lastSyncedAtMillis || 0),
        lastServerUpdatedAtMillis: Number(meta.lastServerUpdatedAtMillis || 0),
        recordCount: Number(meta.recordCount || 0),
        loadedAt: Number(meta.loadedAt || Date.now())
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([META_STORE], 'readwrite');
        const store = transaction.objectStore(META_STORE);
        const request = store.put(normalized);

        request.onsuccess = () => resolve(normalized);
        request.onerror = (event) => reject(event.target.error);
    });
}
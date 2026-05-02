// api.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    orderBy,
    where,
    setDoc,
    updateDoc,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let authMode = "user";
let sheetId = null;
let apiKey = null;

const firebaseConfig = {
  apiKey: "AIzaSyBzuI8NJ03uRTy5OOF7QycZXcnqSAcUwwA",
  authDomain: "mahjongs-e07d3.firebaseapp.com",
  projectId: "mahjongs-e07d3",
  storageBucket: "mahjongs-e07d3.firebasestorage.app",
  messagingSenderId: "727926338004",
  appId: "1:727926338004:web:bafdd323d03a5fbbeea641",
  measurementId: "G-VS26P9GFR5"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export function setApiConfig(newAuthMode, newSheetId = null, newApiKey = null) {
    authMode = newAuthMode || "user";
    sheetId = newSheetId || null;
    apiKey = newApiKey || null;
}

export class TokenExpiredError extends Error {
    constructor(message) {
        super(message);
        this.name = "TokenExpiredError";
    }
}

function requireSheetId() {
    if (!sheetId) throw new Error("시트 ID가 없습니다.");
}

function requireWritePermission() {
    if (authMode === "guest") {
        throw new Error("게스트 모드에서는 데이터를 수정할 수 없습니다.");
    }
    if (!auth.currentUser) {
        throw new TokenExpiredError("로그인 정보가 없습니다.");
    }
}

function getCurrentYearMonth(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getSheetRef() {
    return doc(db, "sheets", sheetId);
}

function getSettingsRef() {
    return doc(db, "sheets", sheetId, "settings", "current");
}

function getMonthRef(yearMonth) {
    return doc(db, "sheets", sheetId, "months", yearMonth);
}

function getRecordRef(yearMonth, uuid) {
    return doc(db, "sheets", sheetId, "months", yearMonth, "records", uuid);
}

function normalizeStatusForCell(statusValue) {
    return statusValue === "DELETED" ? "DELETED" : "";
}

function parseTimeToMillis(uploadTimeStr) {
    if (!uploadTimeStr) return Date.now();
    const parsed = new Date(uploadTimeStr).getTime();
    return Number.isNaN(parsed) ? Date.now() : parsed;
}

function parseYearMonth(uploadTimeStr) {
    if (!uploadTimeStr || uploadTimeStr.length < 7) {
        return getCurrentYearMonth();
    }
    return uploadTimeStr.substring(0, 7);
}

function formatMillisToSheetString(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
}

function getRecordSyncMillis(record) {
    return Number(
        record.updatedAtMillis ??
        record.modifiedTime ??
        record.uploadTime ??
        parseTimeToMillis(record.uploadTimeStr) ??
        0
    );
}

function normalizeRecordDoc(raw, docId = null) {
    const uploadTimeStr = raw.uploadTimeStr || formatMillisToSheetString(raw.uploadTime);
    const uploadTime = Number(raw.uploadTime ?? parseTimeToMillis(uploadTimeStr));
    const modifiedTime = raw.modifiedTime ?? (raw.updateTimeStr ? parseTimeToMillis(raw.updateTimeStr) : null);
    const deleted = raw.deleted ?? raw.isDeleted ?? raw.status === "DELETED";
    const yearMonth = raw.yearMonth || parseYearMonth(uploadTimeStr);
    const resolvedSheetId = raw.sheetId || sheetId || "";

    return {
        ...raw,
        uuid: raw.uuid || docId || crypto.randomUUID(),
        sheetId: resolvedSheetId,
        uploadTimeStr,
        uploadTime,
        modifiedTime,
        yearMonth,
        updatedAtMillis: Number(raw.updatedAtMillis ?? modifiedTime ?? uploadTime),
        deleted,
        status: deleted ? "DELETED" : (raw.status || "SUCCESS"),
        updateTimeStr: raw.updateTimeStr || (modifiedTime ? formatMillisToSheetString(modifiedTime) : "")
    };
}

function normalizeMonthMeta(raw, yearMonth) {
    if (!raw) return null;
    return {
        ym: raw.ym || yearMonth,
        recordCount: Number(raw.recordCount || 0),
        lastSeqNo: Number(raw.lastSeqNo || 0),
        updatedAtMillis: Number(raw.updatedAtMillis || 0)
    };
}

async function fetchSettingsDoc() {
    requireSheetId();
    const snap = await getDoc(getSettingsRef());
    if (!snap.exists()) return null;
    return snap.data();
}

export async function fetchSheetNicknames() {
    requireSheetId();

    const snap = await getDoc(getSheetRef());
    if (!snap.exists()) return [];

    const data = snap.data() || {};
    return Array.from(
        new Set(
            (data.memberNames || [])
                .map(v => (v || "").trim())
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));
}

export async function fetchMonthMeta(yearMonth = getCurrentYearMonth()) {
    requireSheetId();
    const snap = await getDoc(getMonthRef(yearMonth));
    if (!snap.exists()) return null;
    return normalizeMonthMeta(snap.data(), yearMonth);
}

export async function fetchMonthRecordsFull(yearMonth = getCurrentYearMonth()) {
    requireSheetId();

    const recordsQuery = query(
        collection(db, "sheets", sheetId, "months", yearMonth, "records"),
        orderBy("uploadTime", "asc")
    );

    const recordsSnap = await getDocs(recordsQuery);
    return recordsSnap.docs.map(docSnap => normalizeRecordDoc(docSnap.data(), docSnap.id));
}

async function runChangedQuery(recordCollection, fieldName, sinceMillis, mergedMap) {
    try {
        const q = query(
            recordCollection,
            where(fieldName, ">", sinceMillis),
            orderBy(fieldName)
        );
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
            mergedMap.set(docSnap.id, normalizeRecordDoc(docSnap.data(), docSnap.id));
        });
    } catch (e) {
        console.warn(`⚠️ 변경분 조회 fallback 실패 (${fieldName}):`, e.message);
    }
}

export async function fetchMonthRecordChanges(yearMonth = getCurrentYearMonth(), sinceMillis = 0) {
    requireSheetId();

    if (!sinceMillis || sinceMillis <= 0) {
        return fetchMonthRecordsFull(yearMonth);
    }

    const recordCollection = collection(db, "sheets", sheetId, "months", yearMonth, "records");
    const mergedMap = new Map();

    await runChangedQuery(recordCollection, "updatedAtMillis", sinceMillis, mergedMap);
    await runChangedQuery(recordCollection, "modifiedTime", sinceMillis, mergedMap);
    await runChangedQuery(recordCollection, "uploadTime", sinceMillis, mergedMap);

    return Array.from(mergedMap.values())
        .filter(record => getRecordSyncMillis(record) > sinceMillis)
        .sort((a, b) => getRecordSyncMillis(a) - getRecordSyncMillis(b));
}

function toSettingRows(settings) {
    if (!settings) return { values: [] };

    return {
        values: [
            ["라스트넘버", String(settings.lastNo ?? "")],
            ["총점", String(settings.totalScore ?? 100000)],
            ["게임타입", String(settings.gameType ?? 4)],
            ["우마1", String(settings.uma?.[0] ?? 20)],
            ["우마2", String(settings.uma?.[1] ?? 10)],
            ["우마3", String(settings.uma?.[2] ?? -10)],
            ["우마4", String(settings.uma?.[3] ?? -20)],
            ["2/3인 사용", String(settings.use23Player ?? false).toUpperCase()],
            ["삼마 우마1", String(settings.uma3?.[0] ?? 20)],
            ["삼마 우마2", String(settings.uma3?.[1] ?? 0)],
            ["삼마 우마3", String(settings.uma3?.[2] ?? -20)],
            ["두마 우마1", String(settings.uma2?.[0] ?? 20)],
            ["두마 우마2", String(settings.uma2?.[1] ?? -20)]
        ]
    };
}

function toListRows(records, requestedRange) {
    const header = [
        "UUID", "No", "UploadTime", "GameType", "GameLength",
        "P1Name", "P1Score", "P2Name", "P2Score",
        "P3Name", "P3Score", "P4Name", "P4Score",
        "Deposit", "Status", "UpdateTime"
    ];

    const fullRows = records.map((r) => [
        r.uuid || "",
        r.seqNo ?? "",
        r.uploadTimeStr || formatMillisToSheetString(r.uploadTime),
        r.gameType ?? 4,
        r.gameLength ?? 2,
        r.p1Name || "",
        r.p1Score ?? 0,
        r.p2Name || "",
        r.p2Score ?? 0,
        r.p3Name || "",
        r.p3Score ?? 0,
        r.p4Name || "",
        r.p4Score ?? 0,
        r.deposit ?? 0,
        normalizeStatusForCell(r.status),
        r.updateTimeStr || (r.modifiedTime ? formatMillisToSheetString(r.modifiedTime) : "")
    ]);

    if (requestedRange === "list!A:A") {
        return { values: [["UUID"], ...fullRows.map(row => [row[0]])] };
    }

    if (requestedRange === "list!A:O") {
        return { values: [header.slice(0, 15), ...fullRows.map(row => row.slice(0, 15))] };
    }

    if (requestedRange === "list!A:P") {
        return { values: [header, ...fullRows] };
    }

    return { values: [header, ...fullRows] };
}

function extractNicknamesFromRecord(record) {
    return [
        record.p1Name,
        record.p2Name,
        record.p3Name,
        record.p4Name
    ]
        .map(v => (v || "").trim())
        .filter(Boolean);
}

function mergeUniqueNames(base = [], extra = []) {
    return Array.from(
        new Set([
            ...base.map(v => (v || "").trim()).filter(Boolean),
            ...extra.map(v => (v || "").trim()).filter(Boolean)
        ])
    );
}

function rowDataToRecord(rowData) {
    const uploadTimeStr = rowData[2] || formatMillisToSheetString(Date.now());
    const updateTimeStr = rowData[15] || "";

    return normalizeRecordDoc({
        uuid: rowData[0] || crypto.randomUUID(),
        sheetId, // 추가
        seqNo: parseInt(rowData[1]) || null,
        uploadTimeStr,
        uploadTime: parseTimeToMillis(uploadTimeStr),
        yearMonth: parseYearMonth(uploadTimeStr),
        gameType: parseInt(rowData[3]) || 4,
        gameLength: parseInt(rowData[4]) || 2,
        p1Name: rowData[5] || "",
        p1Score: parseInt(rowData[6]) || 0,
        p2Name: rowData[7] || "",
        p2Score: parseInt(rowData[8]) || 0,
        p3Name: rowData[9] || "",
        p3Score: parseInt(rowData[10]) || 0,
        p4Name: rowData[11] || "",
        p4Score: parseInt(rowData[12]) || 0,
        deposit: parseInt(rowData[13]) || 0,
        status: rowData[14] === "DELETED" ? "DELETED" : "SUCCESS",
        updateTimeStr,
        modifiedTime: updateTimeStr ? parseTimeToMillis(updateTimeStr) : null
    });
}

async function findRecordByUuidInCurrentMonth(uuid, yearMonth = getCurrentYearMonth()) {
    const rows = await fetchMonthRecordsFull(yearMonth);
    return rows.find(item => item.uuid === uuid) || null;
}

async function upsertRecordAndMeta(record, isNewInsert = false) {
    requireSheetId();

    const now = Date.now();
    const yearMonth = record.yearMonth || parseYearMonth(record.uploadTimeStr);

    const recordRef = getRecordRef(yearMonth, record.uuid);
    const monthRef = getMonthRef(yearMonth);
    const settingsRef = getSettingsRef();
    const sheetRef = getSheetRef();

    const normalized = normalizeRecordDoc({
        ...record,
        yearMonth,
        updatedAtMillis: now,
        modifiedTime: isNewInsert ? null : now,
        updateTimeStr: isNewInsert ? "" : formatMillisToSheetString(now)
    });

    await runTransaction(db, async (tx) => {
        const recordSnap = await tx.get(recordRef);
        const monthSnap = await tx.get(monthRef);
        const settingsSnap = await tx.get(settingsRef);

        const currentMonth = monthSnap.exists()
            ? monthSnap.data()
            : { ym: yearMonth, recordCount: 0, lastSeqNo: 0, updatedAtMillis: 0 };

        const currentSettings = settingsSnap.exists()
            ? settingsSnap.data()
            : {
                lastNo: 0,
                totalScore: 100000,
                gameType: 4,
                uma: [20, 10, -10, -20],
                use23Player: false,
                uma3: [20, 0, -20],
                uma2: [20, -20]
            };

        const nextRecordCount =
            isNewInsert && !recordSnap.exists()
                ? (currentMonth.recordCount || 0) + 1
                : (currentMonth.recordCount || 0);


        const sheetSnap = await tx.get(sheetRef);

        const currentSheet = sheetSnap.exists() ? sheetSnap.data() : {};
        const mergedMemberNames = mergeUniqueNames(
            currentSheet.memberNames || [],
            extractNicknamesFromRecord(normalized)
        );
        tx.set(recordRef, {
            ...normalized,
            sheetId,
            deleted: normalized.status === "DELETED"
        });

        tx.set(monthRef, {
            ym: yearMonth,
            recordCount: nextRecordCount,
            lastSeqNo: Math.max(currentMonth.lastSeqNo || 0, normalized.seqNo || 0),
            updatedAtMillis: now
        }, { merge: true });

        tx.set(settingsRef, {
            ...currentSettings,
            lastNo: Math.max(currentSettings.lastNo || 0, normalized.seqNo || 0)
        }, { merge: true });

        tx.set(sheetRef, {
            memberNames: mergedMemberNames,
            membersUpdatedAt: now,
            recordsUpdatedAt: now,
            updatedAt: now
        }, { merge: true });
    });

    return normalized;
}

export async function fetchSheet(range) {
    requireSheetId();

    if (range === "setting!A:B") {
        const settings = await fetchSettingsDoc();
        return toSettingRows(settings);
    }

    if (range === "setting!B1") {
        const settings = await fetchSettingsDoc();
        return { values: [[String(settings?.lastNo ?? 0)]] };
    }

    if (range === "list!A:A" || range === "list!A:O" || range === "list!A:P") {
        const currentMonth = getCurrentYearMonth();
        const records = await fetchMonthRecordsFull(currentMonth);
        return toListRows(records, range);
    }

    throw new Error(`지원하지 않는 fetchSheet 범위입니다: ${range}`);
}

export async function callSheetsAPI(range, method = 'GET', body = null) {
    requireSheetId();
    requireWritePermission();

    const currentMonth = getCurrentYearMonth();

    if (method === "APPEND" && range === "list!A:P") {
        const rowData = body?.values?.[0];
        if (!rowData) throw new Error("APPEND body가 비어 있습니다.");

        const record = rowDataToRecord(rowData);
        await upsertRecordAndMeta(record, true);

        return { updates: { updatedRange: range } };
    }

    if (method === "PUT" && range === "setting!B1") {
        const newLastNo = parseInt(body?.values?.[0]?.[0]) || 0;
        const settingsRef = getSettingsRef();
        const settingsSnap = await getDoc(settingsRef);
        const currentSettings = settingsSnap.exists()
            ? settingsSnap.data()
            : {
                totalScore: 100000,
                gameType: 4,
                uma: [20, 10, -10, -20],
                use23Player: false,
                uma3: [20, 0, -20],
                uma2: [20, -20]
            };

        await setDoc(settingsRef, {
            ...currentSettings,
            lastNo: newLastNo
        }, { merge: true });

        return { updates: { updatedRange: range } };
    }

    const fullRowMatch = range.match(/^list!A(\d+):P\1$/);
    if (method === "PUT" && fullRowMatch) {
        const rowData = body?.values?.[0];
        if (!rowData) throw new Error("PUT body가 비어 있습니다.");

        const record = rowDataToRecord(rowData);
        await upsertRecordAndMeta(record, false);

        return { updates: { updatedRange: range } };
    }

    const statusCellMatch = range.match(/^list!O(\d+)$/);
    if (method === "PUT" && statusCellMatch) {
        const targetRow = parseInt(statusCellMatch[1], 10);

        const data = await fetchSheet("list!A:A");
        const rows = data.values || [];
        const targetUuid = rows[targetRow - 1]?.[0];

        if (!targetUuid) {
            throw new Error(`해당 행의 기록을 찾을 수 없습니다. row=${targetRow}`);
        }

        const targetRecord = await findRecordByUuidInCurrentMonth(targetUuid, currentMonth);
        if (!targetRecord) {
            throw new Error(`해당 UUID의 현재 월 기록을 찾을 수 없습니다. uuid=${targetUuid}`);
        }

        const now = Date.now();
        const isDeleted = body?.values?.[0]?.[0] === "DELETED";

        await updateDoc(getRecordRef(targetRecord.yearMonth, targetRecord.uuid), {
            sheetId,
            status: isDeleted ? "DELETED" : "SUCCESS",
            deleted: isDeleted,
            modifiedTime: now,
            updatedAtMillis: now,
            updateTimeStr: formatMillisToSheetString(now)
        });

        await setDoc(getMonthRef(targetRecord.yearMonth), {
            ym: targetRecord.yearMonth,
            updatedAtMillis: now
        }, { merge: true });

        await setDoc(getSheetRef(), {
            recordsUpdatedAt: now,
            updatedAt: now
        }, { merge: true });

        return { updates: { updatedRange: range } };
    }

    throw new Error(`지원하지 않는 callSheetsAPI 요청입니다: ${method} ${range}`);
}
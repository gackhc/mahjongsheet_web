// main/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { t } from './translations.js';

import {
    setApiConfig,
    fetchSheet,
    fetchMonthMeta,
    fetchMonthRecordsFull,
    fetchMonthRecordChanges,
    TokenExpiredError
} from './api.js';

import {
    getCurrentYearMonth,
    getRecordsBySheetMonth,
    replaceMonthRecords,
    getMonthSyncMeta,
    saveMonthSyncMeta
} from './db.js';

import { updateGameSettings } from './store.js';
import { initInputTab, applySettingsToUI } from './tab-input.js';
import { loadHistoryTab } from './tab-list.js';
import { loadStatTab } from './tab-stat.js';

const firebaseConfig = {
    apiKey: "AIzaSyBzuI8NJ03uRTy5OOF7QycZXcnqSAcUwwA",
    authDomain: "mahjongs-e07d3.firebaseapp.com",
    projectId: "mahjongs-e07d3",
    storageBucket: "mahjongs-e07d3.firebasestorage.app",
    messagingSenderId: "727926338004",
    appId: "1:727926338004:web:bafdd323d03a5fbbeea641",
    measurementId: "G-VS26P9GFR5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const sheetId = sessionStorage.getItem('currentSheetId');
const authMode = sessionStorage.getItem('authMode') || 'user';

setApiConfig(authMode, sheetId, firebaseConfig.apiKey);

let isAppInitialized = false;

function getRecordSyncMillis(record) {
    return Number(
        record.updatedAtMillis ??
        record.modifiedTime ??
        record.uploadTime ??
        (record.uploadTimeStr ? new Date(record.uploadTimeStr).getTime() : 0) ??
        0
    );
}

async function forceLogout(message) {
    if (message) alert(message);
    try {
        await signOut(auth);
    } catch (e) {
        console.error("로그아웃 에러:", e);
    } finally {
        sessionStorage.removeItem('authMode');
        window.location.replace(sheetId ? `index.html?id=${sheetId}` : "index.html");
    }
}

if (authMode === 'guest') {
    isAppInitialized = true;
    initInputTab();
    setupNavigation();

    fetchGameSettingsData().then(async () => {
        applySettingsToUI();
        await syncCurrentMonthRecords();
    });
} else {
    onAuthStateChanged(auth, async (user) => {
        if (isAppInitialized) return;

        if (user && sheetId) {
            isAppInitialized = true;
            initInputTab();
            setupNavigation();

            try {
                await fetchGameSettingsData();
                applySettingsToUI();
                await syncCurrentMonthRecords();
            } catch (error) {
                if (error instanceof TokenExpiredError) {
                    forceLogout("로그인 정보가 만료되었습니다. 다시 로그인해 주세요.");
                } else {
                    forceLogout("초기화 실패: " + error.message);
                }
            }
        } else {
            forceLogout("인증 정보가 없습니다. 다시 로그인해 주세요.");
        }
    });
}

function setupNavigation() {
    const navMap = {
        'input': t('input'),
        'list': t('history'),
        'stat': t('stats'),
        'setting': t('settings')
    };

    document.querySelectorAll('.nav-item').forEach(item => {
        const viewId = item.getAttribute('data-view');

        const label = item.querySelector('.nav-text');
        if (label && navMap[viewId]) {
            label.innerText = navMap[viewId];
        }

        item.addEventListener('click', () => {
            document.querySelectorAll('.content-area').forEach(v => v.classList.add('hidden'));
            document.getElementById('view-' + viewId).classList.remove('hidden');

            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            if (viewId === 'list') loadHistoryTab();
            if (viewId === 'stat') loadStatTab();
        });
    });
}

async function fetchGameSettingsData() {
    const data = await fetchSheet("setting!A:B");
    const rows = data.values;

    if (rows && rows.length > 0) {
        const settingMap = {};
        rows.forEach(row => {
            if (row[0]) settingMap[row[0].trim()] = row[1]?.trim() || "";
        });

        updateGameSettings({
            lastNo: parseInt(settingMap["라스트넘버"]) || null,
            totalScore: parseInt(settingMap["총점"]) || 100000,
            gameType: parseInt(settingMap["게임타입"]) || 4,
            uma: [
                parseInt(settingMap["우마1"]) || 20,
                parseInt(settingMap["우마2"]) || 10,
                parseInt(settingMap["우마3"]) || -10,
                parseInt(settingMap["우마4"]) || -20
            ],
            use23Player: (settingMap["2/3인 사용"] || "FALSE").toUpperCase() === "TRUE",
            uma3: [
                parseInt(settingMap["삼마 우마1"]) || 20,
                parseInt(settingMap["삼마 우마2"]) || 0,
                parseInt(settingMap["삼마 우마3"]) || -20
            ],
            uma2: [
                parseInt(settingMap["두마 우마1"]) || 20,
                parseInt(settingMap["두마 우마2"]) || -20
            ]
        });
    }
}

async function syncCurrentMonthRecords(forceFull = false) {
    const yearMonth = getCurrentYearMonth();
    const localMeta = await getMonthSyncMeta(sheetId, yearMonth);
    const localRecords = await getRecordsBySheetMonth(sheetId, yearMonth);
    const remoteMeta = await fetchMonthMeta(yearMonth);

    if (forceFull || !localMeta?.isFullyLoaded || localRecords.length === 0) {
        const remoteRecords = await fetchMonthRecordsFull(yearMonth);
        await replaceMonthRecords(sheetId, yearMonth, remoteRecords);

        const maxSyncMillis = remoteRecords.reduce(
            (max, record) => Math.max(max, getRecordSyncMillis(record)),
            0
        );

        await saveMonthSyncMeta({
            sheetId,
            yearMonth,
            isFullyLoaded: true,
            lastSyncedAtMillis: maxSyncMillis,
            lastServerUpdatedAtMillis: Number(remoteMeta?.updatedAtMillis || maxSyncMillis || 0),
            recordCount: remoteRecords.length,
            loadedAt: Date.now()
        });
        return;
    }

    const localServerUpdatedAtMillis = Number(localMeta.lastServerUpdatedAtMillis || 0);
    const remoteUpdatedAtMillis = Number(remoteMeta?.updatedAtMillis || 0);

    if (remoteUpdatedAtMillis && remoteUpdatedAtMillis <= localServerUpdatedAtMillis) {
        console.log("✅ 현재 월 캐시 재사용, records 재조회 생략");
        return;
    }

    const changes = await fetchMonthRecordChanges(
        yearMonth,
        Number(localMeta.lastSyncedAtMillis || 0)
    );

    if (changes.length > 0) {
        const existingMap = new Map(localRecords.map(r => [r.uuid, r]));
        changes.forEach(change => existingMap.set(change.uuid, { ...existingMap.get(change.uuid), ...change }));
        await replaceMonthRecords(sheetId, yearMonth, Array.from(existingMap.values()));
    }

    const refreshed = await getRecordsBySheetMonth(sheetId, yearMonth);
    const maxSyncMillis = refreshed.reduce(
        (max, record) => Math.max(max, getRecordSyncMillis(record)),
        Number(localMeta.lastSyncedAtMillis || 0)
    );

    await saveMonthSyncMeta({
        sheetId,
        yearMonth,
        isFullyLoaded: true,
        lastSyncedAtMillis: maxSyncMillis,
        lastServerUpdatedAtMillis: remoteUpdatedAtMillis || Math.max(localServerUpdatedAtMillis, maxSyncMillis),
        recordCount: refreshed.length,
        loadedAt: Date.now()
    });
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await forceLogout();
});
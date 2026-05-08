// js/tab-input.js
import { state, updateGameSettings } from './store.js';
import { callSheetsAPI, fetchSheet, fetchSheetNicknames, getCurrentUserId, fetchRecentNicknames, pushRecentNicknamesToFirestore } from './api.js';
import { saveRecords, getAllRecords } from './db.js';
import { t } from './translations.js';

let editModeUuid = null;
let editModeSeqNo = null;
let editModeOriginalRecord = null;

let selectedPlayerIndex = 0;
let cachedAllNicknames = [];
let cachedRecentNicknames = [];


async function loadRecentNicknames() {
    try {
        return await fetchRecentNicknames();
    } catch (error) {
        console.warn("최근 닉네임 Firestore 조회 실패:", error);
        return [];
    }
}

async function pushRecentNicknames(names) {
    const clean = names
        .map(v => (v || "").trim())
        .filter(Boolean);

    try {
        cachedRecentNicknames = await pushRecentNicknamesToFirestore(clean);
    } catch (error) {
        console.warn("최근 닉네임 Firestore 저장 실패:", error);
        const newSet = new Set(clean);
        cachedRecentNicknames = [
            ...clean,
            ...cachedRecentNicknames.filter(name => !newSet.has(name))
        ].slice(0, 12);
    }

    return cachedRecentNicknames;
}

function getVisiblePlayerCount() {
    return state.gameSettings.gameType === 3 ? 3 : 4;
}

function getWindText(index) {
    const winds = [t('east'), t('south'), t('west'), t('north')];
    return winds[index] || "";
}

function getBracketWindText(index) {
    return `[${getWindText(index)}]`;
}

function getPrevVisibleIndex(index) {
    const visible = getVisiblePlayerCount();
    return (index - 1 + visible) % visible;
}

function getNextVisibleIndex(index) {
    const visible = getVisiblePlayerCount();
    return (index + 1) % visible;
}

function getPlayerNameValue(index) {
    const input = document.getElementById(`name-${index}`);
    return input ? input.value.trim() : "";
}

function setPlayerNameValue(index, name) {
    const input = document.getElementById(`name-${index}`);
    if (input) input.value = name;
    syncNameSlotUI(index);
}

function syncNameSlotUI(index) {
    const input = document.getElementById(`name-${index}`);
    const valueEl = document.getElementById(`name-display-${index}`);
    const slotEl = document.getElementById(`name-slot-${index}`);

    if (!input || !valueEl || !slotEl) return;

    const name = input.value.trim();
    if (name) {
        valueEl.textContent = `${getBracketWindText(index)} ${name}`;
        valueEl.classList.remove('placeholder');
        slotEl.classList.add('filled');
    } else {
        valueEl.textContent = `${getBracketWindText(index)} ${t('nickname')}`;
        valueEl.classList.add('placeholder');
        slotEl.classList.remove('filled');
    }
}

function syncAllNameSlots() {
    for (let i = 0; i < 4; i++) {
        syncNameSlotUI(i);
    }
}

function setSelectedPlayer(index) {
    const visible = getVisiblePlayerCount();
    selectedPlayerIndex = Math.max(0, Math.min(index, visible - 1));

    for (let i = 0; i < 4; i++) {
        const slotEl = document.getElementById(`name-slot-${i}`);
        if (!slotEl) continue;
        slotEl.classList.toggle('selected', i === selectedPlayerIndex && i < visible);
    }
}

function advanceSelectedPlayer() {
    setSelectedPlayer(getNextVisibleIndex(selectedPlayerIndex));
}

function addNicknameToCache(name) {
    const clean = (name || "").trim();
    if (!clean) return;

    if (!cachedAllNicknames.includes(clean)) {
        cachedAllNicknames = [...cachedAllNicknames, clean].sort((a, b) => a.localeCompare(b));
    }
}

function swapPlayerNames(a, b) {
    const aName = getPlayerNameValue(a);
    const bName = getPlayerNameValue(b);

    setPlayerNameValue(a, bName);
    setPlayerNameValue(b, aName);
    updateScoreBoard();
}

export async function initInputTab() {
    const [localNames, remoteNames] = await Promise.all([
        getUniqueNicknames(),
        fetchSheetNicknames().catch(() => [])
    ]);

    cachedAllNicknames = Array.from(new Set([
        ...remoteNames,
        ...localNames
    ])).sort((a, b) => a.localeCompare(b));

    cachedRecentNicknames = await loadRecentNicknames();

    renderPlayerInputs(cachedRecentNicknames);
    setupEvents();
    applySettingsToUI();
    setSelectedPlayer(0);

    if (sessionStorage.getItem('authMode') === 'guest') {
        document.querySelectorAll('#view-input input, #view-input button').forEach(el => {
            el.disabled = true;
        });
        document.querySelectorAll('#view-input .name-slot-box').forEach(el => {
            el.classList.add('disabled');
        });
    }
}

async function getUniqueNicknames() {
    try {
        const records = await getAllRecords();
        const names = new Set();

        records.forEach(r => {
            if (r.p1Name) names.add(r.p1Name);
            if (r.p2Name) names.add(r.p2Name);
            if (r.p3Name) names.add(r.p3Name);
            if (r.p4Name) names.add(r.p4Name);
        });

        return Array.from(names).sort();
    } catch (e) {
        console.error("닉네임 추출 실패:", e);
        return [];
    }
}

function renderPlayerInputs(recentNicknames = []) {
    const playerList = document.getElementById('player-inputs');

    if (playerList) {
        playerList.innerHTML = '';

        for (let i = 0; i < 4; i++) {
            const scoreTabIndex = i + 2;

            playerList.innerHTML += `
                <div class="player-row" id="row-player-${i}">
                    <div class="name-action-row left-action-row">
                        <button type="button" class="slot-action-btn slot-input-btn" data-index="${i}">
                            ${t('input')}
                        </button>
                    </div>

                    <div
                        class="name-slot-box ${i === 0 ? 'selected' : ''}"
                        id="name-slot-${i}"
                        data-index="${i}"
                    >
                        <span class="name-slot-value placeholder" id="name-display-${i}">
                            ${getBracketWindText(i)} ${t('nickname')}
                        </span>
                        <input
                            type="text"
                            class="p-name-input"
                            id="name-${i}"
                            readonly
                            tabindex="-1"
                            style="display:none;"
                        >
                    </div>

                    <div class="name-action-row right-action-row">
                        <button type="button" class="slot-action-btn move-up-btn" data-index="${i}">▲</button>
                        <button type="button" class="slot-action-btn move-down-btn" data-index="${i}">▼</button>
                    </div>

                    <div class="input-box-wrapper error" id="score-wrapper-${i}">
                        <button type="button" class="score-sign-toggle score-sign-plus" data-index="${i}" data-sign="1" tabindex="-1" aria-label="점수 부호">+</button>
                        <input type="tel" inputmode="numeric" pattern="[0-9]*" enterkeyhint="${i === 3 ? 'done' : 'next'}" class="p-score" placeholder="${t('score')}" id="score-${i}" tabindex="${scoreTabIndex}">
                        <span class="input-suffix">00</span>
                    </div>
                </div>
            `;
        }

        if (!document.getElementById('recent-nicknames-box')) {
            playerList.insertAdjacentHTML('beforeend', `
                <div id="recent-nicknames-box" class="recent-history-box">
                    <div class="recent-history-title">${t('input_history')}</div>
                    <div id="recent-nickname-chips" class="recent-history-chips"></div>
                </div>
            `);
        } else {
            const title = document.querySelector('#recent-nicknames-box .recent-history-title');
            if (title) title.textContent = t('input_history');
        }

        if (!document.getElementById('nickname-dialog-root')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div id="nickname-dialog-root" style="display:none;"></div>
            `);
        }

        renderRecentNicknameChips(recentNicknames);

        const depositInput = document.getElementById('deposit');
        if (depositInput) {
            depositInput.setAttribute('tabindex', '1');
            depositInput.setAttribute('type', 'tel');
            depositInput.setAttribute('inputmode', 'numeric');
            depositInput.setAttribute('pattern', '[0-9]*');
            depositInput.setAttribute('enterkeyhint', 'next');
            depositInput.placeholder = t('deposit');
        }

        syncAllNameSlots();
    }
}

function setupEvents() {
    const btnSouth = document.getElementById('round-south');
    const btnEast = document.getElementById('round-east');

    if (btnSouth && !btnSouth.dataset.bound) {
        btnSouth.addEventListener('click', () => {
            if (btnSouth.classList.contains('active')) return;
            if (!window.confirm('남장으로 변경합니다')) return;

            btnSouth.classList.add('active');
            btnEast?.classList.remove('active');
        });
        btnSouth.dataset.bound = 'true';
    }

    if (btnEast && !btnEast.dataset.bound) {
        btnEast.addEventListener('click', () => {
            if (btnEast.classList.contains('active')) return;
            if (!window.confirm('동장으로 변경합니다')) return;

            btnEast.classList.add('active');
            btnSouth?.classList.remove('active');
        });
        btnEast.dataset.bound = 'true';
    }

    const viewInput = document.getElementById('view-input');
    if (viewInput && !viewInput.dataset.bound) {
        viewInput.addEventListener('input', (e) => {
            if (e.target.classList.contains('p-score') || e.target.id === 'deposit') {
                sanitizeNumberInput(e.target);
                const wrapper = e.target.closest('.input-box-wrapper');
                if (wrapper) {
                    const isFilled = e.target.value.trim() !== '';
                    wrapper.classList.toggle('filled', isFilled);
                    wrapper.classList.toggle('error', !isFilled);
                }
            }

            updateScoreBoard();
        });

        viewInput.addEventListener('click', (e) => {
            const signBtn = e.target.closest('.score-sign-toggle');
            if (signBtn) {
                toggleScoreSign(Number(signBtn.dataset.index));
                return;
            }

            const slot = e.target.closest('.name-slot-box');
            if (slot) {
                const index = Number(slot.dataset.index);
                setSelectedPlayer(index);
                return;
            }

            const inputBtn = e.target.closest('.slot-input-btn');
            if (inputBtn) {
                const index = Number(inputBtn.dataset.index);
                setSelectedPlayer(index);
                openNicknameDialog(index);
                return;
            }

            const moveUpBtn = e.target.closest('.move-up-btn');
            if (moveUpBtn) {
                const index = Number(moveUpBtn.dataset.index);
                const targetIndex = getPrevVisibleIndex(index);
                swapPlayerNames(index, targetIndex);
                setSelectedPlayer(targetIndex);
                return;
            }

            const moveDownBtn = e.target.closest('.move-down-btn');
            if (moveDownBtn) {
                const index = Number(moveDownBtn.dataset.index);
                const targetIndex = getNextVisibleIndex(index);
                swapPlayerNames(index, targetIndex);
                setSelectedPlayer(targetIndex);
                return;
            }
        });

        viewInput.addEventListener('keydown', (e) => {
            if ((e.target.classList.contains('p-score') || e.target.id === 'deposit') && e.key === 'Enter') {
                e.preventDefault();
                focusNextInputFrom(e.target.id);
            }
        });

        viewInput.dataset.bound = 'true';
    }

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.addEventListener('click', handleSaveRecord);
        saveBtn.dataset.bound = 'true';
    }

    if (saveBtn && !document.getElementById('cancelEditBtn')) {
        const btnWrapper = document.createElement('div');
        btnWrapper.id = 'action-btn-wrapper';
        btnWrapper.style.display = 'flex';
        btnWrapper.style.gap = '10px';
        btnWrapper.style.marginTop = '15px';
        btnWrapper.style.width = '100%';

        saveBtn.parentNode.insertBefore(btnWrapper, saveBtn);
        btnWrapper.appendChild(saveBtn);
        saveBtn.style.flex = '1';
        saveBtn.style.margin = '0';

        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditBtn';
        cancelBtn.innerText = t('cancel_edit');
        cancelBtn.style.display = 'none';
        cancelBtn.style.flex = '1';
        cancelBtn.style.padding = '12px';
        cancelBtn.style.background = '#e9ecef';
        cancelBtn.style.color = '#495057';
        cancelBtn.style.fontWeight = 'bold';
        cancelBtn.style.border = 'none';
        cancelBtn.style.borderRadius = '8px';
        cancelBtn.style.cursor = 'pointer';

        cancelBtn.addEventListener('click', cancelEditMode);
        btnWrapper.appendChild(cancelBtn);
    }
}

export function applySettingsToUI() {
    const targetEl = document.querySelector('.score-board .target');
    if (targetEl) {
        targetEl.innerText = `${t('total_score')} (${t('target')}: ${state.gameSettings.totalScore.toLocaleString()})`;
    }

    const p4Row = document.getElementById('row-player-3');
    if (p4Row) {
        p4Row.style.display = state.gameSettings.gameType === 3 ? 'none' : 'flex';
    }

    if (state.gameSettings.gameType === 3 && selectedPlayerIndex === 3) {
        setSelectedPlayer(0);
    }

    updateScoreBoard();
}


function getScoreSign(index) {
    const btn = document.querySelector(`.score-sign-toggle[data-index="${index}"]`);
    return btn?.dataset.sign === "-1" ? -1 : 1;
}

function setScoreSign(index, sign) {
    const btn = document.querySelector(`.score-sign-toggle[data-index="${index}"]`);
    if (!btn) return;

    const normalized = Number(sign) < 0 ? -1 : 1;
    btn.dataset.sign = String(normalized);
    btn.textContent = normalized < 0 ? "−" : "+";
    btn.classList.toggle("score-sign-minus", normalized < 0);
    btn.classList.toggle("score-sign-plus", normalized > 0);
}

function toggleScoreSign(index) {
    setScoreSign(index, getScoreSign(index) * -1);
    updateScoreBoard();
}

function getScoreInputRaw(index) {
    const input = document.getElementById(`score-${index}`);
    return String(input?.value || "").replace(/[^0-9]/g, "");
}

function getScoreInputValue(index) {
    const raw = getScoreInputRaw(index);
    if (!raw) return 0;
    return (parseInt(raw, 10) || 0) * getScoreSign(index);
}

function sanitizeNumberInput(input) {
    if (!input) return;
    const cleaned = String(input.value || "").replace(/[^0-9]/g, "");
    if (input.value !== cleaned) input.value = cleaned;
}

function focusNextInputFrom(currentId) {
    const order = ["deposit", "score-0", "score-1", "score-2", "score-3"];
    const idx = order.indexOf(currentId);
    if (idx >= 0 && idx < order.length - 1) {
        const next = document.getElementById(order[idx + 1]);
        next?.focus();
        next?.select?.();
    } else if (idx === order.length - 1) {
        document.getElementById(currentId)?.blur();
    }
}

function updateScoreBoard() {
    const scoreInputs = document.querySelectorAll('.p-score');
    const depositInput = document.getElementById('deposit');
    const saveBtn = document.getElementById('saveBtn');

    if (!saveBtn) return;

    let sum = (parseInt(depositInput?.value) || 0) * 100;
    const playerCount = getVisiblePlayerCount();

    for (let i = 0; i < playerCount; i++) {
        sum += getScoreInputValue(i) * 100;
    }

    const total = sum;
    const totalSumEl = document.getElementById('total-sum');
    if (totalSumEl) totalSumEl.innerText = total.toLocaleString();

    const diff = state.gameSettings.totalScore - total;
    const statusText = document.getElementById('score-status');
    const scoreboard = document.getElementById('scoreboard');

    let allFilled = true;
    for (let i = 0; i < playerCount; i++) {
        if (!getPlayerNameValue(i) || !scoreInputs[i].value.trim()) {
            allFilled = false;
            break;
        }
    }

    if (total === state.gameSettings.totalScore && allFilled) {
        if (statusText) {
            statusText.innerText = "OK";
            statusText.style.color = "var(--success)";
        }
        if (scoreboard) scoreboard.classList.add('valid');

        saveBtn.disabled = false;
        if (editModeUuid) {
            saveBtn.innerText = t('edit');
            saveBtn.style.backgroundColor = '#e83e8c';
            saveBtn.style.color = 'white';
            saveBtn.style.opacity = '1';
        } else {
            saveBtn.innerText = t('save_record');
            saveBtn.classList.add('active');
            saveBtn.style.backgroundColor = '';
            saveBtn.style.color = '';
            saveBtn.style.opacity = '1';
        }
    } else {
        if (statusText) {
            if (total === state.gameSettings.totalScore && allFilled) {
                statusText.innerText = "OK";
                statusText.style.color = "var(--success)";
            } else {
                statusText.innerText = Math.abs(diff).toLocaleString();
                statusText.style.color = "var(--error)";
            }
        }
        if (scoreboard) scoreboard.classList.remove('valid');

        saveBtn.disabled = true;
        saveBtn.classList.remove('active');

        if (editModeUuid) {
            saveBtn.style.backgroundColor = '#f48fb1';
            saveBtn.style.opacity = '0.6';
        } else {
            saveBtn.style.backgroundColor = '';
            saveBtn.style.color = '';
            saveBtn.style.opacity = '';
        }
    }
}

async function handleSaveRecord() {
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.classList.remove('active');

    try {
        saveBtn.innerText = "Loading...";

        const isSouthRound = document.getElementById('round-south').classList.contains('active');
        const gameLength = isSouthRound ? 2 : 1;
        const deposit = (parseInt(document.getElementById('deposit').value) || 0) * 100;

        const scoreInputs = document.querySelectorAll('.p-score');
        const targetUuid = editModeUuid || crypto.randomUUID();

        let targetSeqNo;
        if (editModeUuid) {
            targetSeqNo = editModeSeqNo;
        } else {
            const settingData = await fetchSheet("setting!B1");
            const currentLastNo =
                (settingData.values && settingData.values[0] && settingData.values[0][0])
                    ? parseInt(settingData.values[0][0])
                    : 0;
            targetSeqNo = currentLastNo + 1;
        }

        const currentTime = Date.now();
        const dateObj = new Date(currentTime);
        const timeString =
            `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ` +
            `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;

        const yearMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

        const currentUserId = getCurrentUserId();

        const finalUploadTime = editModeOriginalRecord ? editModeOriginalRecord.uploadTime : currentTime;
        const finalUploadTimeStr = editModeOriginalRecord
            ? (editModeOriginalRecord.uploadTimeStr || editModeOriginalRecord.date)
            : timeString;
        const finalUpdateTimeStr = editModeUuid ? timeString : "";

        const record = {
            ...(editModeOriginalRecord || {}),
            uuid: targetUuid,
            seqNo: targetSeqNo,
            uploadTime: finalUploadTime,
            uploadTimeStr: finalUploadTimeStr,
            updateTimeStr: finalUpdateTimeStr,
            yearMonth: editModeOriginalRecord ? editModeOriginalRecord.yearMonth : yearMonth,
            gameType: state.gameSettings.gameType,
            gameLength,
            p1Name: getPlayerNameValue(0),
            p1Score: getScoreInputValue(0) * 100,
            p2Name: getPlayerNameValue(1),
            p2Score: getScoreInputValue(1) * 100,
            p3Name: getPlayerNameValue(2),
            p3Score: getScoreInputValue(2) * 100,
            p4Name: state.gameSettings.gameType === 4 ? getPlayerNameValue(3) : "",
            p4Score: state.gameSettings.gameType === 4 ? getScoreInputValue(3) * 100 : 0,
            deposit,
            status: editModeOriginalRecord?.status === "DELETED" ? "DELETED" : (editModeOriginalRecord?.status || "SUCCESS"),
            updatedAtMillis: currentTime,
            modifiedTime: editModeUuid ? currentTime : null,
            writer: editModeOriginalRecord?.writer || currentUserId || null,
            editor: currentUserId || editModeOriginalRecord?.editor || null
        };

        const rowData = [
            record.uuid, record.seqNo, finalUploadTimeStr, record.gameType, record.gameLength,
            record.p1Name, record.p1Score, record.p2Name, record.p2Score,
            record.p3Name, record.p3Score, record.p4Name, record.p4Score,
            record.deposit, record.status === "DELETED" ? "DELETED" : "", record.updateTimeStr,
            record.writer || "", record.editor || ""
        ];

        if (editModeUuid) {
            const sheetData = await fetchSheet("list!A:A");
            const rows = sheetData.values || [];
            let targetRow = -1;

            for (let i = 0; i < rows.length; i++) {
                if (rows[i][0] === targetUuid) {
                    targetRow = i + 1;
                    break;
                }
            }

            if (targetRow === -1) {
                throw new Error("수정 대상 행을 찾을 수 없습니다.");
            }

            await callSheetsAPI(`list!A${targetRow}:R${targetRow}`, "PUT", { values: [rowData] });
        } else {
            await callSheetsAPI("list!A:R", "APPEND", { values: [rowData] });
            await callSheetsAPI("setting!B1", "PUT", { values: [[targetSeqNo]] });
            updateGameSettings({ lastNo: targetSeqNo });
        }

        await saveRecords([record]);
        await initInputTab();

        const usedNames = [
            record.p1Name,
            record.p2Name,
            record.p3Name,
            record.p4Name
        ].map(v => (v || '').trim()).filter(Boolean);

        await pushRecentNicknames(usedNames);
        renderRecentNicknameChips(cachedRecentNicknames);

        clearInputs();
        cancelEditMode();
        alert(t('input_success'));
    } catch (error) {
        console.error("❌ 저장/수정 실패:", error);
        alert("Failed. (" + error.message + ")");
        saveBtn.disabled = false;
        saveBtn.classList.add('active');
        saveBtn.innerText = editModeUuid ? t('edit') : t('save_record');
    }
}

function clearInputs() {
    const depositInput = document.getElementById('deposit');
    if (depositInput) {
        depositInput.value = '';
        const dWrapper = depositInput.closest('.input-box-wrapper');
        if (dWrapper) {
            dWrapper.classList.remove('filled');
            dWrapper.classList.add('error');
        }
    }

    document.querySelectorAll('.p-score').forEach((input, idx) => {
        input.value = '';
        const wrapper = input.closest('.input-box-wrapper');
        if (wrapper) {
            wrapper.classList.remove('filled');
            wrapper.classList.add('error');
        }
    });

    for (let i = 0; i < 4; i++) {
        setPlayerNameValue(i, '');
        setScoreSign(i, 1);
    }

    setSelectedPlayer(0);
    updateScoreBoard();
}

function renderEditPreview(record) {
    let container = document.getElementById('edit-preview-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'edit-preview-container';
        container.style.marginTop = '15px';
        container.style.padding = '12px';
        container.style.border = '1px solid #dee2e6';
        container.style.borderRadius = '10px';
        container.style.background = '#fff';
        const actionWrapper = document.getElementById('action-btn-wrapper');
        actionWrapper?.parentNode?.insertBefore(container, actionWrapper);
    }

    const displayDate = (record.uploadTimeStr || record.date || '').substring(5, 16).replace('-', '/');
    const players = [
        { name: record.p1Name, score: record.p1Score },
        { name: record.p2Name, score: record.p2Score },
        { name: record.p3Name, score: record.p3Score },
        { name: record.p4Name, score: record.p4Score }
    ].filter(p => p.name);

    const scoresHtml = players.map(p => `
        <div style="display:flex; flex-direction:column; align-items:center;">
            <span style="font-size:10px; color:gray;">${p.name}</span>
            <span style="font-weight:bold;">${Number(p.score).toLocaleString()}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div style="font-size:12px; color:#495057; display:flex; align-items:center; gap:10px;">
            <div style="flex:1; display:flex; flex-direction:column;">
                <span style="font-weight:bold;">${record.gameLength === 2 ? t('round_south') : t('round_east')} No.${record.seqNo || record.No}</span>
                <span style="color:gray;">${displayDate}</span>
                <span style="font-size:9px; font-weight:bold; margin-top:2px;">${t('deposit')}: ${Number(record.deposit || 0).toLocaleString()}</span>
            </div>
            <div style="flex:2; display:flex; justify-content:space-evenly;">
                ${scoresHtml}
            </div>
        </div>
    `;
    container.style.display = 'block';
}

export function loadRecordForEdit(record) {
    if (!record) return;

    editModeUuid = record.uuid;
    editModeSeqNo = record.seqNo || record.No;
    editModeOriginalRecord = record;

    const viewInput = document.getElementById('view-input');
    if (viewInput) {
        viewInput.style.backgroundColor = '#eefdf4';
        viewInput.style.transition = 'background-color 0.3s ease';
    }

    renderEditPreview(record);

    if (record.gameLength === 2) {
        document.getElementById('round-south').classList.add('active');
        document.getElementById('round-east').classList.remove('active');
    } else {
        document.getElementById('round-east').classList.add('active');
        document.getElementById('round-south').classList.remove('active');
    }

    const players = [
        { name: record.p1Name, score: record.p1Score },
        { name: record.p2Name, score: record.p2Score },
        { name: record.p3Name, score: record.p3Score },
        { name: record.p4Name, score: record.p4Score }
    ];

    players.forEach((p, i) => {
        setPlayerNameValue(i, p.name || "");

        const scoreInput = document.getElementById(`score-${i}`);
        if (scoreInput && p.score !== undefined && p.score !== "") {
            const numericScore = Number(p.score || 0);
            scoreInput.value = Math.abs(numericScore / 100);
            setScoreSign(i, numericScore < 0 ? -1 : 1);
            const wrapper = scoreInput.closest('.input-box-wrapper');
            wrapper?.classList.add('filled');
            wrapper?.classList.remove('error');
        }
    });

    const depositInput = document.getElementById('deposit');
    if (depositInput) {
        depositInput.value = record.deposit ? record.deposit / 100 : 0;
        const wrapper = depositInput.closest('.input-box-wrapper');
        wrapper?.classList.add('filled');
        wrapper?.classList.remove('error');
    }

    setSelectedPlayer(0);
    document.getElementById('cancelEditBtn').style.display = 'block';
    updateScoreBoard();
}

function cancelEditMode() {
    editModeUuid = null;
    editModeSeqNo = null;
    editModeOriginalRecord = null;

    const viewInput = document.getElementById('view-input');
    if (viewInput) viewInput.style.backgroundColor = '';

    const previewContainer = document.getElementById('edit-preview-container');
    if (previewContainer) previewContainer.style.display = 'none';

    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.innerText = t('save_record');
        saveBtn.style.backgroundColor = '';
        saveBtn.style.color = '';
        saveBtn.style.opacity = '';
    }
}

function renderRecentNicknameChips(recentNicknames) {
    const chipWrap = document.getElementById('recent-nickname-chips');
    if (!chipWrap) return;

    chipWrap.innerHTML = '';

    recentNicknames.forEach(name => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'recent-history-chip';
        btn.textContent = name;

        btn.addEventListener('click', () => {
            applyNicknameToPlayer(selectedPlayerIndex, name, { advance: true });
        });

        chipWrap.appendChild(btn);
    });
}

function clearDuplicateNicknameFromOtherSlots(targetIndex, name) {
    const clean = (name || "").trim();
    if (!clean) return;

    const visible = getVisiblePlayerCount();

    for (let i = 0; i < visible; i++) {
        if (i === targetIndex) continue;

        if (getPlayerNameValue(i) === clean) {
            setPlayerNameValue(i, '');
        }
    }
}

function applyNicknameToPlayer(index, name, options = {}) {
    const { advance = false } = options;
    const clean = (name || "").trim();

    setSelectedPlayer(index);

    // 같은 닉네임이 다른 칸에 이미 있으면 그 칸을 비움
    clearDuplicateNicknameFromOtherSlots(index, clean);

    addNicknameToCache(clean);
    setPlayerNameValue(index, clean);
    updateScoreBoard();

    if (advance) {
        advanceSelectedPlayer();
    }
}


const HANGUL_BASE = 0xAC00;
const HANGUL_LAST = 0xD7A3;
const CHOSUNG_LIST = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
let nicknameDialogHistoryOpen = false;

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getChosungText(text) {
    return String(text || "").split("").map((char) => {
        const code = char.charCodeAt(0);
        if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
            const index = Math.floor((code - HANGUL_BASE) / 588);
            return CHOSUNG_LIST[index] || char;
        }
        return char;
    }).join("");
}

function getNicknameMatchInfo(name, keyword) {
    const cleanName = String(name || "").trim();
    const cleanKeyword = String(keyword || "").trim();
    if (!cleanKeyword) return { matched: true, index: 0, type: 2 };

    const lowerName = cleanName.toLowerCase();
    const lowerKeyword = cleanKeyword.toLowerCase();
    const directIndex = lowerName.indexOf(lowerKeyword);

    const nameChosung = getChosungText(cleanName).toLowerCase();
    const keywordChosung = getChosungText(cleanKeyword).toLowerCase();
    const chosungIndex = nameChosung.indexOf(keywordChosung);

    if (directIndex < 0 && chosungIndex < 0) {
        return { matched: false, index: Number.MAX_SAFE_INTEGER, type: 9 };
    }

    if (directIndex >= 0 && (chosungIndex < 0 || directIndex <= chosungIndex)) {
        return { matched: true, index: directIndex, type: 0 };
    }

    return { matched: true, index: chosungIndex, type: 1 };
}

function getFilteredNicknames(keyword) {
    const q = String(keyword || "").trim();

    return cachedAllNicknames
        .map((name) => ({ name, match: getNicknameMatchInfo(name, q) }))
        .filter((item) => item.match.matched)
        .sort((a, b) => {
            if (a.match.index !== b.match.index) return a.match.index - b.match.index;
            if (a.match.type !== b.match.type) return a.match.type - b.match.type;
            return a.name.localeCompare(b.name);
        })
        .map((item) => item.name);
}

function pushNicknameDialogHistory() {
    if (nicknameDialogHistoryOpen) return;
    nicknameDialogHistoryOpen = true;
    history.pushState({ nicknameDialogOpen: true }, "");
}

function closeNicknameDialog({ fromPopState = false } = {}) {
    const root = document.getElementById('nickname-dialog-root');
    if (!root || root.style.display === 'none') return;

    blockNicknameDialogTrailingTouch();
    root.style.display = 'none';
    root.innerHTML = '';

    if (nicknameDialogHistoryOpen) {
        nicknameDialogHistoryOpen = false;
        if (!fromPopState && history.state?.nicknameDialogOpen) {
            history.back();
        }
    }
}

if (!window.__mahjongNicknameDialogPopBound) {
    window.__mahjongNicknameDialogPopBound = true;
    window.addEventListener('popstate', () => {
        const root = document.getElementById('nickname-dialog-root');
        if (root && root.style.display !== 'none') {
            closeNicknameDialog({ fromPopState: true });
        }
    });
}

function focusNicknameInputSafely() {
    const input = document.getElementById('nickname-search-input');
    if (!input) return;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                input.focus({ preventScroll: true });
            }, 80);
        });
    });
}


let nicknameDialogTouchBlockUntil = 0;

function blockNicknameDialogTrailingTouch(durationMs = 450) {
    nicknameDialogTouchBlockUntil = Math.max(nicknameDialogTouchBlockUntil, Date.now() + durationMs);
}

if (!window.__mahjongNicknameDialogTouchShieldBound) {
    window.__mahjongNicknameDialogTouchShieldBound = true;
    ['click', 'touchend', 'pointerup'].forEach((eventName) => {
        document.addEventListener(eventName, (event) => {
            if (Date.now() <= nicknameDialogTouchBlockUntil) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
        }, true);
    });
}

function stopNicknameDialogEvent(event) {
    event.stopPropagation();
}

function makeSafeDialogPointerSelect({ container, itemSelector, onSelect }) {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let startItem = null;
    let cancelled = false;

    container.addEventListener('pointerdown', (event) => {
        const item = event.target.closest(itemSelector);
        if (!item) return;

        event.stopPropagation();
        startX = event.clientX;
        startY = event.clientY;
        startTime = Date.now();
        startItem = item;
        cancelled = false;
    });

    container.addEventListener('pointermove', (event) => {
        if (!startItem) return;

        const dx = Math.abs(event.clientX - startX);
        const dy = Math.abs(event.clientY - startY);
        if (dx > 10 || dy > 10) {
            cancelled = true;
        }
    });

    container.addEventListener('pointercancel', () => {
        cancelled = true;
        startItem = null;
    });

    container.addEventListener('pointerup', (event) => {
        const item = event.target.closest(itemSelector);
        if (!startItem || !item || item !== startItem) {
            startItem = null;
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const elapsed = Date.now() - startTime;
        const dx = Math.abs(event.clientX - startX);
        const dy = Math.abs(event.clientY - startY);
        const shouldIgnore = cancelled || dx > 10 || dy > 10 || elapsed > 650;

        const selectedItem = startItem;
        startItem = null;
        cancelled = false;

        if (shouldIgnore) return;

        blockNicknameDialogTrailingTouch();
        onSelect(selectedItem, event);
    });

    container.addEventListener('click', (event) => {
        if (event.target.closest(itemSelector)) {
            event.preventDefault();
            event.stopPropagation();
        }
    });
}

function openNicknameDialog(targetIndex) {
    setSelectedPlayer(targetIndex);

    const root = document.getElementById('nickname-dialog-root');
    if (!root) return;

    root.innerHTML = `
        <div id="nickname-dialog-overlay" class="nickname-dialog-overlay">
            <div class="nickname-dialog-panel">
                <div class="nickname-dialog-title">
                    ${t('nickname')}
                </div>

                <div class="nickname-dialog-search-row">
                    <input
                        id="nickname-search-input"
                        type="text"
                        inputmode="text"
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="none"
                        spellcheck="false"
                        enterkeyhint="done"
                        placeholder="${t('nickname')}"
                        class="nickname-search-input"
                    />
                    <button
                        id="nickname-direct-btn"
                        type="button"
                        class="nickname-direct-btn"
                        tabindex="-1"
                    >
                        ${t('direct_input_create')}
                    </button>
                </div>

                <div id="nickname-list" class="nickname-list"></div>

                <div class="nickname-dialog-footer">
                    <button
                        id="nickname-close-btn"
                        type="button"
                        class="nickname-close-btn"
                    >
                        ${t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    `;

    root.style.display = 'block';
    pushNicknameDialogHistory();

    const overlay = document.getElementById('nickname-dialog-overlay');
    const panel = overlay?.querySelector('.nickname-dialog-panel');
    const list = document.getElementById('nickname-list');
    const searchInput = document.getElementById('nickname-search-input');
    const directBtn = document.getElementById('nickname-direct-btn');
    const closeBtn = document.getElementById('nickname-close-btn');

    if (!overlay || !panel || !list || !searchInput || !directBtn || !closeBtn) return;

    searchInput.type = "text";
    searchInput.inputMode = "text";
    searchInput.autocomplete = "off";
    searchInput.autocorrect = "off";
    searchInput.autocapitalize = "none";
    searchInput.spellcheck = false;
    searchInput.enterKeyHint = "done";
    searchInput.removeAttribute("readonly");
    searchInput.removeAttribute("disabled");
    searchInput.removeAttribute("tabindex");

    function renderFilteredList(keyword) {
        const filtered = getFilteredNicknames(keyword);

        list.innerHTML = filtered.map(name => `
            <button type="button" class="nickname-item" data-name="${escapeHtml(name)}" tabindex="-1">
                ${escapeHtml(name)}
            </button>
        `).join('');
    }

    function applyDirectInput() {
        const value = searchInput.value.trim();
        if (!value) return;
        applyNicknameToPlayer(targetIndex, value);
        closeNicknameDialog();
    }

    ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'].forEach((eventName) => {
        overlay.addEventListener(eventName, (event) => {
            if (event.target !== overlay) return;
            event.stopPropagation();
        });
        panel.addEventListener(eventName, stopNicknameDialogEvent);
    });

    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target === overlay) closeNicknameDialog();
    });

    panel.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        const target = event.target;
        if (target.closest('button') || target.closest('.nickname-item')) return;
        setTimeout(() => {
            searchInput.focus({ preventScroll: true });
        }, 0);
    });

    searchInput.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        setTimeout(() => {
            searchInput.focus({ preventScroll: true });
        }, 0);
    });

    closeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeNicknameDialog();
    });

    searchInput.addEventListener('input', () => {
        renderFilteredList(searchInput.value);
    });

    searchInput.addEventListener('compositionstart', () => {
        renderFilteredList(searchInput.value);
    });

    searchInput.addEventListener('compositionupdate', () => {
        renderFilteredList(searchInput.value);
    });

    searchInput.addEventListener('compositionend', () => {
        renderFilteredList(searchInput.value);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            applyDirectInput();
        }
    });

    directBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyDirectInput();
    });

    makeSafeDialogPointerSelect({
        container: list,
        itemSelector: '.nickname-item',
        onSelect: (item) => {
            searchInput.blur();
            applyNicknameToPlayer(targetIndex, item.dataset.name || '');
            closeNicknameDialog();
        }
    });

    renderFilteredList('');
    focusNicknameInputSafely();
}

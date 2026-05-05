// js/tab-input.js
import { state, updateGameSettings } from './store.js';
import { callSheetsAPI, fetchSheet, fetchSheetNicknames, getCurrentUserId } from './api.js';
import { saveRecords, getAllRecords } from './db.js';
import { t } from './translations.js';

let editModeUuid = null;
let editModeSeqNo = null;
let editModeOriginalRecord = null;

let selectedPlayerIndex = 0;
let cachedAllNicknames = [];
let cachedRecentNicknames = [];

function getRecentNickKey() {
    const currentSheetId = sessionStorage.getItem('currentSheetId') || 'default';
    return `recent_nicks_${currentSheetId}`;
}

function loadRecentNicknames() {
    try {
        const raw = localStorage.getItem(getRecentNickKey());
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(v => (v || "").trim())
            .filter(Boolean)
            .slice(0, 12);
    } catch {
        return [];
    }
}

function saveRecentNicknames(names) {
    localStorage.setItem(getRecentNickKey(), JSON.stringify(names.slice(0, 12)));
}

function pushRecentNicknames(names) {
    const clean = names
        .map(v => (v || "").trim())
        .filter(Boolean);

    const merged = [
        ...clean,
        ...loadRecentNicknames()
    ];

    const unique = Array.from(new Set(merged)).slice(0, 12);
    saveRecentNicknames(unique);
    cachedRecentNicknames = unique;
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

    cachedRecentNicknames = loadRecentNicknames();

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
            const scoreTabIndex = i + 5;

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
                        <input type="number" class="p-score" placeholder="${t('score')}" id="score-${i}" tabindex="${scoreTabIndex}">
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
            depositInput.setAttribute('tabindex', '9');
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
            btnSouth.classList.add('active');
            btnEast?.classList.remove('active');
        });
        btnSouth.dataset.bound = 'true';
    }

    if (btnEast && !btnEast.dataset.bound) {
        btnEast.addEventListener('click', () => {
            btnEast.classList.add('active');
            btnSouth?.classList.remove('active');
        });
        btnEast.dataset.bound = 'true';
    }

    const viewInput = document.getElementById('view-input');
    if (viewInput && !viewInput.dataset.bound) {
        viewInput.addEventListener('input', (e) => {
            if (e.target.classList.contains('p-score') || e.target.id === 'deposit') {
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

function updateScoreBoard() {
    const scoreInputs = document.querySelectorAll('.p-score');
    const depositInput = document.getElementById('deposit');
    const saveBtn = document.getElementById('saveBtn');

    if (!saveBtn) return;

    let sum = (parseInt(depositInput?.value) || 0) * 100;
    const playerCount = getVisiblePlayerCount();

    for (let i = 0; i < playerCount; i++) {
        sum += (parseInt(scoreInputs[i].value) || 0) * 100;
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
            p1Score: parseInt(scoreInputs[0].value) * 100,
            p2Name: getPlayerNameValue(1),
            p2Score: parseInt(scoreInputs[1].value) * 100,
            p3Name: getPlayerNameValue(2),
            p3Score: parseInt(scoreInputs[2].value) * 100,
            p4Name: state.gameSettings.gameType === 4 ? getPlayerNameValue(3) : "",
            p4Score: state.gameSettings.gameType === 4 ? parseInt(scoreInputs[3].value) * 100 : 0,
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

        pushRecentNicknames(usedNames);
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

    document.querySelectorAll('.p-score').forEach(input => {
        input.value = '';
        const wrapper = input.closest('.input-box-wrapper');
        if (wrapper) {
            wrapper.classList.remove('filled');
            wrapper.classList.add('error');
        }
    });

    for (let i = 0; i < 4; i++) {
        setPlayerNameValue(i, '');
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
            scoreInput.value = p.score === 0 ? 0 : p.score / 100;
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

function openNicknameDialog(targetIndex) {
    setSelectedPlayer(targetIndex);

    const root = document.getElementById('nickname-dialog-root');
    if (!root) return;

    const rows = cachedAllNicknames
        .map(name => `
            <div class="nickname-item" data-name="${name}" style="
                padding:12px;
                border-bottom:1px solid #eee;
                cursor:pointer;
                font-size:15px;
            ">${name}</div>
        `)
        .join('');

    root.innerHTML = `
        <div id="nickname-dialog-overlay" style="
            position:fixed;
            inset:0;
            background:rgba(0,0,0,0.45);
            display:flex;
            align-items:center;
            justify-content:center;
            z-index:9999;
        ">
            <div style="
                width:min(92vw, 420px);
                max-height:80vh;
                background:#fff;
                border-radius:14px;
                overflow:hidden;
                display:flex;
                flex-direction:column;
            ">
                <div style="padding:16px; font-size:18px; font-weight:bold;">
                    ${t('nickname')}
                </div>

                <div style="padding:0 16px 12px 16px; display:flex; gap:8px;">
                    <input
                        id="nickname-search-input"
                        type="text"
                        placeholder="${t('nickname')}"
                        style="
                            flex:1;
                            height:44px;
                            border:1px solid #ddd;
                            border-radius:8px;
                            padding:0 12px;
                            font-size:14px;
                        "
                    />
                    <button
                        id="nickname-direct-btn"
                        type="button"
                        style="
                            height:44px;
                            padding:0 14px;
                            border:none;
                            border-radius:8px;
                            background:#2e7d32;
                            color:#fff;
                            font-weight:bold;
                            cursor:pointer;
                        "
                    >
                        ${t('direct_input_create')}
                    </button>
                </div>

                <div id="nickname-list" style="overflow:auto; max-height:50vh;">
                    ${rows}
                </div>

                <div style="padding:12px 16px; border-top:1px solid #eee; text-align:right;">
                    <button
                        id="nickname-close-btn"
                        type="button"
                        style="
                            border:none;
                            background:transparent;
                            color:#666;
                            cursor:pointer;
                            font-size:14px;
                        "
                    >
                        ${t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    `;

    root.style.display = 'block';

    const overlay = document.getElementById('nickname-dialog-overlay');
    const list = document.getElementById('nickname-list');
    const searchInput = document.getElementById('nickname-search-input');
    const directBtn = document.getElementById('nickname-direct-btn');
    const closeBtn = document.getElementById('nickname-close-btn');

    function closeDialog() {
        root.style.display = 'none';
        root.innerHTML = '';
    }

    function renderFilteredList(keyword) {
        const q = (keyword || '').trim().toLowerCase();
        const filtered = cachedAllNicknames.filter(name => name.toLowerCase().includes(q));

        list.innerHTML = filtered.map(name => `
            <div class="nickname-item" data-name="${name}" style="
                padding:12px;
                border-bottom:1px solid #eee;
                cursor:pointer;
                font-size:15px;
            ">${name}</div>
        `).join('');
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDialog();
    });

    closeBtn.addEventListener('click', closeDialog);

    searchInput.addEventListener('input', (e) => {
        renderFilteredList(e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const value = searchInput.value.trim();
            if (!value) return;
            applyNicknameToPlayer(targetIndex, value);
            closeDialog();
        }
    });

    directBtn.addEventListener('click', () => {
        const value = searchInput.value.trim();
        if (!value) return;
        applyNicknameToPlayer(targetIndex, value);
        closeDialog();
    });

    list.addEventListener('click', (e) => {
        const item = e.target.closest('.nickname-item');
        if (!item) return;
        applyNicknameToPlayer(targetIndex, item.dataset.name || '');
        closeDialog();
    });

    renderFilteredList('');
    searchInput.focus();
}
// js/tab-list.js
import { getAllRecords, updateRecordStatus } from './db.js';
import { loadRecordForEdit } from './tab-input.js';
import { fetchSheet, callSheetsAPI, getCurrentUserId } from './api.js';
import { t } from './translations.js';

let allRecords = [];
let currentPage = 1;
const itemsPerPage = 20;

export async function loadHistoryTab() {
    const container = document.getElementById('history-content');

    try {
        container.innerHTML = `<p style='text-align:center;'>${t('loading')}</p>`;
        const rawRecords = await getAllRecords();

        if (!rawRecords || rawRecords.length === 0) {
            container.innerHTML = `<p style='text-align:center; padding:40px; color:var(--outline);'>${t('no_record')}</p>`;
            return;
        }

        allRecords = rawRecords
            .filter(r => r && r.uploadTimeStr)
            .map(r => ({
                uuid: r.uuid,
                no: r.seqNo || r.No,
                date: r.uploadTimeStr,
                deposit: Number(r.deposit) || 0,
                status: r.status || "",
                gameLength: r.gameLength,
                results: [
                    { name: r.p1Name, score: Number(r.p1Score) || 0 },
                    { name: r.p2Name, score: Number(r.p2Score) || 0 },
                    { name: r.p3Name, score: Number(r.p3Score) || 0 },
                    { name: r.p4Name, score: Number(r.p4Score) || 0 }
                ],
                raw: r
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        currentPage = 1;
        renderHistory();
    } catch (e) {
        console.error("❌ 목록 렌더링 에러:", e);
        container.innerHTML = `<p style="color:var(--error); text-align:center;">데이터 표시 오류: ${e.message}</p>`;
    }
}

function renderHistory() {
    const container = document.getElementById('history-content');
    const totalPages = Math.ceil(allRecords.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageItems = allRecords.slice(startIndex, startIndex + itemsPerPage);
    const monthLabel = allRecords.length > 0 ? allRecords[0].date.substring(0, 7) : '-';

    container.innerHTML = `
        <div class="history-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px 4px;">
            <div class="month-label" style="font-size:16px; font-weight:bold; color:#333;">
                ${monthLabel}
            </div>
            <div class="count-label">${allRecords.length}</div>
        </div>

        <div class="history-list">
            ${pageItems.length > 0
                ? pageItems.map(item => createCardHtml(item)).join('')
                : `<p style="text-align:center; padding:40px; color:var(--outline);">${t('no_record')}</p>`}
        </div>

        ${allRecords.length > itemsPerPage ? `
        <div class="pagination">
            <button class="page-btn" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>
            <span class="page-info">${currentPage} / ${totalPages}</span>
            <button class="page-btn" id="next-page" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>
        </div>` : ''}
    `;

    bindEvents();
}

function createCardHtml(item) {
    const displayDate = item.date.substring(5, 16).replace('-', '/');

    const isDeleted = item.status === "DELETED";
    const cardStyle = isDeleted ? 'background-color: #EEEEEE; opacity: 0.8;' : '';
    const textStyle = isDeleted ? 'text-decoration: line-through; color: #999;' : '';

    const scoresHtml = item.results.map(res => {
        if (!res.name) return '';
        return `
        <div class="score-item" style="${textStyle}">
            <span class="score-name">${res.name}</span>
            <span class="score-val ${res.score < 0 && !isDeleted ? 'minus' : ''}">${res.score.toLocaleString()}</span>
        </div>
        `;
    }).join('');

    const isGuest = sessionStorage.getItem('authMode') === 'guest';

    let actionButtons = '';
    if (!isGuest) {
        actionButtons = isDeleted
            ? `<button class="action-btn btn-restore" data-uuid="${item.uuid}" style="padding: 4px 8px; font-size: 11px; background: #e0e0e0; border: none; border-radius: 4px; cursor: pointer;">${t('restore')}</button>`
            : `
               <button class="action-btn btn-edit" data-uuid="${item.uuid}" style="padding: 4px 8px; margin-bottom: 4px; font-size: 11px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">${t('edit')}</button>
               <button class="action-btn btn-delete" data-uuid="${item.uuid}" style="padding: 4px 8px; font-size: 11px; background: #ff4d4f; color: white; border: none; border-radius: 4px; cursor: pointer;">${t('delete')}</button>
              `;
    }

    const roundTitle = item.gameLength === 2 ? t('round_south') : t('round_east');
    return `
        <div class="history-card" data-uuid="${item.uuid}" style="display: flex; justify-content: space-between; align-items: center; ${cardStyle}">
            <div style="display: flex; flex: 1;">
                <div class="card-left" style="${textStyle}">
                    <div class="card-title">${roundTitle} No.${item.no}</div>
                    <div class="card-date">
                        ${displayDate}<br>
                        ${t('deposit')}: ${item.deposit.toLocaleString()}
                    </div>
                </div>
                <div class="card-right-grid" style="flex: 1;">
                    ${scoresHtml}
                </div>
            </div>
            <div class="card-actions" style="display: flex; flex-direction: column; margin-left: 8px;">
                ${actionButtons}
            </div>
        </div>
    `;
}

async function syncStatusToSheet(uuid, status) {
    try {
        const data = await fetchSheet("list!A:A");
        const rows = data.values || [];
        let targetRow = -1;

        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] === uuid) {
                targetRow = i + 1;
                break;
            }
        }

        if (targetRow !== -1) {
            await callSheetsAPI(`list!O${targetRow}`, "PUT", { values: [[status]] });
        } else {
            console.warn("⚠️ 해당 UUID를 찾을 수 없어 상태 업데이트를 스킵합니다.");
        }
    } catch (error) {
        console.error("❌ 상태 업데이트 실패:", error);
        throw error;
    }
}

function bindEvents() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (prevBtn) prevBtn.onclick = () => { currentPage--; renderHistory(); };
    if (nextBtn) nextBtn.onclick = () => { currentPage++; renderHistory(); };

    const listContainer = document.querySelector('.history-list');
    if (listContainer) {
        listContainer.onclick = async (e) => {
            const btn = e.target.closest('.action-btn');
            if (!btn) return;

            const uuid = btn.getAttribute('data-uuid');
            const targetRecord = allRecords.find(r => r.uuid === uuid);
            if (!targetRecord) return;

            if (btn.classList.contains('btn-edit')) {
                loadRecordForEdit(targetRecord.raw);
                const inputTabBtn = document.querySelector('.nav-item[data-view="input"]');
                if (inputTabBtn) inputTabBtn.click();
            } else if (btn.classList.contains('btn-delete')) {
                if (confirm(t('confirm_delete'))) {
                    try {
                        const currentUserId = getCurrentUserId();
                        await updateRecordStatus(uuid, "DELETED", currentUserId);
                        await syncStatusToSheet(uuid, "DELETED");
                        targetRecord.status = "DELETED";
                        targetRecord.raw.status = "DELETED";
                        targetRecord.raw.editor = currentUserId || targetRecord.raw.editor || null;
                        renderHistory();
                    } catch (error) {
                        alert(error.message);
                    }
                }
            } else if (btn.classList.contains('btn-restore')) {
                try {
                    const currentUserId = getCurrentUserId();
                    await updateRecordStatus(uuid, "SUCCESS", currentUserId);
                    await syncStatusToSheet(uuid, "");
                    targetRecord.status = "SUCCESS";
                    targetRecord.raw.status = "SUCCESS";
                    targetRecord.raw.editor = currentUserId || targetRecord.raw.editor || null;
                    renderHistory();
                } catch (error) {
                    alert(error.message);
                }
            }
        };
    }
}
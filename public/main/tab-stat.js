import { getAllRecords } from './db.js';
import { state } from './store.js';
import { t } from './translations.js';

let allValidRecords = [];
let currentTab = 'month';
let currentMonth = '';

export async function loadStatTab() {
    const container = document.getElementById('stat-content') || document.getElementById('view-stat');
    if (!container) return;

    try {
        container.innerHTML = `<p style='text-align:center; padding: 20px;'>${t('calc_stats')}</p>`;

        const rawRecords = await getAllRecords();

        allValidRecords = rawRecords
            .filter(r => r && r.uploadTimeStr && r.status !== "DELETED")
            .sort((a, b) => new Date(b.uploadTimeStr) - new Date(a.uploadTimeStr));

        currentMonth = allValidRecords.length > 0
            ? allValidRecords[0].uploadTimeStr.substring(0, 7)
            : '';

        renderStatUI(container);
    } catch (e) {
        console.error("❌ 통계 렌더링 에러:", e);
        container.innerHTML = `<p style="color:red; text-align:center;">Error: ${e.message}</p>`;
    }
}

function renderStatUI(container) {
    container.innerHTML = `
        <div class="stat-tabs" style="display: flex; justify-content: space-around; border-bottom: 1px solid #ddd; background: #fff; padding-top: 10px;">
            <div class="stat-tab ${currentTab === '24h' ? 'active' : ''}" data-tab="24h" style="padding: 10px; cursor: pointer; ${currentTab === '24h' ? 'border-bottom: 3px solid #6200ee; font-weight: bold; color: #6200ee;' : 'color: #666;'}">${t('tab_24h')}</div>
            <div class="stat-tab ${currentTab === 'month' ? 'active' : ''}" data-tab="month" style="padding: 10px; cursor: pointer; ${currentTab === 'month' ? 'border-bottom: 3px solid #6200ee; font-weight: bold; color: #6200ee;' : 'color: #666;'}">${t('tab_period')}</div>
        </div>

        <div style="text-align: center; padding: 15px; background: #f8f9fa; font-size: 16px; font-weight: bold;">
            ${currentTab === 'month' ? (currentMonth || '-') : '&nbsp;'}
        </div>

        <div id="stat-table-container" style="overflow-x: auto; background: #fff;"></div>
    `;

    bindStatEvents(container);
    renderStatTable();
}

function bindStatEvents(container) {
    container.querySelectorAll('.stat-tab').forEach(tab => {
        tab.onclick = (e) => {
            currentTab = e.target.getAttribute('data-tab');
            renderStatUI(container);
        };
    });
}

function renderStatTable() {
    const tableContainer = document.getElementById('stat-table-container');
    if (!tableContainer) return;

    let filteredRecords = [];
    const now = Date.now();

    if (currentTab === '24h') {
        const oneDayMs = 24 * 60 * 60 * 1000;
        filteredRecords = allValidRecords.filter(r => (now - r.uploadTime) <= oneDayMs);
    } else {
        filteredRecords = allValidRecords.filter(r => r.uploadTimeStr.startsWith(currentMonth));
    }

    const stats = calculateStats(filteredRecords);

    if (stats.length === 0) {
        tableContainer.innerHTML = `<p style="text-align:center; padding: 30px; color: #999;">${t('no_record')}</p>`;
        return;
    }

    const isThreePlayerMode = state.gameSettings.gameType === 3;

    const rowsHtml = stats.map(st => {
        const scoreColor = st.score > 0 ? '#2e7d32' : (st.score < 0 ? '#c62828' : '#333');
        return `
            <tr style="border-bottom: 1px solid #eee; text-align: center; height: 40px; font-size: 13px;">
                <td style="color: #666;">${st.rank}</td>
                <td style="font-weight: bold; color: #333;">${st.name}</td>
                <td style="color: ${scoreColor}; font-weight: bold;">${st.score > 0 ? '+' : ''}${st.score.toFixed(1)}</td>
                <td style="color: #666;">${st.first.toFixed(1)}</td>
                <td style="color: #666;">${st.second.toFixed(1)}</td>
                <td style="color: #666;">${st.third.toFixed(1)}</td>
                ${!isThreePlayerMode ? `<td style="color: #666;">${st.fourth.toFixed(1)}</td>` : ''}
                <td style="color: #666;">${st.totalGames.toFixed(1)}</td>
            </tr>
        `;
    }).join('');

    tableContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; min-width: 350px;">
            <thead>
                <tr style="background-color: #e0e0e0; color: #555; height: 36px; font-size: 12px;">
                    <th>${t('rank')}</th>
                    <th>${t('nickname')}</th>
                    <th>${t('pts')}</th>
                    <th>1</th>
                    <th>2</th>
                    <th>3</th>
                    ${!isThreePlayerMode ? `<th>4</th>` : ''}
                    <th>${t('games')}</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
        <div style="height: 80px;"></div>`;
}

function calculateStats(records) {
    const settings = state.gameSettings;
    const userMap = {};

    records.forEach(record => {
        const players = [
            { name: record.p1Name, score: record.p1Score, seat: 0 },
            { name: record.p2Name, score: record.p2Score, seat: 1 },
            { name: record.p3Name, score: record.p3Score, seat: 2 },
            { name: record.p4Name, score: record.p4Score, seat: 3 }
        ].filter(p => p.name && p.name.trim() !== "");

        const playerCount = players.length;
        if (playerCount < 2) return;

        const totalScoreOfMatch = players.reduce((sum, p) => sum + p.score, 0);
        const returnScore = totalScoreOfMatch / playerCount;

        let currentUma = settings.uma || [20, 10, -10, -20];
        if (playerCount === 3) currentUma = settings.uma3 || [20, 0, -20];
        if (playerCount === 2) currentUma = [20, -20];

        players.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.seat - b.seat;
        });

        const gameWeight = record.gameLength === 1 ? 0.5 : 1.0;

        players.forEach((player, index) => {
            const name = player.name;
            const rawScore = player.score;
            const rank = index + 1;

            if (!userMap[name]) {
                userMap[name] = { name, totalGames: 0, totalScore: 0, rankCounts: [0, 0, 0, 0, 0] };
            }

            const acc = userMap[name];
            acc.totalGames += gameWeight;
            acc.rankCounts[rank] += gameWeight;

            const basePoint = (rawScore - returnScore) / 1000.0;
            const umaBonus = currentUma[rank - 1] || 0.0;
            let finalPoint = basePoint + umaBonus;

            if (rank === 1) {
                finalPoint += ((record.deposit || 0) / 1000.0);
            }

            acc.totalScore += (finalPoint * gameWeight);
        });
    });

    const statItems = Object.values(userMap).map(acc => {
        if (acc.totalGames <= 0) return null;

        return {
            name: acc.name,
            score: acc.totalScore,
            first: acc.rankCounts[1],
            second: acc.rankCounts[2],
            third: acc.rankCounts[3],
            fourth: acc.rankCounts[4],
            totalGames: acc.totalGames
        };
    }).filter(item => item !== null);

    statItems.sort((a, b) => b.score - a.score);

    return statItems.map((item, index) => ({
        rank: index + 1,
        name: item.name,
        score: Math.round(item.score * 10) / 10,
        first: Math.round(item.first * 10) / 10,
        second: Math.round(item.second * 10) / 10,
        third: Math.round(item.third * 10) / 10,
        fourth: Math.round(item.fourth * 10) / 10,
        totalGames: Math.round(item.totalGames * 10) / 10
    }));
}
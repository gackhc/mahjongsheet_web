// ui.js (상단 Import 부분)
import { state } from './store.js';
import { t } from './translations.js'; // 🌟 다국어 처리를 위한 t 함수 임포트 추가

// 🌟 renderPlayerInputs 함수 전체 교체
export function renderPlayerInputs() {
    // 🌟 다국어 방위 텍스트 적용
    const winds = [t('east'), t('south'), t('west'), t('north')];
    const playerList = document.getElementById('player-inputs');
    
    if (playerList) {
        playerList.innerHTML = ''; 
        winds.forEach((wind, i) => {
            playerList.innerHTML += `
                <div class="player-row" id="row-player-${i}">
                    <div class="wind-label">${wind}</div>
                    <input type="text" class="input-field p-name" placeholder="${t('nickname')}" id="name-${i}">
                    <div class="input-box-wrapper error" id="score-wrapper-${i}">
                        <input type="number" class="p-score" placeholder="${t('score')}" id="score-${i}">
                        <span class="input-suffix">00</span>
                    </div>
                </div>`;
        });
    }
}

export function setupUIEvents(onSaveClick) {
    // 동장/남장 토글
    const btnSouth = document.getElementById('round-south');
    const btnEast = document.getElementById('round-east');
    
    btnSouth?.addEventListener('click', () => {
        btnSouth.classList.add('active');
        btnEast.classList.remove('active');
    });
    btnEast?.addEventListener('click', () => {
        btnEast.classList.add('active');
        btnSouth.classList.remove('active');
    });

    // 입력 감지
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('p-name')) {
            if (e.target.value.trim() !== '') {
                e.target.classList.add('filled');
            } else {
                e.target.classList.remove('filled');
            }
        }
        
        if (e.target.classList.contains('p-score') || e.target.id === 'deposit') {
            const wrapper = e.target.closest('.input-box-wrapper');
            if (wrapper) {
                if (e.target.value.trim() !== '') {
                    wrapper.classList.add('filled');
                    wrapper.classList.remove('error');
                } else {
                    wrapper.classList.remove('filled');
                    wrapper.classList.add('error');
                }
            }
        }
        updateScoreBoard();
    });

    // 저장 버튼 이벤트
    document.getElementById('saveBtn')?.addEventListener('click', onSaveClick);
}
// 🌟 applySettingsToUI 함수 전체 교체
export function applySettingsToUI() {
    const targetEl = document.querySelector('.score-board .target');
    if (targetEl) {
        // 🌟 합계 점수 다국어 적용
        targetEl.innerText = `${t('total_score')} (${t('target')}: ${state.gameSettings.totalScore.toLocaleString()})`;
    }

    if (state.gameSettings.gameType === 3) {
        const p4Row = document.getElementById('row-player-3');
        if (p4Row) p4Row.style.display = 'none';
    }

    updateScoreBoard();
}

// 🌟 updateScoreBoard 함수 전체 교체
export function updateScoreBoard() {
    const scoreInputs = document.querySelectorAll('.p-score');
    const depositInput = document.getElementById('deposit');
    const saveBtn = document.getElementById('saveBtn');
    
    if (!saveBtn) return;

    let sum = parseInt(depositInput?.value || 0) * 100;
    const playerCount = state.gameSettings.gameType === 3 ? 3 : 4;

    for (let i = 0; i < playerCount; i++) {
        sum += parseInt(scoreInputs[i].value || 0) * 100;
    }
    
    const total = sum; 
    const totalSumEl = document.getElementById('total-sum');
    if (totalSumEl) totalSumEl.innerText = total.toLocaleString();

    const diff = state.gameSettings.totalScore - total;
    const statusText = document.getElementById('score-status');
    const scoreboard = document.getElementById('scoreboard');

    const nameInputs = document.querySelectorAll('.p-name');
    let allFilled = true;
    for(let i = 0; i < playerCount; i++){
        if(!nameInputs[i] || !scoreInputs[i] || !nameInputs[i].value.trim() || !scoreInputs[i].value.trim()){
            allFilled = false;
            break;
        }
    }

    if (total === state.gameSettings.totalScore && allFilled) {
        if (statusText) {
            statusText.innerText = "OK"; // 🌟 다국어 간소화
            statusText.style.color = "var(--success)";
        }
        if (scoreboard) scoreboard.classList.add('valid');
        saveBtn.disabled = false;
        saveBtn.classList.add('active');
        saveBtn.innerText = t('save_record'); // 🌟 다국어 적용
    } else {
        if (statusText) {
            if (!allFilled) {
                statusText.innerText = `${playerCount} ${t('need')}`; // 🌟 다국어 적용 (N명 이름/점수 필요 -> N 필요)
            } else if (diff > 0) {
                statusText.innerText = `${diff.toLocaleString()} ${t('need')}`; // 🌟 다국어 적용
            } else {
                statusText.innerText = `${Math.abs(diff).toLocaleString()} Over`; // 🌟 다국어 간소화 (초과 -> Over)
            }
            statusText.style.color = "var(--error)";
        }
        if (scoreboard) scoreboard.classList.remove('valid');
        saveBtn.disabled = true;
        saveBtn.classList.remove('active');
    }
}
export function clearInputs() {
    document.getElementById('deposit').value = '';
    document.getElementById('deposit').closest('.input-box-wrapper').classList.remove('filled');
    document.getElementById('deposit').closest('.input-box-wrapper').classList.add('error');

    document.querySelectorAll('.p-score').forEach(input => {
        input.value = '';
        const wrapper = input.closest('.input-box-wrapper');
        if(wrapper) {
            wrapper.classList.remove('filled');
            wrapper.classList.add('error');
        }
    });

    updateScoreBoard();
}

export function switchView(viewId) {
    document.querySelectorAll('.content-area').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + viewId).classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-view="${viewId}"]`).classList.add('active');
}
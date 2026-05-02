// js/store.js
export const state = {
    gameSettings: {
        lastNo: null,
        totalScore: 100000,
        gameType: 4,
        uma: [20, 10, -10, -20],
        uma3: [20, 0, -20]
    }
};

export function updateGameSettings(newSettings) {
    state.gameSettings = { ...state.gameSettings, ...newSettings };
    console.log("🔄 전역 설정 업데이트됨:", state.gameSettings);
}
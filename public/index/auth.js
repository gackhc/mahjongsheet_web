// 🌟 auth.js (index.html에서만 로드하세요)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
const provider = new GoogleAuthProvider();

// [수정] Google Sheets / Drive 권한 요청 제거
// provider.addScope('https://www.googleapis.com/auth/spreadsheets');
// provider.addScope('https://www.googleapis.com/auth/drive.file');

const urlParams = new URLSearchParams(window.location.search);
const sheetIdFromUrl = urlParams.get('id');

const loginContainer = document.getElementById('login-container');
const loginContainer2 = document.getElementById('login-container2');
const errorMsg = document.getElementById('error-message');
const loginBtn = document.getElementById('googleLoginBtn');
const guestBtn = document.getElementById('guestBtn'); // 🌟 게스트 버튼 요소 가져오기

if (sheetIdFromUrl) {
    sessionStorage.setItem('currentSheetId', sheetIdFromUrl);
    console.log("✅ 시트 ID 세션 저장:", sheetIdFromUrl);
}

// [수정] const 재대입 버그 제거 + 디폴트 시트 ID 제거
const finalSheetId = sheetIdFromUrl || sessionStorage.getItem('currentSheetId');

if (!finalSheetId) {
    // 🌟 시트 ID가 없으면 로그인 컨테이너와 게스트 버튼 모두 숨김
    if (loginContainer) loginContainer.style.display = 'none';
    if (loginContainer2) loginContainer2.style.display = 'none';
    if (guestBtn) guestBtn.style.display = 'none';
    if (errorMsg) errorMsg.style.display = 'block';
    console.error("❌ 시트 ID가 없습니다. 잘못된 접근입니다.");
} else {
    // 🌟 시트 ID가 있으면 에러를 숨기고 로그인/게스트 버튼 표시
    if (errorMsg) errorMsg.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'block';
    if (loginContainer2) loginContainer2.style.display = 'block';
    if (guestBtn) guestBtn.style.display = 'inline-block';

    let isAuthHandled = false;
    let isLoginInProgress = false;

    onAuthStateChanged(auth, (user) => {
        // 🌟 로그인 진행 중이거나 이미 처리됐으면 무시
        if (isAuthHandled || isLoginInProgress) return;

        // [수정] accessToken 존재 여부가 아니라 Firebase 로그인 상태만으로 판단
        if (user) {
            console.log("✅ Firebase 로그인 상태 확인됨. 메인으로 이동.");
            sessionStorage.setItem('authMode', 'user'); // [수정] 토큰 대신 authMode 저장
            isAuthHandled = true;
            window.location.replace("main.html");
        } else {
            console.log("⏳ 로그아웃 상태. 로그인 버튼 표시.");
            if (loginContainer) loginContainer.style.display = 'block';
            if (loginContainer2) loginContainer2.style.display = 'block';
        }
    });

    loginBtn?.addEventListener('click', async () => {
        try {
            isLoginInProgress = true; // 로그인 시작

            // [수정] Firebase Google 로그인만 사용
            await signInWithPopup(auth, provider);

            // [수정] Sheets/Drive accessToken 저장 제거
            // sessionStorage.setItem('googleAccessToken', credential.accessToken);

            sessionStorage.setItem('authMode', 'user'); // [수정] 로그인 모드만 저장

            console.log("✅ 로그인 성공. 메인으로 이동.");
            isAuthHandled = true;
            window.location.replace("main.html");
        } catch (error) {
            isLoginInProgress = false;
            console.error("❌ 로그인 실패:", error);
            alert("로그인에 실패했습니다: " + error.message);
        }
    });
}
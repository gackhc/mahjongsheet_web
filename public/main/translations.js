// [전체코드] translations.js
export const translations = {
    ko: {
        // 공통
        input: "입력",
        history: "목록",
        stats: "통계",
        settings: "설정",
        cancel: "취소",
        save: "저장하기",
        edit: "수정하기",
        delete: "삭제",
        restore: "복구",
        confirm_delete: "이 기록을 삭제하시겠습니까?",
        logout: "로그아웃", // 🌟 추가
        
        // 입력 탭
        east: "동",
        south: "남",
        west: "서",
        north: "북",
        score: "점수",
        nickname: "닉네임",
        deposit: "공탁금",
        total_score: "합계 점수",
        target: "목표",
        edit_mode_title: "✏️ 원본 데이터 (수정 중)",
        cancel_edit: "수정 취소",
        save_record: "기록 저장하기", // 추가
        need: "필요", // 추가
        input_history: "이전 기록",
        direct_input_create: "직접입력/생성",
        input_success: "입력 성공했습니다.",
        
        // 목록 탭
        no_record: "기록이 없습니다.",
        loading: "데이터를 불러오는 중...", // 수정
        round_east: "동장전",
        round_south: "남장전",
        
        // 통계 탭
        rank: "순위",
        pts: "승점",
        games: "국수",
        tab_24h: "24시간 순위",
        tab_period: "월간 순위",
        tab_all: "전체 순위",
        calc_stats: "통계 계산 중...", // 추가
        
        // 로그인 및 안내
        login_guide_title: "⚠️ 로그인을 위해 Safari로 열어주세요",
        login_guide_desc: "구글 보안 정책으로 인해 현재 브라우저에서는 로그인이 안 됩니다.",
        login_title: "마작기록장", // 추가
        login_google: "구글 계정으로 로그인", // 추가
        login_playstore: "Play 스토어로 연결", // 추가
        login_guest: "게스트로 기록 확인", // 🌟 추가
        privacy_policy: "개인정보처리방침", // 추가
        terms_of_service: "서비스 약관", // 추가
        invalid_sheet_id: "⚠️ 시트 ID가 유효하지 않습니다.", // 추가
        invalid_sheet_desc: "올바른 링크(ID 포함)로 다시 접속해주세요.", // 추가

   // [수정] 소개글 문구를 Google Sheets 기준에서 Firestore/클라우드 저장 기준으로 변경
        landing_desc1: "마작기록장은 오프라인 리치 마작을 즐기는 플레이어들을 위한 스마트한 점수 기록 및 통계 관리 웹 애플리케이션입니다. 더 이상 종이와 펜으로 복잡한 점수를 계산할 필요가 없습니다. 동장전과 남장전을 완벽하게 지원하며, 각 플레이어의 닉네임과 점수를 입력하면 총점과 우마, 공탁금을 자동으로 계산하여 정확한 결과를 도출합니다. 모든 데이터는 연동된 클라우드 데이터베이스에 실시간으로 안전하게 저장되어 데이터 유실의 걱정을 줄여줍니다.",
        landing_desc2: "단순한 기록을 넘어 강력한 통계 기능을 제공합니다. 지난 24시간 동안의 성적, 월별 기간 통계, 그리고 전체 누적 순위를 한눈에 확인할 수 있습니다. 플레이어별 평균 순위, 1위부터 4위까지의 달성 비율, 누적 승점 등을 분석하여 자신의 마작 실력을 객관적으로 파악해 보세요.",
        landing_desc3: "앱 설치 없이 웹 브라우저만으로 언제 어디서나 간편하게 접근할 수 있으며, 구글 계정 연동을 통해 본인과 공유된 그룹 데이터를 안전하게 관리할 수 있습니다. 모임의 다른 멤버들은 '게스트 모드'를 통해 별도의 로그인 없이도 실시간 리더보드와 통계를 확인할 수 있어 오프라인 마작 모임에 최적화되어 있습니다.",
        landing_cta: "마작 기록장을 만들고 관리하고 편의기능을 모두 사용하려면 플레이스토어에서 마작기록장을 다운받아주세요."
    },
    en: {
        // 공통
        input: "Input",
        history: "History",
        stats: "Stats",
        settings: "Settings",
        cancel: "Cancel",
        save: "Save",
        edit: "Edit",
        delete: "Delete",
        restore: "Restore",
        confirm_delete: "Are you sure you want to delete this record?",
        logout: "Logout", // 🌟 추가
        input_success: "Input completed successfully.",
        
        // 입력 탭
        east: "E",
        south: "S",
        west: "W",
        north: "N",
        score: "Score",
        nickname: "Name",
        deposit: "Deposit",
        total_score: "Total",
        target: "Target",
        edit_mode_title: "✏️ Original Data (Editing)",
        cancel_edit: "Cancel Edit",
        save_record: "Save Record", // 추가
        need: "Needed", // 추가
        input_history: "Input History",
        direct_input_create: "Direct Input/Create",
        
        // 목록 탭
        no_record: "No records found.",
        loading: "Loading data...", // 수정
        round_east: "East Round",
        round_south: "South Round",
        
        // 통계 탭
        rank: "Rank",
        pts: "Pts",
        games: "Gms",
        tab_24h: "24H Rank",
        tab_period: "Monthly Rank",
        tab_all: "Total Rank",
        calc_stats: "Calculating stats...", // 추가

        // 로그인 및 안내
        login_guide_title: "⚠️ Please open in Safari for Login",
        login_guide_desc: "Google security policy blocks login in the current browser.",
        login_title: "Mahjong Sheet", // 추가
        login_google: "Sign in with Google", // 추가
        login_playstore: "Get it on Google Play", // 추가
        login_guest: "View records as guest", // 🌟 추가
        privacy_policy: "Privacy Policy", // 추가
        terms_of_service: "Terms of Service", // 추가
        invalid_sheet_id: "⚠️ Invalid Sheet ID.", // 추가
        invalid_sheet_desc: "Please access again with the correct link (including ID).", // 추가
         // [수정] Google Sheets 직접 언급 제거
        landing_desc1: "Mahjong Sheets is a smart score tracking and statistics management web application for offline Riichi Mahjong players. You no longer need paper and pen to calculate complex scores. We fully support East and South rounds. Just input the players' nicknames and scores, and the app automatically calculates the total, uma, and deposits. All data is synchronized and safely stored in a connected cloud database in real time.",
        landing_desc2: "Furthermore, it provides powerful statistical features. You can check the 24-hour performance, monthly stats, and overall rankings at a glance. Analyze your average placement, rank distribution, and cumulative points to objectively understand your Mahjong skills.",
        landing_desc3: "Accessible via any web browser without installation. You can safely manage your own and shared group data through Google account integration. Group members can use 'Guest Mode' to view real-time leaderboards and stats without logging in. Manage your Mahjong meetups smartly and systematically with Mahjong Sheets!",
        landing_cta: "To create, manage, and use all convenient features, please download 'Mahjong Sheets' from the Play Store."
   },
    ja: {
        // 공통
        input: "入力",
        history: "履歴",
        stats: "統計",
        settings: "設定",
        cancel: "キャンセル",
        save: "保存",
        edit: "修正",
        delete: "削除",
        restore: "復旧",
        confirm_delete: "この記録を削除しますか？",
        logout: "ログアウト", // 🌟 추가
        direct_input_create: "直接入力/作成",
        input_success: "入力が完了しました。",

        // 입력 탭
        east: "東",
        south: "南",
        west: "西",
        north: "北",
        score: "点数",
        nickname: "名前",
        deposit: "供託金",
        total_score: "合計",
        target: "目標",
        edit_mode_title: "✏️ 元データ (修正中)",
        cancel_edit: "修正キャンセル",
        save_record: "記録を保存する", // 추가
        need: "必要", // 추가
        input_history: "入力履歴",

        // 목록 탭
        no_record: "記録がありません。",
        loading: "データを読み込み中...", // 수정
        round_east: "東風戦",
        round_south: "半荘戦",

        // 통계 탭
        rank: "順位",
        pts: "ポイント",
        games: "局数",
        tab_24h: "24時間",
        tab_period: "月間",
        tab_all: "総合",
        calc_stats: "統計を計算中...", // 추가

        // 로그인 및 안내
        login_guide_title: "⚠️ ログインのため Safari で開いてください",
        login_guide_desc: "Google のセキュリティポリシーにより、現在のブラウザではログインできません。",
        login_title: "麻雀記録帳", // 추가
        login_google: "Googleでログイン", // 추가
        login_playstore: "Play ストアで入手", // 추가
        login_guest: "ゲストとして記録を確認", // 🌟 추가
        privacy_policy: "プライバシーポリシー", // 추가
        terms_of_service: "利用規約", // 추가
        invalid_sheet_id: "⚠️ シートIDが無効です。", // 추가
        invalid_sheet_desc: "正しいリンク（IDを含む）で再度アクセスしてください。", // 추가
          // [수정] 일본어 소개글도 Google Sheets 직접 표현 제거
        landing_desc1: "麻雀記録帳は、オフラインでリーチ麻雀を楽しむプレイヤーのためのスマートな点数記録・統計管理ウェブアプリです。紙とペンで複雑な点数計算をする必要はもうありません。東風戦と半荘戦の両方に対応しており、各プレイヤーのニックネームと点数を入力するだけで、合計点・ウマ・供託金を自動で計算します。すべてのデータは連携されたクラウドデータベースにリアルタイムで安全に保存されます。",
        landing_desc2: "単なる記録にとどまらず、強力な統計機能も提供します。過去24時間の成績、月別統計、累積順位をひと目で確認できます。平均順位、1位から4位までの達成率、累積ポイントなどを分析して、自分の麻雀の実力を客観的に把握できます。",
        landing_desc3: "アプリをインストールしなくても、ウェブブラウザだけでいつでも簡単に利用できます。Googleアカウント連携により、自分や共有されたグループデータを安全に管理できます。他のメンバーは『ゲストモード』でログインなしでもリアルタイムの順位表や統計を確認でき、オフライン麻雀会に最適です。",
        landing_cta: "麻雀記録帳を作成・管理し、すべての便利な機能を使うには、Playストアからダウンロードしてください。"
    },
    zh: { // 중국어 추가
        // 공통
        input: "输入",
        history: "历史",
        stats: "统计",
        settings: "设置",
        cancel: "取消",
        save: "保存",
        edit: "修改",
        delete: "删除",
        restore: "恢复",
        confirm_delete: "您确定要删除此记录吗？",
        logout: "登出", // 🌟 추가
        input_history: "输入记录",

        // 입력 탭
        east: "东",
        south: "南",
        west: "西",
        north: "北",
        score: "分数",
        nickname: "昵称",
        deposit: "押金",
        total_score: "总分",
        target: "目标",
        edit_mode_title: "✏️ 原始数据 (修改中)",
        cancel_edit: "取消修改",
        save_record: "保存记录",
        need: "需要",
        direct_input_create: "直接输入/创建",
        input_success: "输入成功。",

        // 목록 탭
        no_record: "没有记录。",
        loading: "正在加载数据...",
        round_east: "东风战",
        round_south: "半庄战",

        // 통계 탭
        rank: "排名",
        pts: "点数",
        games: "局数",
        tab_24h: "24小时排名",
        tab_period: "本月排名",
        tab_all: "总排名",
        calc_stats: "正在计算统计数据...",

        // 로그인 및 안내
        login_guide_title: "⚠️ 请在 Safari 中打开以登录",
        login_guide_desc: "由于谷歌的安全政策，当前浏览器无法登录。",
        login_title: "麻将记录本",
        login_google: "使用 Google 登录",
        login_playstore: "在 Play 商店获取",
        login_guest: "作为访客查看记录", // 🌟 추가
        privacy_policy: "隐私政策",
        terms_of_service: "服务条款",
        invalid_sheet_id: "⚠️ 表格 ID 无效。",
        invalid_sheet_desc: "请使用正确的链接（包含 ID）重新访问。",

         // [수정] 중국어 소개글도 동일 방향으로 정리
        landing_desc1: "麻将记录帐是一款面向线下立直麻将玩家的智能记分与统计管理网页应用。你不再需要用纸笔计算复杂分数。它完整支持东风战与南风战，只需输入玩家昵称和分数，系统就会自动计算总分、乌马和供托。所有数据都会实时同步并安全存储到关联的云数据库中。",
        landing_desc2: "它不仅能记录成绩，还提供强大的统计功能。你可以一眼查看过去24小时成绩、按月统计以及总排名。通过分析平均顺位、各名次比例和累计得点，更客观地了解自己的麻将水平。",
        landing_desc3: "无需安装应用，只需网页浏览器即可随时使用。通过 Google 账号登录，你可以安全管理自己以及共享的群组数据。其他成员还可以通过“游客模式”在不登录的情况下查看实时排行榜和统计信息，非常适合线下麻将聚会使用。",
        landing_cta: "如果你想创建、管理并使用全部便利功能，请在 Play 商店下载麻将记录帐。"
   }
};

// 지원하는 언어 목록
const supportedLangs = ['ko', 'en', 'ja', 'zh'];

// 초기 언어 설정 로직
function getDefaultLanguage() {
    // 1. 사용자가 이전에 선택한 언어가 로컬 스토리지에 있는지 확인
    const storedLang = localStorage.getItem('appLanguage');
    if (storedLang && supportedLangs.includes(storedLang)) {
        return storedLang;
    }

    // 2. 브라우저 언어 감지 (예: 'ko-KR' -> 'ko', 'en-US' -> 'en')
    const browserLang = (navigator.language || navigator.userLanguage || '').substring(0, 2).toLowerCase();
    
    // 3. 감지된 브라우저 언어가 지원 목록에 있으면 해당 언어 사용, 없으면 영어('en') 반환
    if (supportedLangs.includes(browserLang)) {
        return browserLang;
    }
    
    return 'en';
}

// 현재 언어 설정 적용
let currentLang = getDefaultLanguage();

export function t(key) {
    return translations[currentLang][key] || key;
}

export function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('appLanguage', lang);
    location.reload(); // 언어 변경 시 새로고침하여 반영
}

export function getLanguage() {
    return currentLang;
}
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// src/components/TopPage/TopPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import Settings from '../common/Settings/Settings';
import { unlockAudioContext, stopSpeaking } from '../../services/speechSynthesis';
import { useOffline } from '../../hooks/useOffline';
import { getAvailableGenres, getAvailableDifficultiesForGenre, getAllAvailableQuizzesCount } from '../../services/quizEngine';
import Toast from '../common/Toast/Toast';
import { useSettingsStore } from '../../store/settingsStore';
import { usePurchaseStore } from '../../store/purchaseStore';
import { speechRecognitionService, detectVoiceCommand } from '../../services/speechRecognition';
const GENRE_RUBY = {
    '動物': 'どうぶつ',
    '昆虫': 'こんちゅう',
    '植物': 'しょくぶつ',
    '魚類': 'さかな',
    '鳥類': 'とりるい',
    '爬虫類': 'はちゅうるい',
    '哺乳類': 'ほにゅうるい',
    '海洋生物': 'かいようせいぶつ',
    '乗り物': 'のりもの',
    '道具': 'どうぐ',
    '歴史上の人物': 'れきしのじんぶつ',
    '日本の地理': 'にほんのちり',
    '世界の地理': 'せかいのちり',
};
const TOP_PAGE_GENRE_KEY = 'quizAppSelectedGenre';
const TOP_PAGE_DIFFICULTY_KEY = 'quizAppSelectedDifficulty';
const TopPage = ({ onStart, initialView = 'genre' }) => {
    const { isMuted, setIsMuted, isHandsFree: isHandsFreeMode, setIsHandsFree: setIsHandsFreeMode } = useSettingsStore();
    const { isLoggedIn, isPurchased } = usePurchaseStore();
    const isPremiumUser = isLoggedIn;
    const [showSettings, setShowSettings] = useState(false);
    const [isSpeakingAllowed, setIsSpeakingAllowed] = useState(false);
    const isOffline = useOffline();
    const [toastMessage, setToastMessage] = useState(null);
    useEffect(() => {
        setIsHandsFreeMode(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const initialGenre = localStorage.getItem(TOP_PAGE_GENRE_KEY) || getAvailableGenres()[0];
    const initialDifficulty = parseInt(localStorage.getItem(TOP_PAGE_DIFFICULTY_KEY) || '1', 10);
    const [localSelectedGenre, setLocalSelectedGenre] = useState(initialGenre);
    const [localSelectedDifficulty, setLocalSelectedDifficulty] = useState(initialDifficulty);
    const [localSelectedCount, setLocalSelectedCount] = useState(10);
    const [showDifficultySelection, setShowDifficultySelection] = useState(initialView === 'difficulty');
    useEffect(() => {
        localStorage.setItem(TOP_PAGE_GENRE_KEY, localSelectedGenre);
        localStorage.setItem(TOP_PAGE_DIFFICULTY_KEY, String(localSelectedDifficulty));
    }, [localSelectedGenre, localSelectedDifficulty]);
    const handleStartQuiz = async () => {
        if (!isSpeakingAllowed) {
            await unlockAudioContext();
            setIsSpeakingAllowed(true);
        }
        onStart(localSelectedGenre, localSelectedDifficulty);
    };
    const handleToggleMute = useCallback(() => {
        const newState = !isMuted;
        setIsMuted(newState);
        if (newState) {
            stopSpeaking();
        }
        else {
            if (!isSpeakingAllowed) {
                unlockAudioContext();
                setIsSpeakingAllowed(true);
            }
        }
    }, [isMuted, setIsMuted, isSpeakingAllowed, setIsSpeakingAllowed]);
    const genres = getAvailableGenres();
    const getDifficultyLabel = (difficulty) => `Lv.${difficulty}`;
    const getGenreIcon = (genreName) => {
        switch (genreName) {
            case '動物': return '🦁';
            case '昆虫': return '🐛';
            case '植物': return '🌿';
            case '乗り物': return '🚗';
            case '道具': return '🔨';
            case '歴史上の人物': return '🗿';
            case '日本の地理': return '🗾';
            case '世界の地理': return '🌍';
            default: return '❓';
        }
    };
    const handleGenreSelect = useCallback((genre) => {
        setLocalSelectedGenre(genre);
        const availableDifficulties = getAvailableDifficultiesForGenre(genre);
        let defaultDifficulty = availableDifficulties[0] || 1;
        if (!isPremiumUser) {
            const guestAllowedDifficulties = [1, 2, 6, 7];
            const availableGuestDifficulties = availableDifficulties.filter(d => guestAllowedDifficulties.includes(d));
            if (availableGuestDifficulties.length > 0) {
                defaultDifficulty = Math.min(...availableGuestDifficulties);
            }
            else {
                defaultDifficulty = 1;
            }
        }
        setLocalSelectedDifficulty(defaultDifficulty);
    }, [isPremiumUser]);
    const handleGenreSelectRef = useRef(handleGenreSelect);
    useEffect(() => { handleGenreSelectRef.current = handleGenreSelect; }, [handleGenreSelect]);
    useEffect(() => {
        if (!isHandsFreeMode)
            return;
        speechRecognitionService.onResult((transcript, isFinal) => {
            if (!isFinal)
                return;
            const command = detectVoiceCommand(transcript);
            if (command?.startsWith('genre:')) {
                const genre = command.replace('genre:', '');
                handleGenreSelectRef.current(genre);
            }
        });
        return () => { speechRecognitionService.onResult(() => { }); };
    }, [isHandsFreeMode]);
    const showToast = useCallback((message) => {
        setToastMessage(message);
    }, []);
    const handleDifficultyButtonClick = useCallback((difficulty, isLocked) => {
        if (isLocked) {
            if (isOffline) {
                showToast('オフラインのため購入できません。接続後にお試しください。');
            }
            else {
                showToast('購入画面へ遷移します。（ダミー）');
            }
        }
        else {
            setLocalSelectedDifficulty(difficulty);
        }
    }, [isOffline, showToast]);
    const GENRE_COLORS = {
        '動物': '#FF6B6B', '昆虫': '#51CF66', '植物': '#20C997',
        '乗り物': '#339AF0', '道具': '#F59F00', '歴史上の人物': '#AE3EC9',
        '日本の地理': '#F76707', '世界の地理': '#1098AD',
    };
    const difficultiesForSelectedGenre = getAvailableDifficultiesForGenre(localSelectedGenre);
    return (_jsxs("div", { style: containerStyle, children: [_jsx("style", { children: `rt { font-size: 0.5em; font-weight: normal; } .btn-ruby rt { font-size: 0.35em !important; } .btn-ruby { font-size: 0.6em; } .btn-ruby > :not(rt) { font-size: calc(1/0.6 * 1em); } @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} } .lock-balloon { animation: float 2s ease-in-out infinite; }` }), _jsxs("header", { style: stickyHeaderStyle, children: [_jsx("h1", { style: titleStyle, onClick: () => setShowDifficultySelection(false), children: "\u308F\u305F\u3057\u306F\u30C0\u30EC\u3067\u3057\u3087\u3046\uFF1F\u30AF\u30A4\u30BA" }), _jsxs("div", { style: headerIconsStyle, children: [_jsx("button", { onClick: () => setShowSettings(true), style: iconButtonStyle, children: "\u2699\uFE0F" }), _jsx("button", { onClick: handleToggleMute, style: iconButtonStyle, children: isMuted ? '🔇' : '🔊' }), _jsx("button", { onClick: () => setIsHandsFreeMode(!isHandsFreeMode), style: { ...iconButtonStyle, opacity: isHandsFreeMode ? 1 : 0.4 }, children: "\uD83C\uDFA4" })] })] }), !showDifficultySelection && _jsx("p", { style: cautionStyle, children: "\u26A0\uFE0F \u58F0\u3067\u64CD\u4F5C\u3067\u304D\u307E\u3059\u304C\u3001\u904B\u8EE2\u4E2D\u306B\u753B\u9762\u306E\u64CD\u4F5C\u306FNG\u3067\u3059\uFF01" }), !showDifficultySelection && _jsx("div", { style: hashtagContainerStyle, children: ['#子どもから大人まで', '#レベル選べる', '#ハンズフリー', '#勉強・豆知識になる', '#運転中でもできる', '#声で読み上げ', '#ヒントあり', '#全問ランダム出題', '#オフラインでも遊べる'].map((tag) => (_jsx("span", { style: hashtagStyle, children: tag }, tag))) }), !showDifficultySelection && (_jsxs("div", { style: playModeContainerStyle, children: [_jsx("h2", { style: sectionTitleStyle, children: "\u3042\u305D\u3073\u304B\u305F\u3092\u3048\u3089\u3093\u3067\u306D\uFF01" }), _jsxs("div", { style: playModeGridStyle, children: [_jsxs("button", { onClick: () => { setIsHandsFreeMode(true); if (isMuted) {
                                    setIsMuted(false);
                                    unlockAudioContext();
                                    setIsSpeakingAllowed(true);
                                } }, style: { ...playModeButtonStyle, background: isHandsFreeMode ? 'linear-gradient(135deg, #FF6EC7, #FF9A3C)' : 'rgba(255,255,255,0.9)', color: isHandsFreeMode ? '#fff' : '#d63384', border: isHandsFreeMode ? '3px solid #FF6EC7' : '3px solid #FFB3D9', boxShadow: isHandsFreeMode ? '0 5px 0 #D94F9A' : '0 4px 0 #FFB3D9' }, children: [_jsx("span", { style: playModeIconStyle, children: "\uD83C\uDFA4" }), _jsxs("span", { children: [_jsxs("ruby", { children: ["\u58F0", _jsx("rt", { children: "\u3053\u3048" })] }), "\u3067\u3042\u305D\u3076"] })] }), _jsxs("button", { onClick: () => setIsHandsFreeMode(false), style: { ...playModeButtonStyle, background: !isHandsFreeMode ? 'linear-gradient(135deg, #54A0FF, #1DD1A1)' : 'rgba(255,255,255,0.9)', color: !isHandsFreeMode ? '#fff' : '#1971c2', border: !isHandsFreeMode ? '3px solid #54A0FF' : '3px solid #a5d8ff', boxShadow: !isHandsFreeMode ? '0 5px 0 #1098AD' : '0 4px 0 #a5d8ff' }, children: [_jsx("span", { style: playModeIconStyle, children: "\uD83D\uDC46" }), _jsx("span", { children: "\u30BF\u30C3\u30D7\u3067\u3042\u305D\u3076" })] })] })] })), !showDifficultySelection ? (
            // ジャンル選択画面
            _jsxs(_Fragment, { children: [_jsxs("div", { style: genreSelectionContainerStyle, children: [_jsx("h2", { style: sectionTitleStyle, children: "\u30B8\u30E3\u30F3\u30EB\u3092\u3048\u3089\u3093\u3067\u306D\uFF01" }), _jsx("div", { style: genreGridStyle, children: genres.map((genre) => (_jsxs("button", { onClick: () => handleGenreSelect(genre), style: {
                                        ...genreButtonStyle,
                                        backgroundColor: GENRE_COLORS[genre] || '#FF6B6B',
                                        boxShadow: localSelectedGenre === genre ? `0 0 0 2px #fff, 0 0 0 4px ${GENRE_COLORS[genre] || '#FF6B6B'}` : '0 5px 0 rgba(0,0,0,0.15)',
                                        transform: localSelectedGenre === genre ? 'scale(1.08)' : 'scale(1)',
                                    }, children: [_jsx("span", { style: genreIconStyle, children: getGenreIcon(genre) }), _jsxs("ruby", { children: [genre, _jsx("rt", { style: { fontSize: '0.55em', fontWeight: 'normal' }, children: GENRE_RUBY[genre] ?? '' })] })] }, genre))) })] }), _jsx("div", { style: { marginTop: '20px', display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '620px' }, children: _jsx("button", { onClick: () => setShowDifficultySelection(true), style: buttonStyle, children: "\u3080\u305A\u304B\u3057\u3055\u3092\u3048\u3089\u3076 \u2192" }) })] })) : (
            // 難易度選択画面
            _jsxs(_Fragment, { children: [_jsxs("div", { style: difficultySelectionContainerStyle, children: [_jsxs("h2", { style: { ...sectionTitleStyle, fontSize: '1.1em' }, children: [_jsx("span", { style: genreIconStyle, children: getGenreIcon(localSelectedGenre) }), "\u3080\u305A\u304B\u3057\u3055\u3092\u3048\u3089\u3093\u3067\u306D\uFF01"] }), _jsx("div", { style: difficultyGridStyle, children: difficultiesForSelectedGenre.map((difficulty) => {
                                    const isLocked = !isPremiumUser && [3, 4, 5, 8, 9, 10].includes(difficulty);
                                    const totalCount = getAllAvailableQuizzesCount(localSelectedGenre, difficulty);
                                    return (_jsxs("button", { onClick: () => handleDifficultyButtonClick(difficulty, isLocked), style: {
                                            ...difficultyButtonStyle,
                                            backgroundColor: isLocked ? '#B0B0B0' : localSelectedDifficulty === difficulty ? '#FF6EC7' : ['#FF6B6B', '#FF9F43', '#FECA57', '#1DD1A1', '#54A0FF', '#5F27CD', '#FF6B6B', '#FF9F43', '#FECA57', '#1DD1A1'][difficulty - 1],
                                            boxShadow: isLocked ? '0 4px 0 #888' : localSelectedDifficulty === difficulty ? '0 0 0 2px #fff, 0 0 0 4px #FF6EC7' : '0 5px 0 rgba(0,0,0,0.15)',
                                            transform: localSelectedDifficulty === difficulty ? 'scale(1.08)' : 'scale(1)',
                                            cursor: isLocked ? 'not-allowed' : 'pointer',
                                        }, children: [getDifficultyLabel(difficulty), _jsxs("p", { style: playedCountStyle, children: [_jsxs("ruby", { className: "btn-ruby", children: ["\u5168", _jsx("rt", { children: "\u305C\u3093" })] }), totalCount, _jsxs("ruby", { className: "btn-ruby", children: ["\u554F", _jsx("rt", { children: "\u3082\u3093" })] }), isLocked && _jsx("span", { style: { fontSize: '1.4em', marginLeft: '3px' }, children: "\uD83D\uDD12" })] }), isLocked && (_jsxs("span", { className: "lock-balloon", style: lockBalloonStyle, children: ["150\u5186\u3067\u89E3\u653E\uFF01", _jsx("span", { style: lockBalloonTailStyle })] }))] }, difficulty));
                                }) })] }), _jsxs("div", { style: { ...difficultySelectionContainerStyle, marginTop: '20px' }, children: [_jsxs("h2", { style: { ...sectionTitleStyle, fontSize: '1.1em' }, children: [_jsxs("ruby", { children: ["\u554F\u984C\u6570", _jsx("rt", { children: "\u3082\u3093\u3060\u3044\u3059\u3046" })] }), "\u3092\u3048\u3089\u3093\u3067\u306D\uFF01"] }), _jsx("div", { style: questionCountGridStyle, children: [5, 10].map((count) => (_jsxs("button", { onClick: () => setLocalSelectedCount(count), style: {
                                        ...difficultyButtonStyle,
                                        flexDirection: 'row',
                                        minHeight: 'unset',
                                        padding: '14px 10px',
                                        backgroundColor: localSelectedCount === count ? '#FF6EC7' : '#54A0FF',
                                        boxShadow: localSelectedCount === count ? '0 0 0 2px #fff, 0 0 0 4px #FF6EC7' : '0 5px 0 rgba(0,0,0,0.15)',
                                        transform: localSelectedCount === count ? 'scale(1.08)' : 'scale(1)',
                                    }, children: [count, _jsxs("ruby", { children: ["\u554F", _jsx("rt", { children: "\u3082\u3093" })] })] }, count))) })] }), _jsxs("div", { style: bottomButtonsContainerStyle, children: [_jsx("button", { onClick: () => setShowDifficultySelection(false), style: { ...buttonStyle, background: '#ccc', color: '#555', boxShadow: '0 5px 0 #999' }, children: "\u2190 \u30B8\u30E3\u30F3\u30EB\u3048\u3089\u3073\u306B\u3082\u3069\u308B" }), _jsx("button", { onClick: handleStartQuiz, style: buttonStyle, disabled: !isPremiumUser && [3, 4, 5, 8, 9, 10].includes(localSelectedDifficulty), children: "\u30AF\u30A4\u30BA\u30B9\u30BF\u30FC\u30C8\uFF01 \u2192" })] })] })), showSettings && (_jsx(Settings, { onClose: () => setShowSettings(false), onLoginStatusChange: () => { }, currentView: "TOP" })), _jsx(Toast, { message: toastMessage, onClose: () => setToastMessage(null) })] }));
};
const stickyHeaderStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '64px',
    background: 'linear-gradient(90deg, #FF6EC7 0%, #FF9A3C 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    zIndex: 1000,
    boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
};
const titleStyle = {
    cursor: 'pointer',
    color: '#fff',
    fontSize: 'clamp(0.7em, 3vw, 1.3em)',
    margin: 0,
    textShadow: '1px 2px 0 rgba(0,0,0,0.18)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flexShrink: 1,
    minWidth: 0,
};
const headerIconsStyle = { display: 'flex', gap: '8px', flexShrink: 0 };
const iconButtonStyle = { backgroundColor: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.6em', cursor: 'pointer', boxShadow: '0 3px 6px rgba(0,0,0,0.15)' };
const containerStyle = {
    fontFamily: "'Yomogi', cursive",
    background: 'linear-gradient(135deg, #FF9DE2 0%, #FFD6A5 50%, #FFFB8F 100%)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '84px',
    paddingLeft: '20px',
    paddingRight: '20px',
    paddingBottom: '100px',
    boxSizing: 'border-box',
};
const cautionStyle = { fontSize: '0.78em', color: '#a0522d', background: 'rgba(255,255,255,0.6)', borderRadius: '20px', padding: '6px 16px', margin: '0 0 10px 0', textAlign: 'center', maxWidth: '620px', width: '100%', boxSizing: 'border-box' };
const hashtagContainerStyle = { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '20px', maxWidth: '620px', width: '100%' };
const hashtagStyle = { background: 'rgba(255,255,255,0.75)', color: '#FF5FA0', borderRadius: '50px', padding: '4px 10px', fontSize: '0.75em', fontWeight: 'bold', boxShadow: '0 3px 0 rgba(255,100,180,0.2)', whiteSpace: 'nowrap' };
const playModeContainerStyle = { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '30px', padding: '24px 30px', boxShadow: '0 8px 32px rgba(255,100,180,0.2)', width: '100%', maxWidth: '620px', boxSizing: 'border-box', marginBottom: '20px' };
const playModeGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
const playModeButtonStyle = { padding: '20px 10px', borderRadius: '20px', border: 'none', fontSize: '1.1em', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' };
const playModeIconStyle = { fontSize: '2.4em' };
const sectionTitleStyle = { color: '#FF5FA0', fontSize: '1.6em', margin: '0 0 25px 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textShadow: '1px 1px 0 #fff' };
const genreSelectionContainerStyle = { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '30px', padding: '30px', boxShadow: '0 8px 32px rgba(255,100,180,0.2)', width: '100%', maxWidth: '620px', boxSizing: 'border-box' };
const genreGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
const genreButtonStyle = { padding: '14px 16px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.8)', fontSize: '1.1em', fontWeight: 'bold', color: '#fff', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', textShadow: '1px 1px 2px rgba(0,0,0,0.2)', justifyContent: 'center' };
const genreIconStyle = { fontSize: '2em', flexShrink: 0 };
const difficultySelectionContainerStyle = { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '30px', padding: '30px', boxShadow: '0 8px 32px rgba(255,100,180,0.2)', width: '100%', maxWidth: '620px', boxSizing: 'border-box' };
const difficultyGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '14px', marginBottom: '28px' };
const difficultyButtonStyle = { padding: '15px 10px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.8)', fontSize: '1.1em', fontWeight: 'bold', color: '#fff', cursor: 'pointer', transition: 'transform 0.1s', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '90px', textAlign: 'center', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' };
const lockIconStyle = { fontSize: '1em', marginLeft: '3px' };
const lockBalloonStyle = { position: 'absolute', bottom: '-30px', left: '50%', transform: 'translateX(-50%)', background: '#fff', color: '#d63384', fontSize: '0.55em', fontWeight: 'bold', padding: '3px 7px', borderRadius: '10px', boxShadow: '0 3px 8px rgba(0,0,0,0.18)', whiteSpace: 'nowrap', lineHeight: '1.4', zIndex: 2, border: '1.5px solid #FFB3D9' };
const lockBalloonTailStyle = { position: 'absolute', top: '-7px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid #fff' };
const playedCountStyle = { fontSize: '0.72em', color: '#fff', marginTop: '2px', marginBottom: '0' };
const questionCountGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' };
const bottomButtonsContainerStyle = { display: 'flex', justifyContent: 'space-around', gap: '15px', marginTop: '20px', width: '100%', maxWidth: '620px' };
const buttonStyle = { background: 'linear-gradient(135deg, #FF6EC7, #FF9A3C)', color: 'white', padding: '14px 28px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: '0 5px 0 #D94F9A', transition: 'transform 0.1s, box-shadow 0.1s' };
export default TopPage;

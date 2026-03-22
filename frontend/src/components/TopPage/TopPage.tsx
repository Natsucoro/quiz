
// src/components/TopPage/TopPage.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Settings from '../common/Settings/Settings';
import { unlockAudioContext, speak, stopSpeaking } from '../../services/speechSynthesis';
import { useOffline } from '../../hooks/useOffline';
import { getAvailableGenres, getAvailableDifficultiesForGenre, getAllAvailableQuizzesCount } from '../../services/quizEngine';
import Toast from '../common/Toast/Toast';
import { useSettingsStore } from '../../store/settingsStore';
import { usePurchaseStore } from '../../store/purchaseStore';
import { speechRecognitionService, detectVoiceCommand } from '../../services/speechRecognition';

interface TopPageProps {
  onStart: (genre: string, difficulty: number) => void;
  initialView?: 'genre' | 'difficulty';
}

const GENRE_RUBY: Record<string, string> = {
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

const TopPage: React.FC<TopPageProps> = ({ onStart, initialView = 'genre' }) => {
  const { isMuted, setIsMuted, isHandsFree: isHandsFreeMode, setIsHandsFree: setIsHandsFreeMode } = useSettingsStore();
  const { isLoggedIn, isPurchased } = usePurchaseStore();
  const isPremiumUser = isLoggedIn;
  const [showSettings, setShowSettings] = useState(false);
  const [isSpeakingAllowed, setIsSpeakingAllowed] = useState(false);
  const isOffline = useOffline();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsHandsFreeMode(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialGenre = localStorage.getItem(TOP_PAGE_GENRE_KEY) || getAvailableGenres()[0];
  const initialDifficulty = parseInt(localStorage.getItem(TOP_PAGE_DIFFICULTY_KEY) || '1', 10);

  const [localSelectedGenre, setLocalSelectedGenre] = useState<string>(initialGenre);
  const [localSelectedDifficulty, setLocalSelectedDifficulty] = useState<number>(initialDifficulty);
  const [localSelectedCount, setLocalSelectedCount] = useState<number>(10);
  const [showDifficultySelection, setShowDifficultySelection] = useState<boolean>(initialView === 'difficulty');

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
    } else {
      if (!isSpeakingAllowed) {
        unlockAudioContext();
        setIsSpeakingAllowed(true);
      }
    }
  }, [isMuted, setIsMuted, isSpeakingAllowed, setIsSpeakingAllowed]);

  const genres = getAvailableGenres();

  const getDifficultyLabel = (difficulty: number) => `Lv.${difficulty}`;

  const getGenreIcon = (genreName: string) => {
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

  const handleGenreSelect = useCallback((genre: string) => {
    setLocalSelectedGenre(genre);
    const availableDifficulties = getAvailableDifficultiesForGenre(genre);
    let defaultDifficulty = availableDifficulties[0] || 1;

    if (!isPremiumUser) {
      const guestAllowedDifficulties = [1, 2, 6, 7];
      const availableGuestDifficulties = availableDifficulties.filter(d => guestAllowedDifficulties.includes(d));
      if (availableGuestDifficulties.length > 0) {
        defaultDifficulty = Math.min(...availableGuestDifficulties);
      } else {
        defaultDifficulty = 1;
      }
    }
    setLocalSelectedDifficulty(defaultDifficulty);
  }, [isPremiumUser]);

  const handleGenreSelectRef = useRef(handleGenreSelect);
  useEffect(() => { handleGenreSelectRef.current = handleGenreSelect; }, [handleGenreSelect]);

  useEffect(() => {
    if (!isHandsFreeMode) return;
    speechRecognitionService.onResult((transcript, isFinal) => {
      if (!isFinal) return;
      const command = detectVoiceCommand(transcript);
      if (command?.startsWith('genre:')) {
        const genre = command.replace('genre:', '');
        handleGenreSelectRef.current(genre);
      }
    });
    return () => { speechRecognitionService.onResult(() => { }); };
  }, [isHandsFreeMode]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const handleDifficultyButtonClick = useCallback((difficulty: number, isLocked: boolean) => {
    if (isLocked) {
      if (isOffline) {
        showToast('オフラインのため購入できません。接続後にお試しください。');
      } else {
        showToast('購入画面へ遷移します。（ダミー）');
      }
    } else {
      setLocalSelectedDifficulty(difficulty);
    }
  }, [isOffline, showToast]);

  const GENRE_COLORS: Record<string, string> = {
    '動物': '#FF6B6B', '昆虫': '#51CF66', '植物': '#20C997',
    '乗り物': '#339AF0', '道具': '#F59F00', '歴史上の人物': '#AE3EC9',
    '日本の地理': '#F76707', '世界の地理': '#1098AD',
  };
  const difficultiesForSelectedGenre = getAvailableDifficultiesForGenre(localSelectedGenre);

  return (
    <div style={containerStyle}>
      <style>{`rt { font-size: 0.5em; font-weight: normal; } .btn-ruby rt { font-size: 0.35em !important; } .btn-ruby { font-size: 0.6em; } .btn-ruby > :not(rt) { font-size: calc(1/0.6 * 1em); } @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} } .lock-balloon { animation: float 2s ease-in-out infinite; }`}</style>
      <header style={stickyHeaderStyle}>
        <h1 style={titleStyle} onClick={() => setShowDifficultySelection(false)}>わたしはダレでしょう？クイズ</h1>
        <div style={headerIconsStyle}>
          <button onClick={() => setShowSettings(true)} style={iconButtonStyle}>⚙️</button>
          <button onClick={handleToggleMute} style={iconButtonStyle}>{isMuted ? '🔇' : '🔊'}</button>
          <button onClick={() => setIsHandsFreeMode(!isHandsFreeMode)} style={{ ...iconButtonStyle, opacity: isHandsFreeMode ? 1 : 0.4 }}>🎤</button>
        </div>
      </header>

      {!showDifficultySelection && <p style={cautionStyle}>⚠️ 声で操作できますが、運転中に画面の操作はNGです！</p>}

      {!showDifficultySelection && <div style={hashtagContainerStyle}>
        {['#子どもから大人まで', '#レベル選べる', '#ハンズフリー', '#勉強・豆知識になる', '#運転中でもできる', '#声で読み上げ', '#ヒントあり', '#全問ランダム出題', '#オフラインでも遊べる'].map((tag) => (
          <span key={tag} style={hashtagStyle}>{tag}</span>
        ))}
      </div>}

      {!showDifficultySelection && (
      <div style={playModeContainerStyle}>
        <h2 style={sectionTitleStyle}>あそびかたをえらんでね！</h2>
        <div style={playModeGridStyle}>
          <button
            onClick={() => { setIsHandsFreeMode(true); if (isMuted) { setIsMuted(false); unlockAudioContext(); setIsSpeakingAllowed(true); } }}
            style={{ ...playModeButtonStyle, background: isHandsFreeMode ? 'linear-gradient(135deg, #FF6EC7, #FF9A3C)' : 'rgba(255,255,255,0.9)', color: isHandsFreeMode ? '#fff' : '#d63384', border: isHandsFreeMode ? '3px solid #FF6EC7' : '3px solid #FFB3D9', boxShadow: isHandsFreeMode ? '0 5px 0 #D94F9A' : '0 4px 0 #FFB3D9' } as React.CSSProperties}
          >
            <span style={playModeIconStyle}>🎤</span>
            <span><ruby>声<rt>こえ</rt></ruby>であそぶ</span>
          </button>
          <button
            onClick={() => setIsHandsFreeMode(false)}
            style={{ ...playModeButtonStyle, background: !isHandsFreeMode ? 'linear-gradient(135deg, #54A0FF, #1DD1A1)' : 'rgba(255,255,255,0.9)', color: !isHandsFreeMode ? '#fff' : '#1971c2', border: !isHandsFreeMode ? '3px solid #54A0FF' : '3px solid #a5d8ff', boxShadow: !isHandsFreeMode ? '0 5px 0 #1098AD' : '0 4px 0 #a5d8ff' } as React.CSSProperties}
          >
            <span style={playModeIconStyle}>👆</span>
            <span>タップであそぶ</span>
          </button>
        </div>
      </div>
      )}

      {!showDifficultySelection ? (
        // ジャンル選択画面
        <>
          <div style={genreSelectionContainerStyle}>
            <h2 style={sectionTitleStyle}>ジャンルをえらんでね！</h2>
            <div style={genreGridStyle}>
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => handleGenreSelect(genre)}
                  style={{
                    ...genreButtonStyle,
                    backgroundColor: GENRE_COLORS[genre] || '#FF6B6B',
                    boxShadow: localSelectedGenre === genre ? `0 0 0 2px #fff, 0 0 0 4px ${GENRE_COLORS[genre] || '#FF6B6B'}` : '0 5px 0 rgba(0,0,0,0.15)',
                    transform: localSelectedGenre === genre ? 'scale(1.08)' : 'scale(1)',
                  } as React.CSSProperties}
                >
                  <span style={genreIconStyle}>{getGenreIcon(genre)}</span>
                  <ruby>{genre}<rt style={{ fontSize: '0.55em', fontWeight: 'normal' }}>{GENRE_RUBY[genre] ?? ''}</rt></ruby>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '620px' }}>
            <button onClick={() => setShowDifficultySelection(true)} style={buttonStyle}>
              むずかしさをえらぶ →
            </button>
          </div>
        </>
      ) : (
        // 難易度選択画面
        <>
          <div style={difficultySelectionContainerStyle}>
            <h2 style={{ ...sectionTitleStyle, fontSize: '1.1em' }}>
              <span style={genreIconStyle}>{getGenreIcon(localSelectedGenre)}</span>
              むずかしさをえらんでね！
            </h2>
            <div style={difficultyGridStyle}>
              {difficultiesForSelectedGenre.map((difficulty) => {
                const isLocked = !isPremiumUser && [3, 4, 5, 8, 9, 10].includes(difficulty);
                const totalCount = getAllAvailableQuizzesCount(localSelectedGenre, difficulty);
                return (
                  <button
                    key={difficulty}
                    onClick={() => handleDifficultyButtonClick(difficulty, isLocked)}
                    style={{
                      ...difficultyButtonStyle,
                      backgroundColor: isLocked ? '#B0B0B0' : localSelectedDifficulty === difficulty ? '#FF6EC7' : ['#FF6B6B', '#FF9F43', '#FECA57', '#1DD1A1', '#54A0FF', '#5F27CD', '#FF6B6B', '#FF9F43', '#FECA57', '#1DD1A1'][difficulty - 1],
                      boxShadow: isLocked ? '0 4px 0 #888' : localSelectedDifficulty === difficulty ? '0 0 0 2px #fff, 0 0 0 4px #FF6EC7' : '0 5px 0 rgba(0,0,0,0.15)',
                      transform: localSelectedDifficulty === difficulty ? 'scale(1.08)' : 'scale(1)',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                    } as React.CSSProperties}
                  >
                    {getDifficultyLabel(difficulty)}
                    <p style={playedCountStyle}>
                      <ruby className="btn-ruby">全<rt>ぜん</rt></ruby>{totalCount}<ruby className="btn-ruby">問<rt>もん</rt></ruby>
                      {isLocked && <span style={{ fontSize: '1.4em', marginLeft: '3px' }}>🔒</span>}
                    </p>
                    {isLocked && (
                      <span className="lock-balloon" style={lockBalloonStyle}>
                        150円で解放！
                        <span style={lockBalloonTailStyle} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ ...difficultySelectionContainerStyle, marginTop: '20px' }}>
            <h2 style={{ ...sectionTitleStyle, fontSize: '1.1em' }}>
              <ruby>問題数<rt>もんだいすう</rt></ruby>をえらんでね！
            </h2>
            <div style={questionCountGridStyle}>
              {[5, 10].map((count) => (
                <button
                  key={count}
                  onClick={() => setLocalSelectedCount(count)}
                  style={{
                    ...difficultyButtonStyle,
                    flexDirection: 'row',
                    minHeight: 'unset',
                    padding: '14px 10px',
                    backgroundColor: localSelectedCount === count ? '#FF6EC7' : '#54A0FF',
                    boxShadow: localSelectedCount === count ? '0 0 0 2px #fff, 0 0 0 4px #FF6EC7' : '0 5px 0 rgba(0,0,0,0.15)',
                    transform: localSelectedCount === count ? 'scale(1.08)' : 'scale(1)',
                  } as React.CSSProperties}
                >
                  {count}<ruby>問<rt>もん</rt></ruby>
                </button>
              ))}
            </div>
          </div>

          <div style={bottomButtonsContainerStyle}>
            <button onClick={() => setShowDifficultySelection(false)} style={{ ...buttonStyle, background: '#ccc', color: '#555', boxShadow: '0 5px 0 #999' } as React.CSSProperties}>
              ← ジャンルえらびにもどる
            </button>
            <button
              onClick={handleStartQuiz}
              style={buttonStyle}
              disabled={!isPremiumUser && [3, 4, 5, 8, 9, 10].includes(localSelectedDifficulty)}
            >
              クイズスタート！ →
            </button>
          </div>
        </>
      )}

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onLoginStatusChange={() => { }}
          currentView="TOP"
        />
      )}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
};

const stickyHeaderStyle: React.CSSProperties = {
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
const titleStyle: React.CSSProperties = {
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
const headerIconsStyle: React.CSSProperties = { display: 'flex', gap: '8px', flexShrink: 0 };
const iconButtonStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.6em', cursor: 'pointer', boxShadow: '0 3px 6px rgba(0,0,0,0.15)' };
const containerStyle: React.CSSProperties = {
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
const cautionStyle: React.CSSProperties = { fontSize: '0.78em', color: '#a0522d', background: 'rgba(255,255,255,0.6)', borderRadius: '20px', padding: '6px 16px', margin: '0 0 10px 0', textAlign: 'center', maxWidth: '620px', width: '100%', boxSizing: 'border-box' };
const hashtagContainerStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '20px', maxWidth: '620px', width: '100%' };
const hashtagStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.75)', color: '#FF5FA0', borderRadius: '50px', padding: '4px 10px', fontSize: '0.75em', fontWeight: 'bold', boxShadow: '0 3px 0 rgba(255,100,180,0.2)', whiteSpace: 'nowrap' };
const playModeContainerStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '30px', padding: '24px 30px', boxShadow: '0 8px 32px rgba(255,100,180,0.2)', width: '100%', maxWidth: '620px', boxSizing: 'border-box', marginBottom: '20px' };
const playModeGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
const playModeButtonStyle: React.CSSProperties = { padding: '20px 10px', borderRadius: '20px', border: 'none', fontSize: '1.1em', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' };
const playModeIconStyle: React.CSSProperties = { fontSize: '2.4em' };
const sectionTitleStyle: React.CSSProperties = { color: '#FF5FA0', fontSize: '1.6em', margin: '0 0 25px 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textShadow: '1px 1px 0 #fff' };
const genreSelectionContainerStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '30px', padding: '30px', boxShadow: '0 8px 32px rgba(255,100,180,0.2)', width: '100%', maxWidth: '620px', boxSizing: 'border-box' };
const genreGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
const genreButtonStyle: React.CSSProperties = { padding: '14px 16px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.8)', fontSize: '1.1em', fontWeight: 'bold', color: '#fff', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', textShadow: '1px 1px 2px rgba(0,0,0,0.2)', justifyContent: 'center' } as React.CSSProperties;
const genreIconStyle: React.CSSProperties = { fontSize: '2em', flexShrink: 0 };
const difficultySelectionContainerStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '30px', padding: '30px', boxShadow: '0 8px 32px rgba(255,100,180,0.2)', width: '100%', maxWidth: '620px', boxSizing: 'border-box' };
const difficultyGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '14px', marginBottom: '28px' };
const difficultyButtonStyle: React.CSSProperties = { padding: '15px 10px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.8)', fontSize: '1.1em', fontWeight: 'bold', color: '#fff', cursor: 'pointer', transition: 'transform 0.1s', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '90px', textAlign: 'center', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' } as React.CSSProperties;
const lockIconStyle: React.CSSProperties = { fontSize: '1em', marginLeft: '3px' };
const lockBalloonStyle: React.CSSProperties = { position: 'absolute', bottom: '-30px', left: '50%', transform: 'translateX(-50%)', background: '#fff', color: '#d63384', fontSize: '0.55em', fontWeight: 'bold', padding: '3px 7px', borderRadius: '10px', boxShadow: '0 3px 8px rgba(0,0,0,0.18)', whiteSpace: 'nowrap', lineHeight: '1.4', zIndex: 2, border: '1.5px solid #FFB3D9' };
const lockBalloonTailStyle: React.CSSProperties = { position: 'absolute', top: '-7px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid #fff' };
const playedCountStyle: React.CSSProperties = { fontSize: '0.72em', color: '#fff', marginTop: '2px', marginBottom: '0' };
const questionCountGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' };
const bottomButtonsContainerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-around', gap: '15px', marginTop: '20px', width: '100%', maxWidth: '620px' };
const buttonStyle: React.CSSProperties = { background: 'linear-gradient(135deg, #FF6EC7, #FF9A3C)', color: 'white', padding: '14px 28px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: '0 5px 0 #D94F9A', transition: 'transform 0.1s, box-shadow 0.1s' } as React.CSSProperties;

export default TopPage;

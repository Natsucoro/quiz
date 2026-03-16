
// src/components/TopPage/TopPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import Settings from '../common/Settings/Settings';
import { unlockAudioContext, speak, stopSpeaking } from '../../services/speechSynthesis';
import { useOffline } from '../../hooks/useOffline';
import { getAvailableGenres, getAvailableDifficultiesForGenre, getAllAvailableQuizzesCount } from '../../services/quizEngine';
import Toast from '../common/Toast/Toast';
import { useSettingsStore } from '../../store/settingsStore';
import { usePurchaseStore } from '../../store/purchaseStore';

interface TopPageProps {
  onStart: (genre: string, difficulty: number) => void;
  initialView?: 'genre' | 'difficulty';
}

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

  const initialGenre = localStorage.getItem(TOP_PAGE_GENRE_KEY) || getAvailableGenres()[0];
  const initialDifficulty = parseInt(localStorage.getItem(TOP_PAGE_DIFFICULTY_KEY) || '1', 10);

  const [localSelectedGenre, setLocalSelectedGenre] = useState<string>(initialGenre);
  const [localSelectedDifficulty, setLocalSelectedDifficulty] = useState<number>(initialDifficulty);
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
      // ミュート解除時に音声コンテキストをアクティブにする試み
      if (!isSpeakingAllowed) {
        unlockAudioContext();
        setIsSpeakingAllowed(true);
      }
    }
  }, [isMuted, setIsMuted, isSpeakingAllowed, setIsSpeakingAllowed]);


  const handleGoHomeConfirm = () => {
    // TopPageではすでにHOMEのため何もしない
  };

  const genres = getAvailableGenres();
  // const difficulties = getAvailableDifficultiesForGenre(localSelectedGenre); // 下で動的に取得するため不要

  // 難易度表示名
  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty >= 1 && difficulty <= 5) return `こども Lv.${difficulty}`;
    if (difficulty >= 6 && difficulty <= 10) return `おとな Lv.${difficulty}`;
    return `Lv.${difficulty}`;
  };

  // 既に選択されているジャンルのアイコン
  const getGenreIcon = (genreName: string) => {
    switch (genreName) {
      case '動物': return '🐾';
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

  // 指示事項3: ジャンル選択時の難易度自動選択ロジック
  const handleGenreSelect = useCallback((genre: string) => {
    setLocalSelectedGenre(genre);
    const availableDifficulties = getAvailableDifficultiesForGenre(genre);
    let defaultDifficulty = availableDifficulties[0] || 1; // デフォルトは最初の難易度

    if (!isPremiumUser) {
      // ゲストユーザーの場合、難易度1,2,6,7の中から利用可能な最低難易度を選択
      const guestAllowedDifficulties = [1, 2, 6, 7];
      const availableGuestDifficulties = availableDifficulties.filter(d => guestAllowedDifficulties.includes(d));
      if (availableGuestDifficulties.length > 0) {
        defaultDifficulty = Math.min(...availableGuestDifficulties);
      } else {
        // 利用可能なゲスト難易度がない場合（ありえないはずだが念のため）
        defaultDifficulty = 1; // フォールバック
      }
    }
    setLocalSelectedDifficulty(defaultDifficulty);
    setShowDifficultySelection(true);
  }, [isPremiumUser]); // isPremiumUser を依存配列に追加

  // 指示事項5: Toast通知のラッパー関数
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    // Toastコンポーネントがduration後にonCloseを呼ぶので、別途クリアは不要
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


  const difficultiesForSelectedGenre = getAvailableDifficultiesForGenre(localSelectedGenre);


  return (
    <div style={containerStyle}>
      <div style={headerIconsStyle}>
        <button onClick={() => setShowSettings(true)} style={iconButtonStyle}>⚙️</button>
        <button onClick={handleToggleMute} style={iconButtonStyle}>{isMuted ? '🔇' : '🔊'}</button>
        <button onClick={() => setIsHandsFreeMode(!isHandsFreeMode)} style={{ ...iconButtonStyle, opacity: isHandsFreeMode ? 1 : 0.4 }}>🤲</button>
        <button onClick={handleGoHomeConfirm} style={iconButtonStyle}>🏠</button>
      </div>

      <h1 style={titleStyle}>わたしはダレでしょう？クイズ</h1>

      {!showDifficultySelection ? (
        // ジャンル選択画面
        <div style={genreSelectionContainerStyle}>
          <h2 style={sectionTitleStyle}>ジャンルを選んでね！</h2>
          <div style={genreGridStyle}>
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenreSelect(genre)} // 指示事項3: 修正したハンドラを呼び出し
                style={{
                  ...genreButtonStyle,
                  backgroundColor: localSelectedGenre === genre ? '#4682B4' : '#ADD8E6',
                  boxShadow: localSelectedGenre === genre ? '0 5px #366A96' : '0 4px #87CEEB',
                  // カスタムCSSプロパティを使ってshadow-colorを動的に設定
                  '--shadow-color': localSelectedGenre === genre ? '#366A96' : '#87CEEB',
                } as React.CSSProperties} // 型アサーション
              >
                <span style={genreIconStyle}>{getGenreIcon(genre)}</span>
                {genre}
              </button>
            ))}
          </div>
        </div>
      ) : (
        // 難易度選択画面
        <div style={difficultySelectionContainerStyle}>
          <h2 style={sectionTitleStyle}>
            <span style={genreIconStyle}>{getGenreIcon(localSelectedGenre)}</span>
            {localSelectedGenre} の難易度を選んでね！
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
                    backgroundColor: localSelectedDifficulty === difficulty ? '#FFD700' : (isLocked ? '#D3D3D3' : '#98FB98'),
                    boxShadow: localSelectedDifficulty === difficulty ? '0 5px #DAA520' : (isLocked ? '0 4px #A9A9A9' : '0 4px #7CCD7C'),
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                  } as React.CSSProperties}
                >
                  {getDifficultyLabel(difficulty)}
                  {isLocked && <span style={lockIconStyle}>🔒</span>}
                  {isLocked && <p style={purchaseTextStyle}>150円で解放！</p>}
                  {!isLocked && <p style={playedCountStyle}>全{totalCount}問からランダム出題</p>}
                </button>
              );
            })}
          </div>
          <div style={bottomButtonsContainerStyle}>
            <button onClick={() => setShowDifficultySelection(false)} style={{ ...buttonStyle, backgroundColor: '#ccc', '--shadow-color': '#999' } as React.CSSProperties}>
              ジャンル選択に戻る
            </button>
            <button
              onClick={handleStartQuiz}
              style={{ ...buttonStyle, '--shadow-color': '#CD5C91' } as React.CSSProperties}
              disabled={!isPremiumUser && [3, 4, 5, 8, 9, 10].includes(localSelectedDifficulty)}
            >
              クイズを開始する
            </button>
          </div>
        </div>
      )}


      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onLoginStatusChange={() => {}}
          currentView="TOP"
        />
      )}
      {/* 指示事項5: Toastコンポーネントを配置 */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
};

// Styles (簡易的なフラットデザイン)
const containerStyle: React.CSSProperties = {
  fontFamily: "'Mochiy Pop One', cursive", // Google Fonts
  backgroundColor: '#FFC0CB', // ピンク基調
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px',
  boxSizing: 'border-box',
};

const headerIconsStyle: React.CSSProperties = {
  position: 'absolute',
  top: '20px',
  right: '20px',
  display: 'flex',
  gap: '10px',
  zIndex: 500,
};

const iconButtonStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  border: 'none',
  borderRadius: '50%',
  width: '50px',
  height: '50px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '1.8em',
  cursor: 'pointer',
  boxShadow: '0 3px 6px rgba(0,0,0,0.1)',
  transition: 'transform 0.1s ease-out, background-color 0.2s',
  '--shadow-color': 'rgba(0,0,0,0.1)', // デフォルトシャドウカラー
} as React.CSSProperties; // 型アサーション


const titleStyle: React.CSSProperties = {
  color: '#4682B4', // 水色
  fontSize: '2.5em',
  marginTop: '80px',
  marginBottom: '50px',
  textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
  textAlign: 'center',
};

const sectionTitleStyle: React.CSSProperties = {
  color: '#4682B4',
  fontSize: '1.8em',
  marginBottom: '30px',
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
};

const genreSelectionContainerStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderRadius: '25px',
  padding: '30px',
  boxShadow: '0 10px 20px rgba(0, 0, 0, 0.15)',
  width: '100%',
  maxWidth: '600px',
  boxSizing: 'border-box',
};

const genreGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '20px',
  justifyContent: 'center',
};

const genreButtonStyle: React.CSSProperties = {
  padding: '20px 10px',
  borderRadius: '15px',
  border: 'none',
  fontSize: '1.2em',
  fontWeight: 'bold',
  color: '#fff',
  cursor: 'pointer',
  boxShadow: '0 4px #87CEEB',
  transition: 'transform 0.1s ease-out, background-color 0.2s, box-shadow 0.1s',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '5px',
} as React.CSSProperties;


const genreIconStyle: React.CSSProperties = {
  fontSize: '2em',
  marginBottom: '5px',
};

const difficultySelectionContainerStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderRadius: '25px',
  padding: '30px',
  boxShadow: '0 10px 20px rgba(0, 0, 0, 0.15)',
  width: '100%',
  maxWidth: '600px',
  boxSizing: 'border-box',
};

const difficultyGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: '15px',
  marginBottom: '30px',
  justifyContent: 'center',
};

const difficultyButtonStyle: React.CSSProperties = {
  padding: '15px 10px',
  borderRadius: '15px',
  border: 'none',
  fontSize: '1.1em',
  fontWeight: 'bold',
  color: '#333',
  cursor: 'pointer',
  boxShadow: '0 4px #7CCD7C',
  transition: 'transform 0.1s ease-out, background-color 0.2s, box-shadow 0.1s',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100px',
  textAlign: 'center',
} as React.CSSProperties;

const lockIconStyle: React.CSSProperties = {
  position: 'absolute',
  top: '8px',
  right: '8px',
  fontSize: '1.2em',
  color: '#fff',
  textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
};

const purchaseTextStyle: React.CSSProperties = {
  fontSize: '0.7em',
  color: '#666',
  marginTop: '5px',
  lineHeight: '1.2',
};

const playedCountStyle: React.CSSProperties = {
    fontSize: '0.8em',
    color: '#333',
    marginTop: '5px',
};

const bottomButtonsContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-around',
  gap: '15px',
  marginTop: '20px',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#FF69B4', // ピンク
  color: 'white',
  padding: '15px 30px',
  border: 'none',
  borderRadius: '15px',
  cursor: 'pointer',
  fontSize: '1.2em',
  fontWeight: 'bold',
  boxShadow: '0 5px #CD5C91',
  transition: 'background-color 0.2s, transform 0.1s ease-out, box-shadow 0.1s',
} as React.CSSProperties;

export default TopPage;

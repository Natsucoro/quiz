
// src/components/TopPage/TopPage.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Settings from '../common/Settings/Settings';
import { unlockAudioContext, stopSpeaking } from '../../services/speechSynthesis';
import { useOffline } from '../../hooks/useOffline';
import { getAvailableGenres, getAvailableDifficultiesForGenre, getAllAvailableQuizzesCount } from '../../services/quizEngine';
import Toast from '../common/Toast/Toast';
import { useSettingsStore } from '../../store/settingsStore';
import { usePurchaseStore } from '../../store/purchaseStore';
import { speechRecognitionService, detectVoiceCommand } from '../../services/speechRecognition';
import FloatingShapes from '../common/FloatingShapes';
import PaywallModal from '../common/PaywallModal';
import { SpriteIcon } from '../common/SpriteIcon';

// SVGアイコンのインポート
import AshikaIcon from '../../assets/icons/ashika.svg';
import KabutomushiIcon from '../../assets/icons/kabutomushi.svg';
import toolIcon from '../../assets/icons/icon_setting.png';
import soundIcon from '../../assets/icons/sound.svg';
import micIcon from '../../assets/icons/mic.svg';
import HanaIcon from '../../assets/icons/hana.svg';
import NorimonoIcon from '../../assets/icons/shinkansen.svg';
import MonoIcon from '../../assets/icons/tool.svg';
import NihonIcon from '../../assets/icons/niihon.svg';
import ChikyuIcon from '../../assets/icons/xhikyu2.svg';
import SakanaIcon from '../../assets/icons/sakana.svg';
import HatoIcon from '../../assets/icons/hato.svg';
import HebiIcon from '../../assets/icons/hebi.svg';
import KaniIcon from '../../assets/icons/kani.svg';
import HagurumaIcon from '../../assets/icons/haguruma.svg';
import RekishiIcon from '../../assets/icons/rekishi.svg';
import FoodIcon from '../../assets/icons/food.svg';
import GuestIcon from '../../assets/icons/guest.svg';
import UserIcon from '../../assets/icons/user.svg';
import MaruIcon from '../../assets/icons/icon_maru.svg';

interface TopPageProps {
  onStart: (genre: string, difficulty: number, count: number) => void;
  initialView?: 'genre' | 'difficulty';
  onLoginRequest?: () => void;
}

const GENRE_RUBY: Record<string, string> = {
  '哺乳類': 'ほにゅうるい',
  '昆虫': 'こんちゅう',
  '植物': 'しょくぶつ',
  '魚類': 'さかな',
  '鳥類': 'ちょうるい',
  '爬虫類': 'はちゅうるい',
  '海洋生物': 'かいようせいぶつ',
  '乗り物': 'のりもの',
  '道具': 'どうぐ',
  '歴史上の人物': 'れきしのじんぶつ',
  '日本の地理': 'にほんのちり',
  '世界の地理': 'せかいのちり',
  '食べ物': 'たべもの',
};

const TOP_PAGE_GENRE_KEY = 'quizAppSelectedGenre';
const TOP_PAGE_DIFFICULTY_KEY = 'quizAppSelectedDifficulty';

const TopPage: React.FC<TopPageProps> = ({ onStart, initialView = 'genre', onLoginRequest }) => {
  const { isMuted, setIsMuted, isHandsFree, setIsHandsFree } = useSettingsStore();
  const isHandsFreeMode = isHandsFree;
  const { isLoggedIn, isPurchased, addPurchase } = usePurchaseStore();
  const isPremiumUser = isLoggedIn;
  const [showSettings, setShowSettings] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTarget, setPaywallTarget] = useState<{ genre: string; difficulty: number } | null>(null);
  const [isSpeakingAllowed, setIsSpeakingAllowed] = useState(false);
  const isOffline = useOffline();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const initialGenre = localStorage.getItem(TOP_PAGE_GENRE_KEY) || getAvailableGenres()[0];
  const initialDifficulty = parseInt(localStorage.getItem(TOP_PAGE_DIFFICULTY_KEY) || '1', 10);

  const [localSelectedGenre, setLocalSelectedGenre] = useState<string>(initialGenre);
  const [localSelectedDifficulty, setLocalSelectedDifficulty] = useState<number>(initialDifficulty);
  const localSelectedCount = 10;
  const [showDifficultySelection, setShowDifficultySelection] = useState<boolean>(initialView === 'difficulty');

  const [isBottomButtonVisible, setIsBottomButtonVisible] = useState(false);
  const bottomButtonRef = useRef<HTMLDivElement>(null);
  
  const [isBottomStartButtonVisible, setIsBottomStartButtonVisible] = useState(false);
  const bottomStartButtonRef = useRef<HTMLDivElement>(null);

  // 最下部のボタン（ジャンル/難易度それぞれ）が画面内に入ったか監視
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.target === bottomButtonRef.current) {
          setIsBottomButtonVisible(entry.isIntersecting);
        } else if (entry.target === bottomStartButtonRef.current) {
          setIsBottomStartButtonVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.1 }
    );
    
    if (bottomButtonRef.current) observer.observe(bottomButtonRef.current);
    if (bottomStartButtonRef.current) observer.observe(bottomStartButtonRef.current);
    
    return () => observer.disconnect();
  }, [showDifficultySelection]);

  useEffect(() => {
    setIsHandsFree(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    localStorage.setItem(TOP_PAGE_GENRE_KEY, localSelectedGenre);
    localStorage.setItem(TOP_PAGE_DIFFICULTY_KEY, String(localSelectedDifficulty));
  }, [localSelectedGenre, localSelectedDifficulty]);

  const handleStartQuiz = async () => {
    if (!isSpeakingAllowed) {
      await unlockAudioContext();
      setIsSpeakingAllowed(true);
    }
    onStart(localSelectedGenre, localSelectedDifficulty, localSelectedCount);
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
    const iconStyle = { width: '1.2em', height: '1.2em', objectFit: 'contain' as const };
    switch (genreName) {
      case '哺乳類': return <img src={AshikaIcon} alt="哺乳類" style={iconStyle} />;
      case '昆虫': return <img src={KabutomushiIcon} alt="昆虫" style={iconStyle} />;
      case '植物': return <img src={HanaIcon} alt="植物" style={iconStyle} />;
      case '乗り物': return <img src={NorimonoIcon} alt="乗り物" style={iconStyle} />;
      case '道具': return <img src={MonoIcon} alt="道具" style={iconStyle} />;
      case '魚類': return <img src={SakanaIcon} alt="魚類" style={iconStyle} />;
      case '鳥類': return <img src={HatoIcon} alt="鳥類" style={iconStyle} />;
      case '爬虫類': return <img src={HebiIcon} alt="爬虫類" style={iconStyle} />;
      case '海洋生物': return <img src={KaniIcon} alt="海洋生物" style={iconStyle} />;
      case '歴史上の人物': return <img src={RekishiIcon} alt="歴史上の人物" style={iconStyle} />;
      case '日本の地理': return <img src={NihonIcon} alt="日本の地理" style={iconStyle} />;
      case '世界の地理': return <img src={ChikyuIcon} alt="世界の地理" style={iconStyle} />;
      case '食べ物': return <img src={FoodIcon} alt="食べ物" style={iconStyle} />;
      default: return '❓';
    }
  };

  const handleGenreSelect = useCallback((genre: string) => {
    setLocalSelectedGenre(genre);
    const isHistoryGenre = ['歴史上の人物', '日本の歴史', '世界の歴史'].includes(genre);
    const guestFreeLevels = [1, 2, 6, 7];
    let defaultDifficulty: number;
    if (isHistoryGenre) {
      defaultDifficulty = isPremiumUser ? 6 : 6; // 歴史は6から
    } else {
      defaultDifficulty = isPremiumUser ? 1 : guestFreeLevels[0];
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
        // PaywallModalを開く
        setPaywallTarget({ genre: localSelectedGenre, difficulty });
        setShowPaywall(true);
      }
    } else {
      setLocalSelectedDifficulty(difficulty);
    }
  }, [isOffline, showToast, localSelectedGenre]);

  const GENRE_COLORS: Record<string, string> = {
    '哺乳類': '#FF6B6B', '昆虫': '#51CF66', '植物': '#20C997',
    '魚類': '#15AABF', '鳥類': '#FAB005', '爬虫類': '#82C91E', '海洋生物': '#4C6EF5',
    '乗り物': '#339AF0', '道具': '#F59F00', '歴史上の人物': '#AE3EC9',
    '日本の地理': '#F76707', '世界の地理': '#1098AD',
    '食べ物': '#E64980',
  };
  const HISTORY_GENRES = ['歴史上の人物', '日本の歴史', '世界の歴史'];
  const getDifficultiesForGenre = (genre: string) =>
    HISTORY_GENRES.includes(genre) ? [6, 7, 8, 9, 10] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const difficultiesForSelectedGenre = getDifficultiesForGenre(localSelectedGenre);

  return (
    <div style={containerStyle}>
      <div style={backgroundStyle}>
        <FloatingShapes />
      </div>
      <style>{`
        rt { font-size: 0.5em; font-weight: normal; } 
        .btn-ruby rt { font-size: 0.35em !important; } 
        .btn-ruby { font-size: 0.6em; } 
        .btn-ruby > :not(rt) { font-size: calc(1/0.6 * 1em); } 
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} } 
        .lock-balloon { animation: float 2s ease-in-out infinite; }
        
        @keyframes slideUp {
          from { transform: translate(-50%, 100px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes icon-sway {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
        @keyframes label-scale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes shine {
          0% { left: -100%; }
          20% { left: 100%; }
          100% { left: 100%; }
        }
        .shine-button {
          position: relative;
          overflow: hidden;
        }
        .shine-button::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -100%;
          width: 60%;
          height: 200%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: rotate(30deg);
          animation: shine 3s infinite;
        }
        .floating-button {
          animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
      <header style={stickyHeaderStyle}>
        <h1 style={titleStyle} onClick={() => setShowDifficultySelection(false)}>わたしはダレでしょう？クイズ</h1>
        <div style={headerIconsStyle}>
          {/* ログイン状態バッジ */}
          <button
            onClick={() => setShowSettings(true)}
            style={isPremiumUser ? loginBadgeActiveStyle : loginBadgeGuestStyle}
            title={isPremiumUser ? `ログイン中: ${isLoggedIn ? '設定からログアウト可' : ''}` : 'ゲスト（設定からログイン）'}
          >
            {isPremiumUser ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.0', color: '#2E86DE', fontWeight: 'bold', fontSize: '0.75em' }}>
                <span>ログ</span>
                <span>イン</span>
                <span>中</span>
              </div>
            ) : 'ゲスト'}
          </button>
          <button onClick={() => setShowSettings(true)} style={iconButtonStyle}>
            <img src={HagurumaIcon} alt="設定" style={{ width: '30px', height: '30px' }} />
          </button>
          <button onClick={handleToggleMute} style={{ ...iconButtonStyle, opacity: isMuted ? 0.4 : 1 }}>
            <img src={soundIcon} alt="音声" style={{ width: '30px', height: '30px' }} />
          </button>
        </div>
      </header>


      {!showDifficultySelection && <div style={hashtagContainerStyle}>
        {['#子どもから大人まで', '#レベル選べる', '#暇つぶし', '#勉強・豆知識になる',  '#声で読み上げ', '#ヒントあり', '#全問ランダム出題', '#オフラインでも遊べる'].map((tag) => (
          <span key={tag} style={hashtagStyle}>{tag}</span>
        ))}
      </div>}


      {!showDifficultySelection ? (
        // ジャンル選択画面
        <>
          <div style={genreSelectionContainerStyle}>
            <h2 style={sectionTitleStyle}>ジャンルをえらんでね！</h2>
            <div style={genreGridStyle}>
              {Object.keys(GENRE_RUBY)
                .sort((a, b) => {
                  const aAvail = genres.includes(a) ? 1 : 0;
                  const bAvail = genres.includes(b) ? 1 : 0;
                  return bAvail - aAvail;
                })
                .map((genre) => {
                const isAvailable = genres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => isAvailable && handleGenreSelect(genre)}
                    disabled={!isAvailable}
                    style={{
                      ...genreButtonStyle,
                      backgroundColor: !isAvailable ? '#ccc' : (GENRE_COLORS[genre] || '#FF6B6B'),
                      boxShadow: localSelectedGenre === genre ? `0 0 0 2px #fff, 0 0 0 4px ${GENRE_COLORS[genre] || '#FF6B6B'}` : '0 5px 0 rgba(0,0,0,0.15)',
                      transform: localSelectedGenre === genre ? 'scale(1.05)' : 'scale(1)',
                      cursor: !isAvailable ? 'not-allowed' : 'pointer',
                      position: 'relative',
                      opacity: !isAvailable ? 0.7 : 1,
                      overflow: 'hidden',
                    } as React.CSSProperties}
                  >
                    <span style={{
                      ...genreIconStyle,
                      animation: localSelectedGenre === genre ? 'icon-sway 1s ease-in-out infinite' : 'none',
                      display: 'inline-block'
                    }}>
                      {getGenreIcon(genre)}
                    </span>
                    <ruby>{genre}<rt style={{ fontSize: '0.55em', fontWeight: 'normal' }}>{GENRE_RUBY[genre] ?? ''}</rt></ruby>
                    {!isAvailable && (
                      <span style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        background: 'rgba(0, 0, 0, 0.4)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderBottomLeftRadius: '12px',
                        fontSize: '0.5em',
                        fontWeight: 'bold',
                        zIndex: 2,
                      }}>
                        近日公開
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div ref={bottomButtonRef} style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '620px' }}>
            <button 
              className="shine-button"
              onClick={() => setShowDifficultySelection(true)} 
              style={buttonStyle}
            >
              むずかしさをえらぶ →
            </button>
          </div>

          {/* フローティングボタン (ジャンル選択済み かつ 最下部ボタンが見えていない時) */}
          {!isBottomButtonVisible && (
            <div className="floating-button" style={{
              position: 'fixed',
              bottom: '25px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 900,
              width: '90%',
              maxWidth: '400px',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <button 
                className="shine-button"
                onClick={() => setShowDifficultySelection(true)} 
                style={{
                  ...buttonStyle,
                  width: '100%',
                  boxShadow: '0 8px 20px rgba(255, 110, 199, 0.4)',
                  padding: '16px 20px'
                }}
              >
                むずかしさをえらぶ →
              </button>
            </div>
          )}
        </>
      ) : (
        // 難易度選択画面
        <>
          <div style={difficultySelectionContainerStyle}>
            <h2 style={{ ...sectionTitleStyle, fontSize: '1.1em' }}>
              <span style={genreIconStyle}>{getGenreIcon(localSelectedGenre)}</span>
              むずかしさをえらんでね！
            </h2>
            {/* ゲスト向け説明 */}
            {!isLoggedIn && (
              <p style={{ fontSize: '0.8em', color: '#888', textAlign: 'center', marginBottom: '14px', background: 'rgba(255,255,255,0.6)', borderRadius: '12px', padding: '8px' }}>
                💡 <strong style={{ color: '#FF5FA0' }}>無料</strong>は Lv.1・2（こども）と Lv.6・7（おとな）で体験できます
              </p>
            )}
            <div style={difficultyGridStyle}>
              {difficultiesForSelectedGenre.map((difficulty) => {
                const isFreeRank = [1, 2, 6, 7].includes(difficulty);
                const itemId = `${localSelectedGenre}_${difficulty}`;
                // 無料枠でなく、かつまだ購入していない場合のみロックする
                const isLocked = !isFreeRank && !isPurchased(itemId);
                const totalCount = getAllAvailableQuizzesCount(localSelectedGenre, difficulty);
                return (
                  <div key={difficulty} style={{ position: 'relative' }}>
                    <button
                      className={localSelectedDifficulty === difficulty ? 'shine-button' : ''}
                      onClick={() => handleDifficultyButtonClick(difficulty, isLocked)}
                      style={{
                        ...difficultyButtonStyle,
                        backgroundColor: isLocked ? '#B0B0B0' : localSelectedDifficulty === difficulty ? '#FF6EC7' : ['#FF6B6B', '#FF9F43', '#FECA57', '#1DD1A1', '#54A0FF', '#5F27CD', '#FF6B6B', '#FF9F43', '#FECA57', '#1DD1A1'][difficulty - 1],
                        boxShadow: isLocked ? '0 4px 0 #888' : localSelectedDifficulty === difficulty ? `0 0 0 2px #fff, 0 0 0 4px #FF6EC7` : '0 5px 0 rgba(0,0,0,0.15)',
                        transform: localSelectedDifficulty === difficulty ? 'scale(1.05)' : 'scale(1)',
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                        width: '100%',
                      } as React.CSSProperties}
                    >
                      <span>
                        {getDifficultyLabel(difficulty)}
                      </span>
                      <p style={playedCountStyle}>
                        <ruby className="btn-ruby">全<rt>ぜん</rt></ruby>{totalCount}<ruby className="btn-ruby">問<rt>もん</rt></ruby>
                        {isLocked && <span style={{ fontSize: '1.2em', marginLeft: '3px' }}>🔒</span>}
                      </p>
                      {isLocked && (
                        <span className="lock-balloon" style={lockBalloonStyle}>
                          120円で解放！
                          <span style={lockBalloonTailStyle} />
                        </span>
                      )}
                    </button>
                    {isFreeRank && !isLocked && (
                      <span style={freeBadgeStyle}>無料</span>
                    )}
                    {isPurchased(itemId) && !isFreeRank && (
                      <span style={purchasedBadgeStyle}>解放済</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={bottomButtonsContainerStyle}>
            <button onClick={() => setShowDifficultySelection(false)} style={{ ...buttonStyle, background: '#ccc', color: '#555', boxShadow: '0 5px 0 #999' } as React.CSSProperties}>
              ← TOPにもどる
            </button>
            <button
              ref={bottomStartButtonRef as any}
              className="shine-button"
              onClick={handleStartQuiz}
              style={buttonStyle}
              // 無料レベル(1,2,6,7) または 購入済みの場合はスタート可能
              disabled={![1, 2, 6, 7].includes(localSelectedDifficulty) && !isPurchased(`${localSelectedGenre}_${localSelectedDifficulty}`)}
            >
              クイズスタート！ →
            </button>
          </div>

          {/* フローティング・スタートボタン (最下部ボタンが見えていない時) */}
          {!isBottomStartButtonVisible && (
            <div className="floating-button" style={{
              position: 'fixed',
              bottom: '25px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 900,
              width: '90%',
              maxWidth: '400px',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <button 
                className="shine-button"
                onClick={handleStartQuiz} 
                disabled={![1, 2, 6, 7].includes(localSelectedDifficulty) && !isPurchased(`${localSelectedGenre}_${localSelectedDifficulty}`)}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  boxShadow: '0 8px 20px rgba(255, 110, 199, 0.4)',
                  padding: '16px 20px',
                  opacity: (![1, 2, 6, 7].includes(localSelectedDifficulty) && !isPurchased(`${localSelectedGenre}_${localSelectedDifficulty}`)) ? 0.6 : 1
                }}
              >
                クイズスタート！ →
              </button>
            </div>
          )}
        </>
      )}

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          currentView="TOP"
          onLoginRequest={() => { setShowSettings(false); onLoginRequest?.(); }}
        />
      )}
      {showPaywall && paywallTarget && (
        <PaywallModal
          genre={paywallTarget.genre}
          difficulty={paywallTarget.difficulty}
          onClose={() => setShowPaywall(false)}
          onLoginRequest={() => {
            setShowPaywall(false);
            onLoginRequest?.(); // TopPagePropsで渡されたログイン関数を呼ぶ
          }}
          onTestPurchase={() => {
            // モック決済
            const itemId = `${paywallTarget.genre}_${paywallTarget.difficulty}`;
            addPurchase(itemId);
            setShowPaywall(false);
            showToast(`💰「${paywallTarget.genre} Lv.${paywallTarget.difficulty}」を購入して解放しました！`);
          }}
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
  padding: '0 8px',
  zIndex: 1000,
  boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
};
const titleStyle: React.CSSProperties = {
  cursor: 'pointer',
  color: '#fff',
  fontSize: 'clamp(1.0em, 4.5vw, 1.5em)',
  margin: 0,
  textShadow: '1px 2px 0 rgba(0,0,0,0.18)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flexShrink: 1,
  minWidth: 0,
};
const headerIconsStyle: React.CSSProperties = { display: 'flex', gap: '4px', flexShrink: 0 };
const iconButtonStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.3em', cursor: 'pointer', boxShadow: '0 3px 6px rgba(0,0,0,0.15)' };
const loginBadgeGuestStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.7)', border: '2px solid rgba(255,255,255,0.9)', borderRadius: '50%', width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.6em', fontWeight: 'bold', color: '#888', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', whiteSpace: 'nowrap', flexShrink: 0 };
const loginBadgeActiveStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.7)', border: '3px solid #2E86DE', borderRadius: '50%', width: '38px', height: '38px', minWidth: '38px', minHeight: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#2E86DE', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', whiteSpace: 'nowrap', flexShrink: 0 };
const containerStyle: React.CSSProperties = {
  fontFamily: "'Yomogi', cursive",
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: '84px',
  paddingLeft: '20px',
  paddingRight: '20px',
  paddingBottom: '100px',
  boxSizing: 'border-box',
  position: 'relative',
  zIndex: 1,
};
const backgroundStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'linear-gradient(135deg, #FF9DE2 0%, #FFD6A5 50%, #FFFB8F 100%)',
  zIndex: -1,
};
const cautionStyle: React.CSSProperties = { fontSize: '0.78em', color: '#a0522d', background: 'rgba(255,255,255,0.6)', borderRadius: '20px', padding: '6px 16px', margin: '0 0 10px 0', textAlign: 'center', maxWidth: '700px', width: '100%', boxSizing: 'border-box' };
const hashtagContainerStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '20px', maxWidth: '700px', width: '100%' };
const hashtagStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.75)', color: '#FF5FA0', borderRadius: '50px', padding: '4px 10px', fontSize: '0.75em', fontWeight: 'bold', boxShadow: '0 3px 0 rgba(255,100,180,0.2)', whiteSpace: 'nowrap' };
const playModeContainerStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '30px', padding: '24px 30px', boxShadow: '0 8px 32px rgba(255,100,180,0.2)', width: '100%', maxWidth: '700px', boxSizing: 'border-box', marginBottom: '20px' };
const playModeGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
const playModeButtonStyle: React.CSSProperties = { padding: '20px 10px', borderRadius: '20px', border: 'none', fontSize: '1.1em', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' };
const playModeIconStyle: React.CSSProperties = { fontSize: '2.4em' };
const sectionTitleStyle: React.CSSProperties = { color: '#FF5FA0', fontSize: '1.6em', margin: '0 0 25px 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textShadow: '1px 1px 0 #fff' };
const genreSelectionContainerStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '30px', padding: '30px', boxShadow: '0 8px 32px rgba(255,100,180,0.2)', width: '100%', maxWidth: '700px', boxSizing: 'border-box' };
const genreGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const genreButtonStyle: React.CSSProperties = { padding: '10px 8px', borderRadius: '24px', border: '3px solid rgba(255,255,255,0.8)', fontSize: '1.05em', fontWeight: 'bold', color: '#fff', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px', textShadow: '1px 1px 2px rgba(0,0,0,0.2)', justifyContent: 'center', minHeight: '90px', textAlign: 'center' } as React.CSSProperties;
const genreIconStyle: React.CSSProperties = { fontSize: '2.4em', flexShrink: 0, marginBottom: '-4px' };
const difficultySelectionContainerStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '30px', padding: '30px', boxShadow: '0 8px 32px rgba(255,100,180,0.2)', width: '100%', maxWidth: '700px', boxSizing: 'border-box' };
const difficultyGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', columnGap: '20px', rowGap: '30px', marginBottom: '28px' };
const difficultyButtonStyle: React.CSSProperties = { padding: '15px 10px', borderRadius: '20px', border: '3px solid rgba(255,255,255,0.8)', fontSize: '1.1em', fontWeight: 'bold', color: '#fff', cursor: 'pointer', transition: 'transform 0.1s', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '90px', textAlign: 'center', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' } as React.CSSProperties;
const lockIconStyle: React.CSSProperties = { fontSize: '1em', marginLeft: '3px' };
const lockBalloonStyle: React.CSSProperties = { position: 'absolute', bottom: '-25px', left: '50%', transform: 'translateX(-50%)', background: '#fff', color: '#d63384', fontSize: '0.55em', fontWeight: 'bold', padding: '3px 7px', borderRadius: '10px', boxShadow: '0 3px 8px rgba(0,0,0,0.18)', whiteSpace: 'nowrap', lineHeight: '1.4', zIndex: 2, border: '1.5px solid #FFB3D9' };
const lockBalloonTailStyle: React.CSSProperties = { position: 'absolute', top: '-7px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid #fff' };
const freeBadgeStyle: React.CSSProperties = { position: 'absolute', top: '-10px', right: '-6px', background: '#51CF66', color: '#fff', fontSize: '0.5em', fontWeight: 'bold', padding: '2px 7px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', border: '1.5px solid #fff' };
const purchasedBadgeStyle: React.CSSProperties = { position: 'absolute', top: '-10px', right: '-6px', background: '#54A0FF', color: '#fff', fontSize: '0.5em', fontWeight: 'bold', padding: '2px 7px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', border: '1.5px solid #fff' };
const playedCountStyle: React.CSSProperties = { fontSize: '0.72em', color: '#fff', marginTop: '2px', marginBottom: '0' };
const bottomButtonsContainerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-around', gap: '15px', marginTop: '20px', width: '100%', maxWidth: '700px' };
const buttonStyle: React.CSSProperties = { background: 'linear-gradient(135deg, #FF6EC7, #FF9A3C)', color: 'white', padding: '14px 28px', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: '0 5px 0 #D94F9A', transition: 'transform 0.1s, box-shadow 0.1s' } as React.CSSProperties;

export default TopPage;

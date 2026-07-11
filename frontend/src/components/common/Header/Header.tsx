import React, { useState, useCallback } from 'react';
import { useSettingsStore } from '../../../store/settingsStore';
import { usePurchaseStore } from '../../../store/purchaseStore';
import Settings from '../Settings/Settings';
import HagurumaIcon from '../../../assets/icons/haguruma.svg';
import soundIcon from '../../../assets/icons/sound.svg';
import GuestIcon from '../../../assets/icons/guest.svg';
import UserIcon from '../../../assets/icons/user.svg';
import { unlockAudioContext, stopSpeaking } from '../../../services/speechSynthesis';
import { colors, fonts } from '../../../styles/theme';

const TITLE_TEXT = 'わたしはダレでしょう？クイズ';
// 白と淡いイエローを交互にして、キャンディっぽい賑やかさを出す
const TITLE_COLORS = ['#FFFFFF', '#FFF3B0'];

interface HeaderProps {
  onLoginRequest: () => void;
  onTitleClick?: () => void;
  currentView: 'TOP' | 'GAME';
}

const Header: React.FC<HeaderProps> = ({ onLoginRequest, onTitleClick, currentView }) => {
  const { isMuted, setIsMuted } = useSettingsStore();
  const { isLoggedIn } = usePurchaseStore();
  const [showSettings, setShowSettings] = useState(false);
  const [isSpeakingAllowed, setIsSpeakingAllowed] = useState(false);

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
  }, [isMuted, setIsMuted, isSpeakingAllowed]);

  return (
    <>
      <style>{`
        @keyframes title-letter-bounce {
          0%, 80%, 100% { transform: translateY(0) rotate(0deg); }
          40% { transform: translateY(-5px) rotate(-4deg); }
        }
        .title-letter {
          display: inline-block;
          animation: title-letter-bounce 2.4s ease-in-out infinite;
        }
      `}</style>
      <header style={stickyHeaderStyle}>
        <h1 style={titleStyle} onClick={onTitleClick}>
          {TITLE_TEXT.split('').map((char, i) => (
            <span
              key={i}
              className="title-letter"
              style={{
                animationDelay: `${i * 0.07}s`,
                color: TITLE_COLORS[i % TITLE_COLORS.length],
              }}
            >
              {char === ' ' ? ' ' : char}
            </span>
          ))}
        </h1>
        <div style={headerIconsStyle}>
          <button
            onClick={() => setShowSettings(true)}
            style={{ ...iconButtonStyle, ...(isLoggedIn ? loginActiveRingStyle : {}) }}
            title={isLoggedIn ? 'ログイン中: 設定からログアウト可' : 'ゲスト（設定からログイン）'}
          >
            <img src={isLoggedIn ? UserIcon : GuestIcon} alt={isLoggedIn ? 'ログイン中' : 'ゲスト'} style={iconImageStyle} />
            {isLoggedIn && <span style={loginActiveDotStyle}>✓</span>}
          </button>
          <button onClick={() => setShowSettings(true)} style={iconButtonStyle}>
            <img src={HagurumaIcon} alt="設定" style={iconImageStyle} />
          </button>
          <button onClick={handleToggleMute} style={{ ...iconButtonStyle, opacity: isMuted ? 0.4 : 1 }}>
            <img src={soundIcon} alt="音声" style={iconImageStyle} />
          </button>
        </div>
      </header>

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          currentView={currentView}
          onLoginRequest={() => { setShowSettings(false); onLoginRequest(); }}
        />
      )}
    </>
  );
};

const stickyHeaderStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: '64px',
  background: colors.headerGradient,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 8px',
  zIndex: 1000,
  boxShadow: '0 3px 12px rgba(74,68,88,0.2)',
  flexWrap: 'nowrap',
};
const titleStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontFamily: fonts.heading,
  fontSize: 'clamp(0.85em, 4.2vw, 1.65em)',
  margin: 0,
  textShadow: `1.5px 1.5px 0 ${colors.primaryDark}, -1.5px 1.5px 0 ${colors.primaryDark}, 1.5px -1.5px 0 ${colors.primaryDark}, -1.5px -1.5px 0 ${colors.primaryDark}, 3px 4px 5px rgba(74,68,88,0.35)`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  flexShrink: 1,
  minWidth: 0,
};
const headerIconsStyle: React.CSSProperties = { display: 'flex', gap: '4px', flexShrink: 0, flexWrap: 'nowrap' };
const iconButtonStyle: React.CSSProperties = { position: 'relative', backgroundColor: 'rgba(255,255,255,0.85)', border: '2px solid rgba(255,255,255,0.9)', borderRadius: '50%', width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 3px 6px rgba(74,68,88,0.18)' };
const iconImageStyle: React.CSSProperties = { width: '22px', height: '22px', objectFit: 'contain' };
const loginActiveRingStyle: React.CSSProperties = { border: `2px solid ${colors.primary}`, backgroundColor: '#fff' };
const loginActiveDotStyle: React.CSSProperties = { position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: colors.secondary, color: '#fff', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff', lineHeight: 1 };

export default Header;

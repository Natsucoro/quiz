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
import WalkingAnimals from '../WalkingAnimals';

const TITLE_TEXT = 'わたしはダレでしょう？クイズ';

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
        @keyframes title-pop-in {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes header-mascot-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2.5px); }
        }
      `}</style>
      <header style={stickyHeaderStyle}>
        <div style={brandGroupStyle} onClick={onTitleClick} title="トップにもどる">
          <img
            src="/character.png"
            alt="公式キャラクター「まるしば」"
            style={headerMascotStyle}
          />
          <h1 style={titleStyle}>
            {TITLE_TEXT}
          </h1>
        </div>
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
        <WalkingAnimals size={18} gap={12} style={headerAnimalsStyle} />
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

// ヘッダーの内側・下辺に配置するための位置指定。タイトルやアイコンより
// 奥（背面）に表示し、テキストやボタンの操作を妨げないようにする。
const headerAnimalsStyle: React.CSSProperties = {
  bottom: 0,
  top: 'auto',
  zIndex: -1,
  paddingTop: '6px',
  paddingBottom: '2px',
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
const brandGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
  flexShrink: 1,
  cursor: 'pointer',
};
const headerMascotStyle: React.CSSProperties = {
  height: '40px',
  width: 'auto',
  flexShrink: 0,
  filter: 'drop-shadow(0 2px 4px rgba(74,68,88,0.28))',
  animation: 'header-mascot-bob 3.2s ease-in-out infinite',
  transformOrigin: 'center bottom',
};
const titleStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontFamily: fonts.heading,
  fontSize: 'clamp(0.62em, 3.0vw, 1.45em)',
  margin: 0,
  color: colors.primaryDark,
  background: '#fff',
  padding: '5px 10px',
  borderRadius: '50px',
  boxShadow: '0 3px 0 rgba(74,68,88,0.15), 0 4px 8px rgba(74,68,88,0.12)',
  animation: 'title-pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flexShrink: 1,
  minWidth: 0,
};
const headerIconsStyle: React.CSSProperties = { display: 'flex', gap: '4px', flexShrink: 0, flexWrap: 'nowrap' };
const iconButtonStyle: React.CSSProperties = { position: 'relative', backgroundColor: 'rgba(255,255,255,0.85)', border: '2px solid rgba(255,255,255,0.9)', borderRadius: '50%', width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 3px 6px rgba(74,68,88,0.18)' };
const iconImageStyle: React.CSSProperties = { width: '22px', height: '22px', objectFit: 'contain' };
const loginActiveRingStyle: React.CSSProperties = { border: `2px solid ${colors.primary}`, backgroundColor: '#fff' };
const loginActiveDotStyle: React.CSSProperties = { position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: colors.secondary, color: '#fff', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff', lineHeight: 1 };

export default Header;

import React, { useState, useCallback } from 'react';
import { useSettingsStore } from '../../../store/settingsStore';
import { usePurchaseStore } from '../../../store/purchaseStore';
import Settings from '../Settings/Settings';
import HagurumaIcon from '../../../assets/icons/haguruma.svg';
import soundIcon from '../../../assets/icons/sound.svg';
import { unlockAudioContext, stopSpeaking } from '../../../services/speechSynthesis';

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
      <header style={stickyHeaderStyle}>
        <h1 style={titleStyle} onClick={onTitleClick}>わたしはダレでしょう？クイズ</h1>
        <div style={headerIconsStyle}>
          <button
            onClick={() => setShowSettings(true)}
            style={isLoggedIn ? loginBadgeActiveStyle : loginBadgeGuestStyle}
            title={isLoggedIn ? `ログイン中: 設定からログアウト可` : 'ゲスト（設定からログイン）'}
          >
            {isLoggedIn ? (
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
  background: 'linear-gradient(90deg, #FF6EC7 0%, #FF9A3C 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 8px',
  zIndex: 1000,
  boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
  flexWrap: 'nowrap',
};
const titleStyle: React.CSSProperties = {
  cursor: 'pointer',
  color: '#fff',
  fontSize: 'clamp(0.7em, 3.5vw, 1.4em)',
  margin: 0,
  textShadow: '1px 2px 0 rgba(0,0,0,0.18)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flexShrink: 1,
  minWidth: 0,
};
const headerIconsStyle: React.CSSProperties = { display: 'flex', gap: '4px', flexShrink: 0, flexWrap: 'nowrap' };
const iconButtonStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2em', cursor: 'pointer', boxShadow: '0 3px 6px rgba(0,0,0,0.15)' };
const loginBadgeGuestStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.7)', border: '2px solid rgba(255,255,255,0.9)', borderRadius: '50%', width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.55em', fontWeight: 'bold', color: '#888', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', whiteSpace: 'nowrap', flexShrink: 0 };
const loginBadgeActiveStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.7)', border: '3px solid #2E86DE', borderRadius: '50%', width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#2E86DE', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', whiteSpace: 'nowrap', flexShrink: 0 };

export default Header;

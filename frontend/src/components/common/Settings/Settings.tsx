
// src/components/common/Settings/Settings.tsx

import React, { useState } from 'react';
import HagurumaIcon from '../../../assets/icons/haguruma.svg';
import GuestIcon from '../../../assets/icons/guest.svg';
import UserIcon from '../../../assets/icons/user.svg';
import HatoIcon from '../../../assets/icons/hato.svg';
import InkoIcon from '../../../assets/icons/inko.svg';
import KeyLockIcon from '../../../assets/icons/key_lock.svg';
import ListIcon from '../../../assets/icons/list.svg';
import { getSpeechRate, setSpeechRate } from '../../../services/speechSynthesis';
import { usePurchaseStore } from '../../../store/purchaseStore';
import { auth } from '../../../lib/firebase';
import { signOut } from 'firebase/auth';
import LegalModal from '../LegalModal';
import { colors, fonts, shadow } from '../../../styles/theme';

interface SettingsProps {
  onClose: () => void;
  currentView: 'TOP' | 'GAME' | 'RESULT';
  onLoginRequest?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose, onLoginRequest }) => {
  const [speechRate, setLocalSpeechRate] = useState<number>(getSpeechRate());
  const [showLegal, setShowLegal] = useState<'tokushoho' | 'privacy' | 'terms' | null>(null);
  const { isLoggedIn, userEmail, logout } = usePurchaseStore();

  const handleSpeechRateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(event.target.value);
    setLocalSpeechRate(newRate);
    setSpeechRate(newRate);
  };

  const handleLogout = async () => {
    if (window.confirm('ログアウトしますか？')) {
      await signOut(auth);
      logout();
      onClose();
    }
  };

  return (
    <>
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <h2 style={modalTitleStyle}>
            <img src={HagurumaIcon} alt="" style={{ width: '28px', height: '28px', verticalAlign: 'middle', marginRight: '8px' }} />
            設定
          </h2>

          {/* ログイン状態 */}
          <div style={settingSectionStyle}>
            <h3 style={settingSectionTitleStyle}>アカウント</h3>
            {isLoggedIn ? (
              <>
                <p style={{ ...loginStatusStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <img src={UserIcon} alt="" style={{ height: '80px', width: 'auto', objectFit: 'contain' }} />
                  <span>ログイン済み</span>
                </p>
                <p style={{ fontSize: '0.85em', color: colors.inkSoft, marginBottom: '12px', wordBreak: 'break-all' }}>{userEmail}</p>
                <button onClick={handleLogout} style={{ ...buttonStyle, backgroundColor: colors.danger, boxShadow: `0 4px ${colors.dangerDark}` }}>
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <p style={{ ...loginStatusStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <img src={GuestIcon} alt="" style={{ height: '80px', width: 'auto', objectFit: 'contain' }} />
                  <span>ゲスト（未ログイン）</span>
                </p>
                <p style={{ fontSize: '0.85em', color: colors.inkSoft, marginBottom: '12px' }}>
                  ログインすると購入履歴が引き継がれます
                </p>
                <button
                  onClick={() => { onClose(); onLoginRequest?.(); }}
                  style={buttonStyle}
                >
                  ログイン / 登録
                </button>
              </>
            )}
          </div>

          {/* 読み上げ速度 */}
          <div style={settingSectionStyle}>
            <h3 style={settingSectionTitleStyle}>読み上げ速度</h3>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speechRate}
              onChange={handleSpeechRateChange}
              style={sliderStyle}
            />
            <span style={speechRateValueStyle}>{speechRate.toFixed(1)}倍</span>
          </div>

          {/* その他 */}
          <div style={settingSectionStyle}>
            <h3 style={settingSectionTitleStyle}>その他</h3>
            <p>
              <a href="mailto:watashihadare.quiz@gmail.com?subject=【わたしはダレでしょう？クイズ】お問い合わせ" style={linkStyle}>
                <img src={HatoIcon} alt="" style={settingsIconStyle} />
                お問い合わせ
              </a>
            </p>
            <p>
              <button onClick={() => setShowLegal('tokushoho')} style={textButtonStyle}>
                <img src={InkoIcon} alt="" style={settingsIconStyle} />
                特定商取引法に基づく表記
              </button>
            </p>
            <p>
              <button onClick={() => setShowLegal('privacy')} style={textButtonStyle}>
                <img src={KeyLockIcon} alt="" style={settingsIconStyle} />
                プライバシーポリシー
              </button>
            </p>
            <p>
              <button onClick={() => setShowLegal('terms')} style={textButtonStyle}>
                <img src={ListIcon} alt="" style={settingsIconStyle} />
                利用規約
              </button>
            </p>
            <p style={versionStyle}>バージョン 1.0.0</p>
          </div>

          <button onClick={onClose} style={{ ...buttonStyle, backgroundColor: '#E4DEE8', color: colors.ink, boxShadow: '0 4px #C7BFCF', marginTop: '8px' }}>
            閉じる
          </button>
        </div>
      </div>
      {showLegal && (
        <LegalModal
          onClose={() => setShowLegal(null)}
          initialTab={showLegal}
        />
      )}
    </>
  );
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(74, 68, 88, 0.55)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1100,
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '25px',
  borderRadius: '20px',
  boxShadow: shadow.lg,
  maxWidth: '400px',
  width: '90%',
  textAlign: 'center',
  fontFamily: fonts.body,
  maxHeight: '90vh',
  overflowY: 'auto',
};

const modalTitleStyle: React.CSSProperties = {
  color: colors.primaryDark,
  fontFamily: fonts.heading,
  marginBottom: '20px',
  fontSize: '1.6em',
  fontWeight: 'bold',
};

const settingSectionStyle: React.CSSProperties = {
  marginBottom: '20px',
  paddingBottom: '16px',
  borderBottom: '1px solid #f0f0f0',
};

const settingSectionTitleStyle: React.CSSProperties = {
  color: colors.ink,
  fontSize: '1.1em',
  marginBottom: '10px',
  fontWeight: 'bold',
};

const loginStatusStyle: React.CSSProperties = {
  fontSize: '1em',
  color: colors.ink,
  marginBottom: '6px',
  fontWeight: 'bold',
};

const sliderStyle: React.CSSProperties = {
  width: '80%',
  height: '8px',
  borderRadius: '5px',
  background: '#ddd',
  outline: 'none',
  'WebkitAppearance': 'none',
  appearance: 'none',
  marginTop: '10px',
  marginBottom: '5px',
};

const speechRateValueStyle: React.CSSProperties = {
  fontSize: '1.1em',
  fontWeight: 'bold',
  color: colors.primaryDark,
  marginLeft: '10px',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: colors.primary,
  color: 'white',
  padding: '10px 24px',
  border: 'none',
  borderRadius: '50px',
  cursor: 'pointer',
  fontSize: '1em',
  fontWeight: 'bold',
  margin: '4px',
  boxShadow: `0 4px ${colors.primaryDark}`,
  transition: 'transform 0.1s',
};

const linkStyle: React.CSSProperties = {
  color: colors.violetDark,
  textDecoration: 'none',
  margin: '8px 0',
  display: 'inline-block',
  fontWeight: 'bold',
};
const textButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none',
  color: colors.violetDark, fontWeight: 'bold',
  cursor: 'pointer', fontSize: '1em',
  fontFamily: fonts.body,
  padding: '4px 0',
};

const settingsIconStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  objectFit: 'contain',
  verticalAlign: 'middle',
  marginRight: '10px',
};

const versionStyle: React.CSSProperties = {
  fontSize: '0.8em',
  color: colors.inkSoft,
  marginTop: '12px',
};

export default Settings;

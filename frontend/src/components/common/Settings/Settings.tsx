
// src/components/common/Settings/Settings.tsx

import React, { useState } from 'react';
import { getSpeechRate, setSpeechRate } from '../../../services/speechSynthesis';
import { getAvailableGenres, getAvailableDifficultiesForGenre } from '../../../services/quizEngine';
import gearIcon from '../../../assets/icons/gear.svg';
import { SpriteIcon } from '../SpriteIcon';

interface SettingsProps {
  onClose: () => void;
  currentView: 'TOP' | 'GAME' | 'RESULT';
}

const Settings: React.FC<SettingsProps> = ({ onClose, currentView }) => {
  const [speechRate, setLocalSpeechRate] = useState<number>(getSpeechRate());

  const handleSpeechRateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(event.target.value);
    setLocalSpeechRate(newRate);
    setSpeechRate(newRate);
  };

  return (
    <>
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <h2 style={{ ...modalTitleStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <img src={gearIcon} alt="設定" style={{ width: 40, height: 40 }} />
            設定
          </h2>

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

          <div style={settingSectionStyle}>
            <h3 style={settingSectionTitleStyle}>その他</h3>
            <p><a href="#" style={linkStyle}>お問い合わせ</a></p>
            <p><a href="#" style={linkStyle}>利用規約 / プライバシーポリシー</a></p>
            <p style={versionStyle}>バージョン 1.0.0</p>
          </div>

          <button onClick={onClose} style={{ ...buttonStyle, backgroundColor: '#ccc', color: '#555', boxShadow: '0 4px #999', marginTop: '20px' }}>
            閉じる
          </button>
        </div>
      </div>
    </>
  );
};

// Styles (簡易的なフラットデザイン)
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '25px',
  borderRadius: '15px',
  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
  maxWidth: '500px',
  width: '90%',
  textAlign: 'center',
  fontFamily: "'Zen Maru Gothic', sans-serif",
  maxHeight: '90vh',
  overflowY: 'auto',
};

const modalTitleStyle: React.CSSProperties = {
  color: '#4682B4',
  marginBottom: '25px',
  fontSize: '2em',
  fontWeight: 'bold',
};

const settingSectionStyle: React.CSSProperties = {
  marginBottom: '25px',
  paddingBottom: '15px',
  borderBottom: '1px solid #eee',
};

const settingSectionTitleStyle: React.CSSProperties = {
  color: '#555',
  fontSize: '1.4em',
  marginBottom: '10px',
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
  color: '#4682B4',
  marginLeft: '10px',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#FF69B4',
  color: 'white',
  padding: '10px 20px',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '1em',
  fontWeight: 'bold',
  margin: '8px',
  boxShadow: '0 4px #CD5C91',
  transition: 'background-color 0.2s, transform 0.1s ease-out',
};

const loginStatusStyle: React.CSSProperties = {
  fontSize: '1em',
  color: '#333',
  marginBottom: '10px',
};

const linkStyle: React.CSSProperties = {
  color: '#4682B4',
  textDecoration: 'none',
  margin: '5px 0',
  display: 'inline-block',
};

const versionStyle: React.CSSProperties = {
  fontSize: '0.8em',
  color: '#999',
  marginTop: '15px',
};

export default Settings;

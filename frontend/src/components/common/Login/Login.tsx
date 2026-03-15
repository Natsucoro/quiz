
// src/components/common/Login/Login.tsx

import React, { useState } from 'react';

interface LoginProps {
  onClose: () => void;
  onLoginSuccess: (isPremium: boolean) => void;
}

const PREMIUM_USER_EMAIL = 'test@example.com';
const LOCAL_STORAGE_LOGIN_STATUS_KEY = 'quizAppLoginStatus';

export const saveLoginStatus = (isLoggedIn: boolean, isPremium: boolean) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_LOGIN_STATUS_KEY, JSON.stringify({ isLoggedIn, isPremium }));
};

export const getLoginStatus = (): { isLoggedIn: boolean; isPremium: boolean } => {
  if (typeof window === 'undefined') return { isLoggedIn: false, isPremium: false };
  const stored = localStorage.getItem(LOCAL_STORAGE_LOGIN_STATUS_KEY);
  return stored ? JSON.parse(stored) : { isLoggedIn: false, isPremium: false };
};

const Login: React.FC<LoginProps> = ({ onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    setError('');
    // 簡易的なログインロジック
    if (email === PREMIUM_USER_EMAIL && password === 'password') { // パスワードは仮
      saveLoginStatus(true, true);
      onLoginSuccess(true);
      onClose();
    } else if (email && password) { // ゲストログインをシミュレート
      saveLoginStatus(true, false);
      onLoginSuccess(false);
      onClose();
    }
    else {
      setError('メールアドレスとパスワードを入力してください。');
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={modalTitleStyle}>ログイン</h2>
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        {error && <p style={errorStyle}>{error}</p>}
        <button onClick={handleLogin} style={buttonStyle}>
          ログイン
        </button>
        <button onClick={onClose} style={{ ...buttonStyle, backgroundColor: '#ccc' }}>
          キャンセル
        </button>
      </div>
    </div>
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
  padding: '30px',
  borderRadius: '15px',
  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
  maxWidth: '400px',
  width: '90%',
  textAlign: 'center',
  fontFamily: "'Zen Maru Gothic', sans-serif",
};

const modalTitleStyle: React.CSSProperties = {
  color: '#4682B4',
  marginBottom: '20px',
  fontSize: '1.8em',
  fontWeight: 'bold',
};

const inputStyle: React.CSSProperties = {
  width: 'calc(100% - 20px)',
  padding: '12px 10px',
  margin: '10px 0',
  borderRadius: '8px',
  border: '1px solid #ccc',
  fontSize: '1em',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#FF69B4',
  color: 'white',
  padding: '12px 25px',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '1.1em',
  fontWeight: 'bold',
  margin: '10px 5px',
  boxShadow: '0 4px #CD5C91',
  transition: 'background-color 0.2s, transform 0.1s ease-out',
};

const errorStyle: React.CSSProperties = {
  color: 'red',
  marginTop: '10px',
  fontSize: '0.9em',
};

export default Login;

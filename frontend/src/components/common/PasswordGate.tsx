import React, { useState } from 'react';
import FloatingShapes from './FloatingShapes';

interface PasswordGateProps {
  onUnlock: () => void;
}

const PasswordGate: React.FC<PasswordGateProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1234') { // 本番運用時は環境変数にするのが望ましいが、一旦固定値
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div style={containerStyle}>
      <FloatingShapes />
      <div style={cardStyle}>
        <div style={iconStyle}>🔒</div>
        <h1 style={titleStyle}>合言葉を入力してください</h1>
        <p style={subtitleStyle}>関係者限定のアクセス制限がかかっています。</p>
        <form onSubmit={handleSubmit} style={formStyle}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="合言葉 (Passcode)"
            style={{
              ...inputStyle,
              borderColor: error ? '#ff4757' : '#ddd',
              animation: error ? 'shake 0.5s linear' : 'none'
            }}
            autoFocus
          />
          <button type="submit" style={buttonStyle}>
            解除する →
          </button>
        </form>
        {error && <p style={errorStyle}>合言葉が違います。</p>}
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
      `}</style>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  background: 'linear-gradient(135deg, #FF9DE2 0%, #FFD6A5 50%, #FFFB8F 100%)',
  fontFamily: "'Yomogi', cursive",
  padding: '20px',
  boxSizing: 'border-box'
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  padding: '40px 30px',
  borderRadius: '30px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
  width: '100%',
  maxWidth: '400px',
  textAlign: 'center',
  zIndex: 10
};

const iconStyle: React.CSSProperties = {
  fontSize: '4em',
  marginBottom: '20px'
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.4em',
  color: '#FF5FA0',
  marginBottom: '10px'
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.9em',
  color: '#666',
  marginBottom: '30px'
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '15px'
};

const inputStyle: React.CSSProperties = {
  padding: '15px',
  borderRadius: '15px',
  border: '3px solid #ddd',
  fontSize: '1.2em',
  textAlign: 'center',
  outline: 'none',
  transition: 'border-color 0.2s'
};

const buttonStyle: React.CSSProperties = {
  padding: '15px',
  borderRadius: '50px',
  border: 'none',
  background: 'linear-gradient(135deg, #FF6EC7, #FF9A3C)',
  color: '#fff',
  fontSize: '1.1em',
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '0 5px 0 #D94F9A',
  transition: 'transform 0.1s'
};

const errorStyle: React.CSSProperties = {
  color: '#ff4757',
  marginTop: '15px',
  fontWeight: 'bold',
  fontSize: '0.9em'
};

export default PasswordGate;

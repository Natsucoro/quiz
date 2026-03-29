import React, { useState } from 'react';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface LoginPageProps {
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const actionCodeSettings = {
      // ログイン後に戻ってくるURL（ローカル開発と本番で動的に変わる）
      url: window.location.origin,
      handleCodeInApp: true,
    };

    try {
      // 言語を日本語に設定
      auth.languageCode = 'ja';
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
      setIsSent(true);
      setErrorMsg('');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'メールの送信に失敗しました');
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={contentStyle}>
        <button 
          onClick={onBack}
          style={closeButtonStyle}
        >
          ✖
        </button>

        <h2 style={{ color: '#FF6EC7', marginBottom: '15px' }}>ログイン・登録</h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
          パスワードは不要です！入力したメールアドレスにログイン用のリンクをお送りします。
        </p>

        {isSent ? (
          <div style={{ padding: '20px', background: '#d1fae5', color: '#065f46', borderRadius: '8px' }}>
            <h3>📧 メールを送信しました！</h3>
            <p>受信トレイを確認し、リンクをクリックしてログインを完了してください。</p>
            <p style={{ fontSize: '12px', marginTop: '10px' }}>※この小窓は閉じても大丈夫です</p>
          </div>
        ) : (
        <form onSubmit={handleSendLink} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="email" 
            placeholder="メールアドレス" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px' }}
            required
          />
          {errorMsg && <p style={{ color: 'red', fontSize: '14px' }}>{errorMsg}</p>}
          <button 
            type="submit" 
            style={{ padding: '14px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)' }}
          >
            ログインリンクを送信
          </button>
        </form>
      )}
      </div>
    </div>
  );
};

// Styles
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  zIndex: 1000,
};
const contentStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '30px 25px',
  borderRadius: '15px',
  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
  maxWidth: '400px', width: '90%',
  textAlign: 'center',
  position: 'relative',
  fontFamily: "'Yomogi', cursive",
};
const closeButtonStyle: React.CSSProperties = {
  position: 'absolute', top: '10px', right: '15px',
  background: 'none', border: 'none',
  fontSize: '1.5em', color: '#aaa', cursor: 'pointer',
};

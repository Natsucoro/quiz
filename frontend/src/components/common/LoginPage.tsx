import React, { useState } from 'react';
import HatoIcon from '../../assets/icons/hato.svg';
import { sendSignInLinkToEmail, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import { useToastStore } from '../../store/toastStore';
import { trackEvent } from '../../services/analytics';

interface LoginPageProps {
  onBack: () => void;
}

// ポップアップがブロックされた/埋め込みブラウザ等で使えない場合に
// リダイレクト方式へフォールバックすべきエラーコード
const POPUP_FALLBACK_ERROR_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
]);

export const LoginPage: React.FC<LoginPageProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setIsGoogleLoading(true);
    trackEvent('login_start', { method: 'google' });
    try {
      await signInWithPopup(auth, googleProvider);
      // 購入状態への反映はApp.tsx側のonAuthStateChangedが検知して行うので、
      // ここでは成功通知を出してモーダルを閉じるだけでよい
      trackEvent('login_success', { method: 'google' });
      showToast('Googleでログインしました！');
      onBack();
    } catch (error: any) {
      console.error('Google login error:', error);
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        // ユーザーが自分でポップアップを閉じただけなのでエラー表示は不要
        setIsGoogleLoading(false);
        return;
      }
      if (POPUP_FALLBACK_ERROR_CODES.has(error?.code)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return; // ページ遷移するのでここで終了
        } catch (redirectError) {
          console.error('Google redirect login error:', redirectError);
        }
      }
      setErrorMsg('Googleログインに失敗しました。もう一度お試しください。');
      setIsGoogleLoading(false);
    }
  };

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
      trackEvent('login_start', { method: 'email' });
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

        {!isSent && (
          <>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              style={googleButtonStyle}
            >
              <GoogleIcon />
              {isGoogleLoading ? 'ログイン中…' : 'Googleでログイン'}
            </button>
            <div style={dividerRowStyle}>
              <span style={dividerLineStyle} />
              <span style={{ color: '#999', fontSize: '13px' }}>または</span>
              <span style={dividerLineStyle} />
            </div>
          </>
        )}

        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
          パスワードは不要です！入力したメールアドレスにログイン用のリンクをお送りします。
        </p>

        {errorMsg && !isSent && <p style={{ color: 'red', fontSize: '14px', marginTop: '-10px' }}>{errorMsg}</p>}

        {isSent ? (
          <div style={{ padding: '20px', background: '#d1fae5', color: '#065f46', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
            <img src={HatoIcon} alt="" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
            <h3 style={{ margin: 0 }}>メールを送信しました！</h3>
            <p>受信トレイを確認し、リンクをクリックしてログインを完了してください。</p>
            <p style={{ fontSize: '12px', marginTop: '10px' }}>
              ※メールが見当たらない場合は、迷惑メールフォルダもご確認ください
            </p>
            <p style={{ fontSize: '12px' }}>※この小窓は閉じても大丈夫です</p>
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

// Googleの公式ロゴ（4色の「G」）
const GoogleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

// Styles
const googleButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
  width: '100%', padding: '12px', borderRadius: '8px',
  border: '1px solid #ddd', backgroundColor: '#fff', color: '#3c4043',
  fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)', fontFamily: "'Zen Maru Gothic', sans-serif",
};
const dividerRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0',
};
const dividerLineStyle: React.CSSProperties = {
  flex: 1, height: '1px', backgroundColor: '#eee',
};
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  zIndex: 1000,
  animation: 'fadeIn 0.2s ease-out',
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
  animation: 'screenIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
};
const closeButtonStyle: React.CSSProperties = {
  position: 'absolute', top: '10px', right: '15px',
  background: 'none', border: 'none',
  fontSize: '1.5em', color: '#aaa', cursor: 'pointer',
};

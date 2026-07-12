import React, { useState, useCallback, useEffect } from 'react';
import TopPage from './components/TopPage/TopPage';
import GamePage from './components/GamePage/GamePage';
import FloatingMicBar from './components/common/FloatingMicBar/FloatingMicBar';
import { useSettingsStore } from './store/settingsStore';
import { speechRecognitionService } from './services/speechRecognition';
import { syncWithPurchases } from './services/syncService';
import FloatingShapes from './components/common/FloatingShapes';
import { usePurchaseStore } from './store/purchaseStore';
import { useToastStore } from './store/toastStore';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User, isSignInWithEmailLink, signInWithEmailLink, getRedirectResult } from 'firebase/auth';
import { LoginPage } from './components/common/LoginPage';
import PasswordGate from './components/common/PasswordGate';
import Footer from './components/common/Footer/Footer';
import Toast from './components/common/Toast/Toast';
import PromptDialog from './components/common/PromptDialog';
import { colors, fonts } from './styles/theme';
import { getPaidDifficultiesForGenre } from './services/quizEngine';
import { trackEvent } from './services/analytics';

// バックエンド(functions/src/index.ts)の価格設定と一致させること
const SINGLE_PRICE_JPY = 120;
const GENRE_BUNDLE_PRICE_PER_LEVEL_JPY = 55;
const ALL_BUNDLE_PRICE_JPY = 1480;

const App: React.FC = () => {
  const { isHandsFree: isHandsFreeMode } = useSettingsStore();

  // パスワードロック状態の管理 (sessionStorageでこのセッション中のみ保存)
  // 合言葉は「ローカル開発サーバー」と「Firebase Hostingのプレビューチャンネル(ステージング)」で要求し、
  // 本番ドメインでのみ常に解除済みとする
  const [isUnlocked, setIsUnlocked] = useState(() => {
    const PRODUCTION_HOSTNAMES = ['watashihadare-quiz.web.app', 'watashihadare-quiz.firebaseapp.com'];
    return (
      sessionStorage.getItem('app_unlocked') === 'true' ||
      import.meta.env.DEV ||
      PRODUCTION_HOSTNAMES.includes(window.location.hostname)
    );
  });
  
  const [currentPage, setCurrentPage] = useState<'top' | 'game'>('top');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number>(1);
  const [selectedCount, setSelectedCount] = useState<number>(10);
  const [topInitialView, setTopInitialView] = useState<'genre' | 'difficulty'>('genre');
  const [micStatus, setMicStatus] = useState({ isRecognizing: false, isListening: false, isProcessing: false, transcript: '' });
  const [user, setUser] = useState<User | null>(null);
  const { addPurchase, syncWithClaims, login: purchaseLogin, setLoggedOut: purchaseSetLoggedOut } = usePurchaseStore();
  const [showLogin, setShowLogin] = useState(false);
  const [isProcessingLogin, setIsProcessingLogin] = useState(false);
  const { message: toastMessage, showToast: setToastMessage, hideToast } = useToastStore();
  const [pendingEmailPrompt, setPendingEmailPrompt] = useState(false);

  const completeEmailSignIn = useCallback((email: string) => {
    signInWithEmailLink(auth, email, window.location.href)
      .then(async (result) => {
        window.localStorage.removeItem('emailForSignIn');
        // パラメータを消して履歴を置換
        window.history.replaceState({}, document.title, window.location.pathname);

        // ユーザー情報をストアに反映
        if (result.user) {
          const u = result.user;
          purchaseLogin(u.email ?? '');
          const token = await u.getIdTokenResult(true);
          if (token.claims.purchasedItems || token.claims.allUnlocked) {
            syncWithClaims((token.claims.purchasedItems as string[]) || [], token.claims.allUnlocked as boolean);
          }
        }

        trackEvent('login_success', { method: 'email' });
        setToastMessage('ログインに成功しました！');
      })
      .catch((error) => {
        console.error('Login Error:', error);
        // 本物のエラーの場合のみ通知を出す
        if (error.code !== 'auth/invalid-action-code') {
          setToastMessage('ログインに失敗しました。リンクが無効か、期限が切れている可能性があります。');
        }
      })
      .finally(() => {
        setIsProcessingLogin(false);
      });
  }, [purchaseLogin, syncWithClaims]);

  // Firebase Auth の初期化とメールリンクからのログイン復帰
  useEffect(() => {
    // メールリンクから戻ってきた場合の処理
    if (isSignInWithEmailLink(auth, window.location.href)) {
      if (isProcessingLogin) return; // 二重処理防止
      setIsProcessingLogin(true);

      const savedEmail = window.localStorage.getItem('emailForSignIn');
      if (savedEmail) {
        completeEmailSignIn(savedEmail);
      } else {
        // window.prompt()はサンドボックス化された埋め込み環境では
        // 無反応(即nullを返す)になることがあるため、アプリ内モーダルで代替する
        setPendingEmailPrompt(true);
      }
    }

    // Googleログインがポップアップ不可な環境でリダイレクト方式にフォールバックした場合の復帰処理
    // （購入状態のストア反映はonAuthStateChangedが行うので、ここでは通知表示のみ担当）
    getRedirectResult(auth)
      .then((result) => {
        if (result) setToastMessage('Googleでログインしました！');
      })
      .catch((error) => {
        console.error('Google redirect login error:', error);
        setToastMessage('Googleログインに失敗しました。もう一度お試しください。');
      });

    // ログイン状態の監視
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        purchaseLogin(u.email ?? '');
        const token = await u.getIdTokenResult(true);
        if ((token.claims.purchasedItems && Array.isArray(token.claims.purchasedItems)) || token.claims.allUnlocked) {
          syncWithClaims((token.claims.purchasedItems as string[]) || [], token.claims.allUnlocked as boolean);
        }
      } else {
        setUser(null);
        purchaseSetLoggedOut(); // 購入データは保持し、ログイン状態のみリセット
      }
    });
    return () => unsub();
  }, [syncWithClaims]);

  // Stripeからのリダイレクト（成功）検知とFunctionsへの問い合わせ
  useEffect(() => {
    const checkPayment = async () => {
      const params = new URLSearchParams(window.location.search);
      const isSuccess = params.get('success');
      const itemId = params.get('itemId');
      const sessionId = params.get('session_id');

      if (isSuccess === 'true' && itemId && sessionId && user) {
        // 単品購入(${genre}_${level})か、まとめ買い(BUNDLE_GENRE_${genre} / BUNDLE_ALL)かを判定して
        // 完了メッセージを出し分ける
        let successMessage: string;
        let planType: 'single' | 'genre' | 'all';
        let planValue: number;
        if (itemId === 'BUNDLE_ALL') {
          successMessage = '🎉 決済完了！全ジャンル・全レベルが解放されました！';
          planType = 'all';
          planValue = ALL_BUNDLE_PRICE_JPY;
        } else if (itemId.startsWith('BUNDLE_GENRE_')) {
          const bundleGenre = decodeURIComponent(itemId.slice('BUNDLE_GENRE_'.length));
          successMessage = `🎉 決済完了！「${bundleGenre}」が全レベル解放されました！`;
          planType = 'genre';
          planValue = getPaidDifficultiesForGenre(bundleGenre).length * GENRE_BUNDLE_PRICE_PER_LEVEL_JPY;
        } else {
          const lastUnderscore = itemId.lastIndexOf('_');
          const genre = itemId.slice(0, lastUnderscore);
          const level = itemId.slice(lastUnderscore + 1);
          successMessage = `🎉 決済完了！「${genre} Lv.${level}」が解放されました！`;
          planType = 'single';
          planValue = SINGLE_PRICE_JPY;
        }

        try {
          // Functionsへ決済確認と解放リクエスト
          const token = await user.getIdToken();
          const res = await fetch('/api/verifyPayment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sessionId })
          });

          if (res.ok) {
            // パラメータを消してリロード
            window.history.replaceState({}, document.title, window.location.pathname);

            // トークンをリフレッシュして最新の Claims を store に反映
            const newToken = await user.getIdTokenResult(true);
            if (newToken.claims.purchasedItems || newToken.claims.allUnlocked) {
               syncWithClaims((newToken.claims.purchasedItems as string[]) || [], newToken.claims.allUnlocked as boolean);
            } else if (!itemId.startsWith('BUNDLE_')) {
               addPurchase(itemId); // 単品購入時のみのフォールバック
            }

            trackEvent('purchase', { transaction_id: sessionId, plan_type: planType, value: planValue, currency: 'JPY' });
            setToastMessage(successMessage);
          } else {
            console.error('Payment verification failed', await res.text());
            setToastMessage('決済の確認に失敗しました。');
          }
        } catch (err) {
          console.error(err);
        }
      }
    };
    checkPayment();
  }, [user, addPurchase, syncWithClaims]);

  useEffect(() => {
    speechRecognitionService.onRecognizingChange((recognizing) => {
      setMicStatus(prev => ({ ...prev, isRecognizing: recognizing }));
    });
  }, []);

  // TOP画面⇔クイズ画面の切り替え時、画面の一番上にスクロールし直す
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentPage]);

  useEffect(() => {
    if (currentPage === 'top') {
      speechRecognitionService.onResult((transcript, isFinal) => {
        setMicStatus(prev => ({
          ...prev,
          isListening: !isFinal,
          transcript: isFinal ? '' : transcript,
        }));
      });
    }
  }, [currentPage]);

  useEffect(() => {
    if (isHandsFreeMode && currentPage === 'top') {
      speechRecognitionService.start();
    }
  }, [isHandsFreeMode, currentPage]);

  const handleMicStatus = useCallback((status: { isRecognizing: boolean; isListening: boolean; isProcessing: boolean; transcript: string }) => {
    setMicStatus(status);
  }, []);

  const handleStart = (genre: string, difficulty: number, count: number) => {
    setSelectedGenre(genre);
    setSelectedDifficulty(difficulty);
    setSelectedCount(count);
    setCurrentPage('game');
  };

  const handleBack = () => {
    setTopInitialView('genre');
    setCurrentPage('top');
  };

  const handleBackToDifficulty = () => {
    setTopInitialView('difficulty');
    setCurrentPage('top');
  };

  if (!isUnlocked) {
    return <PasswordGate onUnlock={() => {
      setIsUnlocked(true);
      sessionStorage.setItem('app_unlocked', 'true');
    }} />;
  }

  return (
    <div style={{
      fontFamily: fonts.body,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      background: colors.bgGradient,
      overflow: 'hidden'
    }}>
      <FloatingShapes />
      
      <div key={currentPage} style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, animation: 'screenIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
        {currentPage === 'top' ? (
        <TopPage onStart={handleStart} initialView={topInitialView} onLoginRequest={() => setShowLogin(true)} />
      ) : (
        <GamePage
          genre={selectedGenre}
          difficulty={selectedDifficulty}
          questionCount={selectedCount}
          onBack={handleBack}
          onBackToDifficulty={handleBackToDifficulty}
          onMicStatus={handleMicStatus}
          onLoginRequest={() => setShowLogin(true)}
        />
      )}
      </div>

      <Footer />
      
      {showLogin && (
        <LoginPage onBack={() => setShowLogin(false)} />
      )}

      {isHandsFreeMode && (
        <FloatingMicBar
          isRecognizing={micStatus.isRecognizing}
          isListening={micStatus.isListening}
          isProcessing={micStatus.isProcessing}
          transcript={micStatus.transcript}
        />
      )}

      {pendingEmailPrompt && (
        <PromptDialog
          message="確認のため、もう一度メールアドレスを入力してください"
          placeholder="you@example.com"
          confirmLabel="ログイン"
          onConfirm={(email) => {
            setPendingEmailPrompt(false);
            if (email) {
              completeEmailSignIn(email);
            } else {
              setIsProcessingLogin(false);
            }
          }}
          onCancel={() => {
            setPendingEmailPrompt(false);
            setIsProcessingLogin(false);
          }}
        />
      )}

      <Toast message={toastMessage} onClose={hideToast} />
    </div>
  );
};

export default App;

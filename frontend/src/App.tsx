import React, { useState, useCallback, useEffect } from 'react';
import TopPage from './components/TopPage/TopPage';
import GamePage from './components/GamePage/GamePage';
import FloatingMicBar from './components/common/FloatingMicBar/FloatingMicBar';
import { useSettingsStore } from './store/settingsStore';
import { speechRecognitionService } from './services/speechRecognition';
import { usePurchaseStore } from './store/purchaseStore';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { LoginPage } from './components/common/LoginPage';
import PasswordGate from './components/common/PasswordGate';

const App: React.FC = () => {
  const { isHandsFree: isHandsFreeMode } = useSettingsStore();

  // パスワードロック状態の管理 (sessionStorageでこのセッション中のみ保存)
  const [isUnlocked, setIsUnlocked] = useState(() =>
    sessionStorage.getItem('app_unlocked') === 'true' || window.location.hostname === 'localhost'
  );
  
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

  // Firebase Auth の初期化とメールリンクからのログイン復帰
  useEffect(() => {
    // メールリンクから戻ってきた場合の処理
    if (isSignInWithEmailLink(auth, window.location.href)) {
      if (isProcessingLogin) return; // 二重処理防止
      setIsProcessingLogin(true);

      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('確認のため、もう一度メールアドレスを入力してください');
      }

      if (email) {
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
              if (token.claims.purchasedItems) syncWithClaims(token.claims.purchasedItems as string[]);
            }
            
            alert('ログインに成功しました！');
          })
          .catch((error) => {
            console.error('Login Error:', error);
            // 本物のエラーの場合のみアラートを出す
            if (error.code !== 'auth/invalid-action-code') {
              alert('ログインに失敗しました。リンクが無効か、期限が切れている可能性があります。');
            }
          })
          .finally(() => {
            setIsProcessingLogin(false);
          });
      } else {
        setIsProcessingLogin(false);
      }
    }

    // ログイン状態の監視
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        purchaseLogin(u.email ?? '');
        const token = await u.getIdTokenResult(true);
        if (token.claims.purchasedItems && Array.isArray(token.claims.purchasedItems)) {
          syncWithClaims(token.claims.purchasedItems);
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
      const rawGenre = params.get('genre');
      const level = params.get('level');
      const sessionId = params.get('session_id');

      const genreMap: Record<string, string> = { 
        'mammals': '哺乳類', 
        'insects': '昆虫', 
        'plants': '植物', 
        'vehicles': '乗り物', 
        'tools': '道具', 
        'food': '食べ物',
        'historical_figures': '歴史上の人物',
        'japan_geography': '日本地理',
        'world_geography': '世界地理'
      };
      
      if (isSuccess === 'true' && rawGenre && level && sessionId && user) {
        const genre = genreMap[rawGenre] || rawGenre;
        const itemId = `${genre}_${level}`;

        try {
          // Functionsへ決済確認と解放リクエスト
          const token = await user.getIdToken();
          const res = await fetch('/api/verifyPayment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sessionId, itemId })
          });

          if (res.ok) {
            // パラメータを消してリロード
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // トークンをリフレッシュして最新の Claims を store に反映
            const newToken = await user.getIdTokenResult(true);
            if (newToken.claims.purchasedItems) {
               syncWithClaims(newToken.claims.purchasedItems as string[]);
            } else {
               addPurchase(itemId); // fallback
            }

            alert(`🎉 決済完了！\n「${genre} Lv.${level}」が解放されました！`);
          } else {
            console.error('Payment verification failed', await res.text());
            alert('決済の確認に失敗しました。');
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
    <div style={{ fontFamily: "'Yomogi', cursive", minHeight: '100vh', position: 'relative' }}>
      
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
    </div>
  );
};

export default App;

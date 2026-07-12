import React, { useState } from 'react';
import { usePurchaseStore } from '../../store/purchaseStore';
import { auth } from '../../lib/firebase';
import { getAllAvailableQuizzesCount, getGenreBundleItemIds } from '../../services/quizEngine';
import { colors, fonts, shadow } from '../../styles/theme';

// バックエンド(functions/src/index.ts)の価格設定と一致させること
const GENRE_BUNDLE_PRICE_PER_LEVEL_JPY = 55;
const ALL_BUNDLE_PRICE_JPY = 1480;

interface PaywallModalProps {
  genre: string;
  difficulty: number;
  onClose: () => void;
  onTestPurchase: () => void; // Cloud Function呼び出しに失敗した際のフォールバック(開発用モック)
  onLoginRequest: () => void;
}

const PaywallModal: React.FC<PaywallModalProps> = ({ genre, difficulty, onClose, onTestPurchase, onLoginRequest }) => {
  const { isPurchased, isLoggedIn, purchasedItems, allUnlocked } = usePurchaseStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const itemId = `${genre}_${difficulty}`;
  const alreadyPurchased = isPurchased(itemId);
  const questionCount = getAllAvailableQuizzesCount(genre, difficulty);

  const genreBundleItemIds = getGenreBundleItemIds(genre);
  const genreBundlePrice = genreBundleItemIds.length * GENRE_BUNDLE_PRICE_PER_LEVEL_JPY;
  const genreAlreadyUnlocked = allUnlocked || genreBundleItemIds.every((id) => purchasedItems.includes(id));

  const startCheckout = async (body: Record<string, unknown>) => {
    if (isProcessing) return;

    // 未ログインの場合は購入前にログイン画面を出す
    if (!isLoggedIn || !auth.currentUser) {
      onLoginRequest();
      return;
    }

    setIsProcessing(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/createCheckoutSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ ...body, origin: window.location.origin }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url;
    } catch (error) {
      console.error('Failed to start checkout:', error);
      // 単品購入時のみ、Cloud Function呼び出し失敗時に開発用モック購入にフォールバック
      if (body.bundleType === 'single') {
        onTestPurchase();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurchase = () => {
    if (alreadyPurchased) return;
    startCheckout({ bundleType: 'single', itemId, genre, difficulty });
  };

  const handleGenreBundlePurchase = () => {
    if (genreAlreadyUnlocked) return;
    startCheckout({ bundleType: 'genre', genre, itemIds: genreBundleItemIds });
  };

  const handleAllBundlePurchase = () => {
    if (allUnlocked) return;
    startCheckout({ bundleType: 'all' });
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button onClick={onClose} style={closeButtonStyle}>✖</button>
        <h2 style={titleStyle}>🔒 レベル解放</h2>
        <p style={{ textAlign: 'center', margin: '20px 0', fontSize: '1.2em' }}>
          <strong>「{genre} Lv.{difficulty}」</strong> は<br />
          プレミアムレベルです！
        </p>
        
        <div style={featureBoxStyle}>
          <h3 style={{ margin: '0 0 10px', color: '#fff' }}>✨ 買い切り特典 ✨</h3>
          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>全 <strong>{questionCount}問</strong> が遊び放題に！</li>
            <li>一度購入すればずっと遊べます！</li>
          </ul>
        </div>
        
        {alreadyPurchased ? (
          <button style={purchasedButtonStyle} disabled>
            ✅ 購入済みです
          </button>
        ) : (
          <button onClick={handlePurchase} disabled={isProcessing} style={{ ...purchaseButtonStyle, opacity: isProcessing ? 0.7 : 1 }}>
            {isProcessing ? '準備中…' : '💴 120円 で解放する'}
          </button>
        )}

        <p style={{ marginTop: '14px', fontSize: '0.75em', color: colors.inkSoft, textAlign: 'center' }}>
          ※買い切り。一度購入するとずっと遊べます。
        </p>

        {!allUnlocked && (
          <div style={bundleSectionStyle}>
            <p style={bundleDividerStyle}>🎁 まとめ買いでもっとお得に</p>

            {!genreAlreadyUnlocked && (
              <button onClick={handleGenreBundlePurchase} disabled={isProcessing} style={{ ...bundleButtonStyle, opacity: isProcessing ? 0.7 : 1 }}>
                「{genre}」全レベルまとめ買い（{genreBundlePrice}円）
              </button>
            )}

            <button onClick={handleAllBundlePurchase} disabled={isProcessing} style={{ ...bundleButtonStyle, background: colors.violet, opacity: isProcessing ? 0.7 : 1 }}>
              全ジャンル・全レベル まとめ買い（{ALL_BUNDLE_PRICE_JPY}円）
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(74,68,88,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { position: 'relative', width: '90%', maxWidth: '400px', backgroundColor: '#fff', borderRadius: '24px', padding: '30px', boxShadow: shadow.lg, boxSizing: 'border-box', fontFamily: fonts.body };
const closeButtonStyle: React.CSSProperties = { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.4em', cursor: 'pointer', color: colors.inkSoft };
const titleStyle: React.CSSProperties = { color: colors.primaryDark, fontFamily: fonts.heading, margin: '0 0 10px 0', textAlign: 'center', fontSize: '1.5em' };
const featureBoxStyle: React.CSSProperties = { background: colors.successGradient, borderRadius: '15px', padding: '20px', color: '#fff', marginBottom: '25px', boxShadow: '0 4px 15px rgba(61,201,176,0.3)' };
const purchaseButtonStyle: React.CSSProperties = { background: colors.actionGradient, color: '#fff', border: 'none', borderRadius: '50px', padding: '15px', width: '100%', fontSize: '1.2em', fontWeight: 'bold', cursor: 'pointer', boxShadow: `0 6px 0 ${colors.primaryDark}`, transition: 'transform 0.1s, box-shadow 0.1s' };
const purchasedButtonStyle: React.CSSProperties = { background: '#eee', color: colors.inkSoft, border: 'none', borderRadius: '50px', padding: '15px', width: '100%', fontSize: '1.2em', fontWeight: 'bold', cursor: 'not-allowed', boxShadow: 'none' };
const bundleSectionStyle: React.CSSProperties = { marginTop: '20px', paddingTop: '18px', borderTop: `2px dashed ${colors.lock}` };
const bundleDividerStyle: React.CSSProperties = { margin: '0 0 12px', fontSize: '0.85em', fontWeight: 'bold', color: colors.tertiaryDark, textAlign: 'center' };
const bundleButtonStyle: React.CSSProperties = { background: colors.secondary, color: '#fff', border: 'none', borderRadius: '50px', padding: '12px', width: '100%', fontSize: '0.95em', fontWeight: 'bold', cursor: 'pointer', boxShadow: shadow.sm, marginBottom: '10px' };

export default PaywallModal;

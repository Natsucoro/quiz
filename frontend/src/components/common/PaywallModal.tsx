import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePurchaseStore } from '../../store/purchaseStore';
import { auth } from '../../lib/firebase';
import { getAllAvailableQuizzesCount, getGenreBundleItemIds, getAvailableGenres, getAvailableDifficultiesForGenre, getPaidDifficultiesForGenre, getTotalQuizzesCountForGenre, getTotalQuizzesCount } from '../../services/quizEngine';
import { trackEvent } from '../../services/analytics';
import { isRunningInTwa } from '../../services/platform';
import { purchasePlayProduct, getPlaySingleProductId, getPlayGenreBundleProductId, PLAY_ALL_BUNDLE_PRODUCT_ID } from '../../services/playBilling';
import { colors, fonts, shadow } from '../../styles/theme';

// バックエンド(functions/src/index.ts)の価格設定と一致させること
const SINGLE_PRICE_JPY = 120;
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
  const { isPurchased, isLoggedIn, purchasedItems, allUnlocked, syncWithClaims } = usePurchaseStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const itemId = `${genre}_${difficulty}`;
  const alreadyPurchased = isPurchased(itemId);
  const questionCount = getAllAvailableQuizzesCount(genre, difficulty);

  const genreBundleItemIds = getGenreBundleItemIds(genre);
  const genreBundlePrice = genreBundleItemIds.length * GENRE_BUNDLE_PRICE_PER_LEVEL_JPY;
  const genreAlreadyUnlocked = allUnlocked || genreBundleItemIds.every((id) => purchasedItems.includes(id));
  const genreNormalPrice = genreBundleItemIds.length * SINGLE_PRICE_JPY;
  const genreDiscountPercent = Math.round((1 - genreBundlePrice / genreNormalPrice) * 100);

  const allNormalPrice = getAvailableGenres().reduce(
    (sum, g) => sum + getPaidDifficultiesForGenre(g).length * SINGLE_PRICE_JPY,
    0
  );
  const allDiscountPercent = Math.round((1 - ALL_BUNDLE_PRICE_JPY / allNormalPrice) * 100);

  // 各プランで「遊び放題になる問題数・レベル数」を明示するための集計
  const genreTotalQuestions = getTotalQuizzesCountForGenre(genre);
  const genreLevelCount = getAvailableDifficultiesForGenre(genre).length;
  const allTotalQuestions = getTotalQuizzesCount();

  useEffect(() => {
    trackEvent('view_paywall', { genre, difficulty });
  }, [genre, difficulty]);

  const startCheckout = async (body: Record<string, unknown>) => {
    if (isProcessing) return;

    // 未ログインの場合は購入前にログイン画面を出す
    if (!isLoggedIn || !auth.currentUser) {
      onLoginRequest();
      return;
    }

    const planType = (body.bundleType as 'single' | 'genre' | 'all') ?? 'single';
    const planValue = planType === 'all' ? ALL_BUNDLE_PRICE_JPY : planType === 'genre' ? genreBundlePrice : SINGLE_PRICE_JPY;
    trackEvent('begin_checkout', { plan_type: planType, value: planValue, currency: 'JPY' });

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

  // Androidアプリ(TWA)内では、Google Playの規約によりPlay Billingでの購入が必須のため、
  // Stripeへのリダイレクトではなく Digital Goods API / Payment Request API 経由で購入する
  const startPlayCheckout = async (bundleType: 'single' | 'genre' | 'all', productId: string, planValue: number) => {
    if (isProcessing) return;
    if (!isLoggedIn || !auth.currentUser) {
      onLoginRequest();
      return;
    }
    trackEvent('begin_checkout', { plan_type: bundleType, value: planValue, currency: 'JPY' });
    setIsProcessing(true);
    try {
      const { purchaseToken } = await purchasePlayProduct(productId);
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/verifyPlayPurchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ productId, purchaseToken, bundleType }),
      });
      if (!res.ok) throw new Error(await res.text());

      // サーバー側で検証済みのcustom claimsを取り直してから権利を反映する
      // (クライアントから受け取ったitemIdを直接信用しない)
      const newToken = await auth.currentUser.getIdTokenResult(true);
      if (newToken.claims.purchasedItems || newToken.claims.allUnlocked) {
        syncWithClaims((newToken.claims.purchasedItems as string[]) || [], newToken.claims.allUnlocked as boolean);
      }
      trackEvent('purchase', { transaction_id: purchaseToken, plan_type: bundleType, value: planValue, currency: 'JPY' });
      onClose();
    } catch (error) {
      console.error('Play Billing purchase failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurchase = () => {
    if (alreadyPurchased) return;
    if (isRunningInTwa()) {
      startPlayCheckout('single', getPlaySingleProductId(genre, difficulty), SINGLE_PRICE_JPY);
    } else {
      startCheckout({ bundleType: 'single', itemId, genre, difficulty });
    }
  };

  const handleGenreBundlePurchase = () => {
    if (genreAlreadyUnlocked) return;
    if (isRunningInTwa()) {
      startPlayCheckout('genre', getPlayGenreBundleProductId(genre), genreBundlePrice);
    } else {
      startCheckout({ bundleType: 'genre', genre, itemIds: genreBundleItemIds });
    }
  };

  const handleAllBundlePurchase = () => {
    if (allUnlocked) return;
    if (isRunningInTwa()) {
      startPlayCheckout('all', PLAY_ALL_BUNDLE_PRODUCT_ID, ALL_BUNDLE_PRICE_JPY);
    } else {
      startCheckout({ bundleType: 'all' });
    }
  };

  // position: fixed のオーバーレイが親要素のtransform等の影響で画面全体を覆えなくなる
  // (フッターより下に表示される・縦が窮屈になる)問題を避けるため、document.bodyに直接描画する
  return createPortal(
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={stickyCloseBarStyle}>
          <button
            onClick={() => {
              trackEvent('close_paywall', { genre, difficulty, purchased: alreadyPurchased });
              onClose();
            }}
            style={closeButtonStyle}
          >✖</button>
        </div>
        <h2 style={titleStyle}>🔒 レベル解放</h2>
        <p style={{ textAlign: 'center', margin: '0 0 16px', fontSize: '1em' }}>
          <strong>「{genre} Lv.{difficulty}」</strong>はプレミアムレベルです！
        </p>

        {/* レベル単体（バッジなし・控えめ） */}
        <div style={singleCardStyle}>
          <h3 style={singleCardTitleStyle}>
            「{genre} Lv.{difficulty}」を遊べるように
          </h3>
          <p style={singleCardSubtitleStyle}>
            全 {questionCount.toLocaleString()}問 が遊び放題に
          </p>
          <p style={singleCardPriceStyle}>{SINGLE_PRICE_JPY.toLocaleString()}円</p>
          {alreadyPurchased ? (
            <button style={purchasedButtonStyle} disabled>
              ✅ 購入済みです
            </button>
          ) : (
            <button onClick={handlePurchase} disabled={isProcessing} style={{ ...singleButtonStyle, opacity: isProcessing ? 0.7 : 1 }}>
              {isProcessing ? '準備中…' : 'このレベルだけ購入する'}
            </button>
          )}
        </div>

        {/* ジャンル買い切り */}
        {!genreAlreadyUnlocked && (
          <div style={heroCardStyle}>
            <span style={ribbonStyle}>おすすめ！</span>
            <span style={discountBadgeStyle}>{genreDiscountPercent}%OFF</span>
            <h3 style={{ margin: '4px 0 3px', color: '#fff', fontSize: '1em' }}>
              「{genre}」を全レベル遊び放題に！
            </h3>
            <p style={{ margin: '0 0 8px', fontSize: '0.8em', color: 'rgba(255,255,255,0.9)' }}>
              全 {genreLevelCount} レベル・<strong>全{genreTotalQuestions.toLocaleString()}問</strong>が遊び放題に！
            </p>
            <p style={{ margin: '0 0 8px' }}>
              <span style={strikePriceStyle}>{genreNormalPrice.toLocaleString()}円</span>
              <span style={heroPriceStyle}>{genreBundlePrice.toLocaleString()}円</span>
            </p>
            <button onClick={handleGenreBundlePurchase} disabled={isProcessing} style={{ ...heroButtonStyle, opacity: isProcessing ? 0.7 : 1 }}>
              {isProcessing ? '準備中…' : `🎁 まとめ買いする（${genreBundlePrice.toLocaleString()}円）`}
            </button>
          </div>
        )}

        {/* 全問買い切り */}
        {!allUnlocked && (
          <div style={allCardStyle}>
            <span style={ribbonStyle}>イチオシ！</span>
            <span style={discountBadgeStyle}>{allDiscountPercent}%OFF</span>
            <h3 style={{ margin: '4px 0 3px', color: '#fff', fontSize: '1em' }}>
              全ジャンルを遊び放題に！
            </h3>
            <p style={{ margin: '0 0 8px', fontSize: '0.8em', color: 'rgba(255,255,255,0.9)' }}>
              全16ジャンル・<strong>全{allTotalQuestions.toLocaleString()}問</strong>が遊び放題に！
            </p>
            <p style={{ margin: '0 0 8px' }}>
              <span style={strikePriceStyle}>{allNormalPrice.toLocaleString()}円</span>
              <span style={heroPriceStyle}>{ALL_BUNDLE_PRICE_JPY.toLocaleString()}円</span>
            </p>
            <button onClick={handleAllBundlePurchase} disabled={isProcessing} style={{ ...heroButtonStyle, color: colors.violetDark, opacity: isProcessing ? 0.7 : 1 }}>
              {isProcessing ? '準備中…' : `🎁 まとめ買いする（${ALL_BUNDLE_PRICE_JPY.toLocaleString()}円）`}
            </button>
          </div>
        )}

        <p style={footNoteStyle}>※買い切り。一度購入するとずっと遊べます。</p>
      </div>
    </div>,
    document.body
  );
};

const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(74,68,88,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'fadeIn 0.2s ease-out' };
// モーダル自体を画面いっぱいに近い高さで表示し、収まらない分だけ内部でスクロールできるようにする
const modalStyle: React.CSSProperties = { position: 'relative', width: '90%', maxWidth: '400px', maxHeight: '95vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', backgroundColor: '#fff', borderRadius: '24px', padding: '26px 24px', boxShadow: shadow.lg, boxSizing: 'border-box', fontFamily: fonts.body, animation: 'screenIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' } as React.CSSProperties;
// スクロールしても閉じるボタンが見えなくならないよう、sticky にする
const stickyCloseBarStyle: React.CSSProperties = { position: 'sticky', top: 0, height: 0, textAlign: 'right', zIndex: 10 };
const closeButtonStyle: React.CSSProperties = { position: 'relative', top: '2px', right: '-2px', background: colors.surfaceSoft, border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1.1em', cursor: 'pointer', color: colors.inkSoft, boxShadow: shadow.sm };
const titleStyle: React.CSSProperties = { color: colors.primaryDark, fontFamily: fonts.heading, margin: '0 0 8px 0', textAlign: 'center', fontSize: '1.35em' };
const purchasedButtonStyle: React.CSSProperties = { background: '#eee', color: colors.inkSoft, border: 'none', borderRadius: '50px', padding: '13px', width: '100%', fontSize: '1.1em', fontWeight: 'bold', cursor: 'not-allowed', boxShadow: 'none' };
const singleButtonStyle: React.CSSProperties = { background: '#fff', color: colors.inkSoft, border: `2px solid ${colors.lock}`, borderRadius: '50px', padding: '12px', width: '100%', fontSize: '0.95em', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'none' };
const footNoteStyle: React.CSSProperties = { margin: '16px 0 0', fontSize: '0.75em', color: colors.inkSoft, textAlign: 'center' };

// レベル単体プラン: まとめ買いと同じカード構成にしつつ、あえて控えめな配色にする
// (割引もなく50問だけなので、目立たせすぎない)
const singleCardStyle: React.CSSProperties = {
  position: 'relative',
  background: colors.surfaceSoft,
  border: `2px solid #EDEAF2`,
  borderRadius: '20px',
  padding: '20px',
  marginBottom: '22px',
  textAlign: 'center',
  boxShadow: shadow.sm,
};
const singleCardTitleStyle: React.CSSProperties = { margin: '0 0 6px', color: colors.ink, fontSize: '1em', fontWeight: 'bold' };
const singleCardSubtitleStyle: React.CSSProperties = { margin: '0 0 10px', fontSize: '0.85em', color: colors.inkSoft };
const singleCardPriceStyle: React.CSSProperties = { margin: '0 0 12px', fontSize: '1.25em', fontWeight: 'bold', color: colors.ink };

// 「イチオシ」まとめ買いカード関連
const heroCardStyle: React.CSSProperties = {
  position: 'relative',
  background: colors.actionGradient,
  borderRadius: '20px',
  padding: '24px 20px 20px',
  marginBottom: '26px',
  textAlign: 'center',
  boxShadow: `0 8px 22px rgba(226,82,122,0.35), 0 0 0 3px ${colors.tertiary}`,
};
const ribbonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '-12px',
  left: '16px',
  background: colors.violet,
  color: '#fff',
  fontSize: '0.75em',
  fontWeight: 'bold',
  padding: '5px 14px',
  borderRadius: '50px',
  boxShadow: shadow.sm,
};
const discountBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: '-14px',
  right: '10px',
  background: colors.danger,
  color: '#fff',
  fontSize: '0.95em',
  fontWeight: 'bold',
  padding: '8px 14px',
  borderRadius: '50px',
  boxShadow: `0 4px 10px rgba(255,107,107,0.5), 0 0 0 3px #fff`,
  transform: 'rotate(8deg)',
  whiteSpace: 'nowrap',
};
const strikePriceStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.75)',
  textDecoration: 'line-through',
  fontSize: '0.95em',
  marginRight: '8px',
};
const heroPriceStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: '1.6em',
  fontWeight: 'bold',
};
const heroButtonStyle: React.CSSProperties = { background: '#fff', color: colors.primaryDark, border: 'none', borderRadius: '50px', padding: '14px', width: '100%', fontSize: '1.05em', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' };
const allCardStyle: React.CSSProperties = {
  position: 'relative',
  background: `linear-gradient(135deg, ${colors.violet} 0%, ${colors.violetDark} 100%)`,
  borderRadius: '20px',
  padding: '24px 20px 20px',
  marginBottom: '6px',
  textAlign: 'center',
  boxShadow: `0 8px 22px rgba(123,104,214,0.35)`,
};

export default PaywallModal;

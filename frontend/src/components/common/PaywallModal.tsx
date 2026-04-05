import React from 'react';
import { usePurchaseStore } from '../../store/purchaseStore';

interface PaywallModalProps {
  genre: string;
  difficulty: number;
  onClose: () => void;
  onTestPurchase: () => void; // Stripe連携までのテスト・モック用
  onLoginRequest: () => void;
}

const PaywallModal: React.FC<PaywallModalProps> = ({ genre, difficulty, onClose, onTestPurchase, onLoginRequest }) => {
  const { isPurchased, isLoggedIn } = usePurchaseStore();
  const itemId = `${genre}_${difficulty}`;
  const alreadyPurchased = isPurchased(itemId);

  // Stripe Payment Link のテスト用URL（環境変数等から取得する想定）
  const getStripeLink = () => {
    // 実際にStripe Dashboardで「動物 Lv.3」等の商品とPayment Linkを作って設定します。
    // その際リダイレクトURLに "?success=true&genre=xx&level=yy" を仕込みます。
    // Vite環境変数の型エラー回避のため (import.meta as any).env を使用
    return (import.meta as any).env.VITE_STRIPE_PAYMENT_LINK || '#'; 
  };

  const handlePurchase = () => {
    if (alreadyPurchased) return;
    
    // 未ログインの場合は購入前にログイン画面を出す
    if (!isLoggedIn) {
      onLoginRequest();
      return;
    }

    const link = getStripeLink();
    if (link && link !== '#') {
      // payment linkがあればそこに飛ばす
      window.location.href = link;
    } else {
      // なければテストモック処理にfallback
      onTestPurchase();
    }
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
            <li>問題がさらに <strong>50問追加！</strong> (計60問)</li>
            <li><strong>未回答優先</strong> の機能がオンになります</li>
            <li>一度購入すればずっと遊べます！</li>
          </ul>
        </div>
        
        {alreadyPurchased ? (
          <button style={purchasedButtonStyle} disabled>
            ✅ 購入済みです
          </button>
        ) : (
          <button onClick={handlePurchase} style={purchaseButtonStyle}>
             💴 120円 で解放する
          </button>
        )}

        <p style={{ marginTop: '14px', fontSize: '0.75em', color: '#aaa', textAlign: 'center' }}>
          ※買い切り。一度購入するとずっと遊べます。
        </p>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { position: 'relative', width: '90%', maxWidth: '400px', backgroundColor: '#fff', borderRadius: '24px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', boxSizing: 'border-box' };
const closeButtonStyle: React.CSSProperties = { position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.4em', cursor: 'pointer', color: '#bbb' };
const titleStyle: React.CSSProperties = { color: '#d63384', margin: '0 0 10px 0', textAlign: 'center', fontSize: '1.5em' };
const featureBoxStyle: React.CSSProperties = { background: 'linear-gradient(135deg, #1DD1A1, #54A0FF)', borderRadius: '15px', padding: '20px', color: '#fff', marginBottom: '25px', boxShadow: '0 4px 15px rgba(29, 209, 161, 0.3)' };
const purchaseButtonStyle: React.CSSProperties = { background: 'linear-gradient(135deg, #FF6EC7, #FF9A3C)', color: '#fff', border: 'none', borderRadius: '50px', padding: '15px', width: '100%', fontSize: '1.2em', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 6px 0 #D94F9A', transition: 'transform 0.1s, box-shadow 0.1s' };
const purchasedButtonStyle: React.CSSProperties = { background: '#eee', color: '#888', border: 'none', borderRadius: '50px', padding: '15px', width: '100%', fontSize: '1.2em', fontWeight: 'bold', cursor: 'not-allowed', boxShadow: 'none' };

export default PaywallModal;

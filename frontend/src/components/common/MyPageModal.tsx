import React from 'react';
import { usePurchaseStore } from '../../store/purchaseStore';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';

interface MyPageModalProps {
  onClose: () => void;
}

const MyPageModal: React.FC<MyPageModalProps> = ({ onClose }) => {
  const { purchasedItems, clearPurchases } = usePurchaseStore();
  const user = auth.currentUser;

  const handleLogout = async () => {
    if (window.confirm('ログアウトしますか？')) {
      try {
        await signOut(auth);
        clearPurchases(); // フロントの購入状態をクリア
        onClose();
        alert('ログアウトしました');
      } catch (e) {
        console.error(e);
        alert('ログアウトに失敗しました');
      }
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={contentStyle}>
        <h2 style={titleStyle}>👤 マイページ</h2>
        
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>アカウント情報</h3>
          {user ? (
            <p style={textStyle}>ID: {user.uid.slice(0, 8)}...</p>
          ) : (
            <p style={textStyle}>ログインしていません</p>
          )}
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>🔓 購入済みアイテム</h3>
          {purchasedItems.length > 0 ? (
            <ul style={listStyle}>
              {purchasedItems.map(item => (
                <li key={item} style={listItemStyle}>
                  {item.replace('_', ' Lv.')}
                </li>
              ))}
            </ul>
          ) : (
            <p style={textStyle}>購入したアイテムはありません</p>
          )}
        </div>

        <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {user && (
            <button onClick={handleLogout} style={logoutButtonStyle}>
              ログアウト
            </button>
          )}
          <button onClick={onClose} style={closeButtonStyle}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

// Styles
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};
const contentStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '25px',
  borderRadius: '15px',
  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
  maxWidth: '400px',
  width: '90%',
  textAlign: 'center',
  fontFamily: "'Yomogi', cursive",
};
const titleStyle: React.CSSProperties = { color: '#FF6EC7', marginBottom: '20px', fontSize: '1.8em' };
const sectionStyle: React.CSSProperties = { marginBottom: '20px', textAlign: 'left', background: '#f8f9fa', padding: '15px', borderRadius: '10px' };
const sectionTitleStyle: React.CSSProperties = { fontSize: '1.2em', margin: '0 0 10px 0', color: '#333' };
const textStyle: React.CSSProperties = { margin: 0, color: '#666' };
const listStyle: React.CSSProperties = { margin: 0, paddingLeft: '20px', color: '#333', textAlign: 'left' };
const listItemStyle: React.CSSProperties = { marginBottom: '5px' };
const logoutButtonStyle: React.CSSProperties = {
  backgroundColor: '#fff', color: '#ff4d4f', border: '2px solid #ff4d4f',
  padding: '12px 20px', borderRadius: '10px', fontSize: '1em', fontWeight: 'bold', cursor: 'pointer',
};
const closeButtonStyle: React.CSSProperties = {
  backgroundColor: '#ccc', color: '#555', border: 'none',
  padding: '12px 20px', borderRadius: '10px', fontSize: '1em', fontWeight: 'bold', cursor: 'pointer',
  boxShadow: '0 4px #999',
};

export default MyPageModal;

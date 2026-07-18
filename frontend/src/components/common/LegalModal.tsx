// src/components/common/LegalModal.tsx

import React, { useState } from 'react';

type Tab = 'tokushoho' | 'privacy' | 'terms';

interface LegalModalProps {
  onClose: () => void;
  initialTab?: Tab;
}

const LegalModal: React.FC<LegalModalProps> = ({ onClose, initialTab = 'tokushoho' }) => {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  return (
    <div style={overlayStyle}>
      <div style={contentStyle}>
        <button onClick={onClose} style={closeButtonStyle}>✖</button>

        {/* タブ */}
        <div style={tabBarStyle}>
          <button
            onClick={() => setActiveTab('tokushoho')}
            style={{ ...tabButtonStyle, ...(activeTab === 'tokushoho' ? activeTabStyle : {}) }}
          >
            特定商取引法
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            style={{ ...tabButtonStyle, ...(activeTab === 'privacy' ? activeTabStyle : {}) }}
          >
            プライバシー
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            style={{ ...tabButtonStyle, ...(activeTab === 'terms' ? activeTabStyle : {}) }}
          >
            利用規約
          </button>
        </div>

        <div style={bodyStyle}>
          {activeTab === 'tokushoho' && <Tokushoho />}
          {activeTab === 'privacy' && <Privacy />}
          {activeTab === 'terms' && <Terms />}
        </div>

        <button onClick={onClose} style={closeButtonBottomStyle}>閉じる</button>
      </div>
    </div>
  );
};

const Tokushoho: React.FC = () => (
  <div>
    <h2 style={sectionTitleStyle}>特定商取引法に基づく表記</h2>
    <table style={tableStyle}>
      <tbody>
        <Row label="販売業者" value="わたしはダレでしょう？クイズ　サポートチーム" />
        <Row label="所在地" value="請求があった場合は遅滞なく開示します" />
        <Row label="電話番号" value="請求があった場合は遅滞なく開示します" />
        <Row label="メールアドレス" value="watashihadare.quiz@gmail.com" />
        <Row label="販売価格" value={(
          <>
            ・レベル単体解放：120円（税込）<br />
            ・ジャンルまとめ買い（有料レベル6段階分）：330円（税込）<br />
            ・全ジャンル・全レベル解放：1,480円（税込）
          </>
        )} />
        <Row label="商品の性質" value="デジタルコンテンツ（追加クイズ問題・難易度解放）" />
        <Row label="代金の支払い方法" value="クレジットカード決済（Stripe）" />
        <Row label="商品の引渡し時期" value="決済完了後、即時にご利用いただけます" />
        <Row label="返品・キャンセルについて" value="デジタルコンテンツの性質上、購入完了後の返品・キャンセルはお受けできません。ご了承ください。" />
        <Row label="動作環境" value="インターネット接続可能なスマートフォン・PC（最新ブラウザ推奨）" />
      </tbody>
    </table>
  </div>
);

const Privacy: React.FC = () => (
  <div>
    <h2 style={sectionTitleStyle}>プライバシーポリシー</h2>
    <p style={textStyle}>
      「わたしはダレでしょう？クイズ集！」（以下、「本サービス」）は、ユーザーのプライバシーを尊重し、
      個人情報の保護に努めます。
    </p>
    <h3 style={subTitleStyle}>収集する情報</h3>
    <p style={textStyle}>
      本サービスでは、以下の情報を収集する場合があります。
    </p>
    <ul style={listStyle}>
      <li>メールアドレス（ログイン・購入に使用）</li>
      <li>購入履歴（Firebase 認証トークンに保存）</li>
      <li>プレイ履歴（端末のローカルストレージに保存）</li>
    </ul>
    <h3 style={subTitleStyle}>情報の利用目的</h3>
    <ul style={listStyle}>
      <li>サービスの提供・改善</li>
      <li>購入済みコンテンツの管理</li>
      <li>お問い合わせへの対応</li>
    </ul>
    <h3 style={subTitleStyle}>第三者への提供</h3>
    <p style={textStyle}>
      法令に基づく場合を除き、収集した個人情報を第三者に提供することはありません。
    </p>
    <h3 style={subTitleStyle}>利用するサービス</h3>
    <ul style={listStyle}>
      <li>Firebase（Google LLC）：認証・データ管理</li>
      <li>Stripe：決済処理</li>
      <li>Google Analytics：利用状況の分析</li>
    </ul>
    <h3 style={subTitleStyle}>お問い合わせ</h3>
    <p style={textStyle}>
      個人情報に関するお問い合わせは{' '}
      <a href="mailto:watashihadare.quiz@gmail.com" style={linkStyle}>
        watashihadare.quiz@gmail.com
      </a>{' '}
      までご連絡ください。
    </p>
  </div>
);

const Terms: React.FC = () => (
  <div>
    <h2 style={sectionTitleStyle}>利用規約</h2>
    <h3 style={subTitleStyle}>第1条（サービスの利用）</h3>
    <p style={textStyle}>
      本サービスは、個人・非商業目的の利用に限り、無料部分を無償でご利用いただけます。
      有料コンテンツは購入後にご利用いただけます。
    </p>
    <h3 style={subTitleStyle}>第2条（禁止事項）</h3>
    <ul style={listStyle}>
      <li>本サービスのコンテンツの無断転載・複製</li>
      <li>不正アクセス・システムへの負荷をかける行為</li>
      <li>他のユーザーや運営者への迷惑行為</li>
      <li>法令または公序良俗に反する行為</li>
    </ul>
    <h3 style={subTitleStyle}>第3条（免責事項）</h3>
    <p style={textStyle}>
      本サービスの利用によって生じた損害について、当方は一切の責任を負いません。
      クイズ内容は正確性を期して作成していますが、情報の完全性・正確性を保証するものではありません。
    </p>
    <h3 style={subTitleStyle}>第4条（サービスの変更・終了）</h3>
    <p style={textStyle}>
      当方は、予告なく本サービスの内容を変更・終了する場合があります。
      サービス終了の場合、購入済みコンテンツへのアクセスができなくなる可能性があります。
    </p>
    <h3 style={subTitleStyle}>第5条（準拠法）</h3>
    <p style={textStyle}>本利用規約は日本法に準拠します。</p>
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <tr>
    <td style={labelCellStyle}>{label}</td>
    <td style={valueCellStyle}>{value}</td>
  </tr>
);

// Styles
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.65)',
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  zIndex: 1200,
};
const contentStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '20px',
  maxWidth: '520px',
  width: '95%',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: "'Yomogi', cursive",
  overflow: 'hidden',
  boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
};
const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '12px', right: '16px',
  background: 'none', border: 'none',
  fontSize: '1.3em', color: '#aaa', cursor: 'pointer', zIndex: 1,
};
const tabBarStyle: React.CSSProperties = {
  display: 'flex', borderBottom: '2px solid #f0f0f0',
  padding: '12px 16px 0',
  gap: '6px',
  flexShrink: 0,
};
const tabButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: 'none', borderRadius: '12px 12px 0 0',
  background: '#f5f5f5',
  color: '#888', fontWeight: 'bold', cursor: 'pointer',
  fontSize: '0.8em',
};
const activeTabStyle: React.CSSProperties = {
  background: '#FF6EC7', color: '#fff',
};
const bodyStyle: React.CSSProperties = {
  overflowY: 'auto',
  padding: '20px',
  flex: 1,
};
const closeButtonBottomStyle: React.CSSProperties = {
  margin: '12px 16px 16px',
  padding: '12px',
  background: 'linear-gradient(135deg, #FF6EC7, #FF9A3C)',
  color: '#fff', border: 'none',
  borderRadius: '50px', cursor: 'pointer',
  fontWeight: 'bold', fontSize: '1em',
  boxShadow: '0 4px 0 #D94F9A',
  flexShrink: 0,
};
const sectionTitleStyle: React.CSSProperties = {
  color: '#FF5FA0', fontSize: '1.2em', marginBottom: '16px',
};
const subTitleStyle: React.CSSProperties = {
  color: '#444', fontSize: '1em', margin: '16px 0 8px',
  borderLeft: '3px solid #FF6EC7', paddingLeft: '8px',
};
const textStyle: React.CSSProperties = {
  fontSize: '0.9em', color: '#555', lineHeight: '1.7', margin: '0 0 8px',
};
const listStyle: React.CSSProperties = {
  fontSize: '0.9em', color: '#555', lineHeight: '1.8',
  paddingLeft: '20px', margin: '0 0 8px',
};
const linkStyle: React.CSSProperties = { color: '#54A0FF' };
const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '0.85em',
};
const labelCellStyle: React.CSSProperties = {
  padding: '10px 12px', fontWeight: 'bold', color: '#FF5FA0',
  backgroundColor: '#FFF0F8', border: '1px solid #FFE0EE',
  verticalAlign: 'top', width: '35%',
};
const valueCellStyle: React.CSSProperties = {
  padding: '10px 12px', color: '#444',
  border: '1px solid #FFE0EE', verticalAlign: 'top',
};

export default LegalModal;

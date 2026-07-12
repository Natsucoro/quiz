// アプリ全体で使う共通デザイントークン。
// 各コンポーネントで色や余白をバラバラに直書きせず、ここを参照することで
// 「なんとなくAI生成っぽい」統一感のない配色・余白を防ぐ。

export const colors = {
  // ブランドカラー（メインアクション・見出し）
  primary: '#FF6F91',
  primaryDark: '#E2527A',
  // アクセント（サブアクション・バリエーション用）
  secondary: '#3DC9B0',
  secondaryDark: '#2CA792',
  tertiary: '#FFB454',
  tertiaryDark: '#E89A38',
  violet: '#9B87F0',
  violetDark: '#7C68D6',

  // ニュートラル
  ink: '#4A4458',
  inkSoft: '#8B8598',
  surface: '#FFFFFF',
  surfaceSoft: 'rgba(255,255,255,0.92)',

  // セマンティック
  success: '#3DC9B0',
  successDark: '#2CA792',
  danger: '#FF6B6B',
  dangerDark: '#E14F4F',
  lock: '#B0AAC0',
  warning: '#FFC857',

  // 背景グラデーション（彩度を抑えたクリーム系）
  bgGradient: 'linear-gradient(160deg, #FFF3EA 0%, #FFE9F0 55%, #FDE8D8 100%)',
  // メインアクションのグラデーション
  actionGradient: 'linear-gradient(135deg, #FF6F91 0%, #FFB454 100%)',
  headerGradient: 'linear-gradient(90deg, #FF6F91 0%, #FFB454 100%)',
  successGradient: 'linear-gradient(135deg, #3DC9B0 0%, #2CA792 100%)',
  dangerGradient: 'linear-gradient(135deg, #FF6B6B 0%, #E2527A 100%)',
  footerGradient: 'linear-gradient(to bottom, #BFE8D4 0%, #8FD1AE 100%)',
};

// ジャンルごとの識別色。彩度の高い「量産デモ配色」(#FF6B6B/#51CF66/#339AF0 等)を避け、
// 同系統でまとめたトーンから選ぶことで一覧の統一感を保つ。
export const genreColors: Record<string, string> = {
  '哺乳類': '#FF6F91',
  '昆虫': '#4CAF7D',
  '植物': '#3DC9B0',
  '魚類': '#3AA9C9',
  '鳥類': '#FFB454',
  '爬虫類': '#8BBF4E',
  '海洋生物': '#5B8FE0',
  '乗り物': '#4E8FE0',
  '道具': '#F0A93E',
  '歴史上の人物': '#9B87F0',
  '日本の地理': '#FF8A5C',
  '世界の地理': '#3AA9C9',
  '食べ物': '#E85D8C',
  'AI・ロボット': '#4FB4E0',
};

// 難易度ボタン・選択肢ボタンの持ち回り配色(同系統4色をローテーション)
export const rotatingColors = ['#FF6F91', '#4E8FE0', '#FFB454', '#3DC9B0', '#9B87F0'];

export const radius = {
  sm: '12px',
  md: '20px',
  lg: '28px',
  pill: '50px',
};

export const shadow = {
  sm: '0 3px 8px rgba(74,68,88,0.12)',
  md: '0 6px 20px rgba(74,68,88,0.14)',
  lg: '0 8px 28px rgba(74,68,88,0.16)',
};

// タイポグラフィ: 見出し・特別な演出は手書き風のYomogi、
// 本文・ボタン・数値表示は視認性の高い丸ゴシック(M PLUS Rounded 1c)に分離する。
export const fonts = {
  heading: "'Yomogi', cursive",
  body: "'M PLUS Rounded 1c', 'Yomogi', sans-serif",
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};

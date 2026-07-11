import React from 'react';

// 指定されたアイコンのリスト
const animalFiles = [
  'ashika.svg',
  'batta.svg',
  'hebi.svg',
  'uma.svg',
  'texirano.svg',
  'car_3.svg',
  'kirin.svg',
  'texirano_2.svg',
  'zou.svg'
];

const svgModules = import.meta.glob<{ default: string }>('../../assets/icons/*.svg', { eager: true });

// 存在するアイコンのURLを取得
const animalUrls = animalFiles.map(file => {
  const path = `../../assets/icons/${file}`;
  return svgModules[path]?.default || null;
}).filter(Boolean) as string[];

interface WalkingAnimalsProps {
  /** 1体あたりのアイコンサイズ(px)。デフォルト60px。 */
  size?: number;
  /** コンテナのposition/zIndex等を上書きするためのスタイル。 */
  style?: React.CSSProperties;
  /** 横に並べる際の間隔(px)。デフォルト30px。 */
  gap?: number;
}

const BOUNCE_HEIGHT = 4; // bounce-walkでキャラクターが上に動く最大距離(px)

const WalkingAnimals: React.FC<WalkingAnimalsProps> = ({ size = 60, style, gap = 30 }) => {
  if (animalUrls.length === 0) return null;

  // ループ用にリストを2回繰り返す
  const displayUrls = [...animalUrls, ...animalUrls];

  const keyframes = `
    @keyframes walk-across {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    @keyframes bounce-walk {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      25% { transform: translateY(-${BOUNCE_HEIGHT}px) rotate(-3deg); }
      50% { transform: translateY(0) rotate(0deg); }
      75% { transform: translateY(-${BOUNCE_HEIGHT / 2}px) rotate(3deg); }
    }
  `;

  return (
    <div style={{ ...containerStyle, ...style }}>
      <style>{keyframes}</style>
      <div style={trackStyle}>
        {displayUrls.map((url, index) => (
          <div key={index} style={{ ...itemStyle, width: `${size}px`, height: `${size}px`, marginRight: `${gap}px` }}>
            <img src={url} alt="walking animal" style={imageStyle} />
          </div>
        ))}
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  width: '100%',
  overflow: 'hidden',
  position: 'absolute',
  bottom: '100%', // フッターの真上に配置するため
  left: 0,
  zIndex: 11, // フッターより上に
  pointerEvents: 'none',
  paddingTop: `${BOUNCE_HEIGHT + 4}px`, // bounce-walkでキャラクターが上に動く分の余白（見切れ防止）
  paddingBottom: '5px',
};

const trackStyle: React.CSSProperties = {
  display: 'flex',
  width: 'max-content',
  animation: 'walk-across 30s linear infinite',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end',
  animation: 'bounce-walk 1.5s ease-in-out infinite',
};

const imageStyle: React.CSSProperties = {
  maxHeight: '100%',
  maxWidth: '100%',
  objectFit: 'contain',
};

export default WalkingAnimals;

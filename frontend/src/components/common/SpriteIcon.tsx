import React from 'react';

type Position = 'tl' | 'tr' | 'bl' | 'br';

interface SpriteIconProps {
  src: string;
  position?: Position;
  size?: number | string;
  className?: string;
  alt?: string;
}

/**
 * 2x2のグリッド形式のSVGから特定のアイコンを切り出して表示するコンポーネント
 * position指定がない場合は全体を表示
 */
export const SpriteIcon: React.FC<SpriteIconProps> = ({ 
  src, 
  position, 
  size = 24, 
  className = '', 
  alt = '' 
}) => {
  if (!position) {
    return <img src={src} style={{ width: size, height: size }} className={className} alt={alt} />;
  }

  const sizeNum = typeof size === 'number' ? size : parseInt(size) || 24;

  // 1/4の領域を表示するためのスタイル
  const containerStyle: React.CSSProperties = {
    width: sizeNum,
    height: sizeNum,
    overflow: 'hidden',
    display: 'inline-block',
    position: 'relative',
    flexShrink: 0,
  };

  // 元の画像を2倍のサイズ（px）にして、表示位置をずらす
  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    width: `${sizeNum * 2}px`,
    height: `${sizeNum * 2}px`,
    maxWidth: 'none',
    display: 'block',
    left: (position === 'tr' || position === 'br') ? `-${sizeNum}px` : '0',
    top: (position === 'bl' || position === 'br') ? `-${sizeNum}px` : '0',
  };

  return (
    <div style={containerStyle} className={className}>
      <img src={src} style={imgStyle} alt={alt} />
    </div>
  );
};

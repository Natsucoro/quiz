import React from 'react';

type Position = 'tl' | 'tr' | 'bl' | 'br';

interface SpriteIconProps {
  src: string;
  position?: Position;
  size?: number | string;
  className?: string;
  alt?: string;
  /** Natural pixel width of the source image (required for non-square sprites) */
  srcWidth?: number;
  /** Natural pixel height of the source image (required for non-square sprites) */
  srcHeight?: number;
}

/**
 * 2x2のグリッド形式の画像から特定のアイコンを切り出して表示するコンポーネント
 * position指定がない場合は全体を表示
 * srcWidth/srcHeight を指定することで非正方形の画像も正確にクロップできる
 */
export const SpriteIcon: React.FC<SpriteIconProps> = ({
  src,
  position,
  size = 24,
  className = '',
  alt = '',
  srcWidth,
  srcHeight,
}) => {
  const sizeNum = typeof size === 'number' ? size : parseInt(size as string) || 24;

  if (!position) {
    return <img src={src} style={{ width: sizeNum, height: sizeNum, objectFit: 'contain' }} className={className} alt={alt} />;
  }

  // Use background-image approach for pixel-perfect cropping of non-square sprites
  if (srcWidth && srcHeight) {
    const quadW = srcWidth / 2;
    const quadH = srcHeight / 2;
    const scaleX = sizeNum / quadW;
    const scaleY = sizeNum / quadH;
    const bgW = srcWidth * scaleX;
    const bgH = srcHeight * scaleY;
    const offsetX = (position === 'tr' || position === 'br') ? -sizeNum : 0;
    const offsetY = (position === 'bl' || position === 'br') ? -sizeNum : 0;

    return (
      <div
        className={className}
        role="img"
        aria-label={alt}
        style={{
          width: sizeNum,
          height: sizeNum,
          backgroundImage: `url(${src})`,
          backgroundSize: `${bgW}px ${bgH}px`,
          backgroundPosition: `${offsetX}px ${offsetY}px`,
          backgroundRepeat: 'no-repeat',
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
    );
  }

  // Fallback: legacy overflow+positioning method (for square sprites)
  const containerStyle: React.CSSProperties = {
    width: sizeNum,
    height: sizeNum,
    overflow: 'hidden',
    display: 'inline-block',
    position: 'relative',
    flexShrink: 0,
  };

  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    width: `${sizeNum * 2}px`,
    height: `${sizeNum * 2}px`,
    maxWidth: 'none',
    display: 'block',
    objectFit: 'fill',
    left: (position === 'tr' || position === 'br') ? `-${sizeNum}px` : '0',
    top: (position === 'bl' || position === 'br') ? `-${sizeNum}px` : '0',
  };

  return (
    <div style={containerStyle} className={className}>
      <img src={src} style={imgStyle} alt={alt} />
    </div>
  );
};

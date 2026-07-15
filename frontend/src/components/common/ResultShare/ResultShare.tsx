import React, { useState } from 'react';
import { colors, fonts } from '../../../styles/theme';
import { trackEvent } from '../../../services/analytics';
import {
  buildShareText, xShareUrl, lineShareUrl, nativeShare, copyShareText,
  type ShareParams,
} from '../../../services/shareResult';

// 結果画面のシェア導線。スマホでは「📣 結果をシェア」でネイティブ共有シート
// (LINE/X等・可能なら結果カード画像付き)を開く。非対応環境や個別に選びたい
// 人向けに X / LINE / コピー のボタンも用意する。
const ResultShare: React.FC<ShareParams> = (params) => {
  const [copied, setCopied] = useState(false);

  const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  const handleNative = async () => {
    const outcome = await nativeShare(params);
    if (outcome === 'unsupported') {
      // PC等でネイティブ共有が無い場合はXの投稿画面にフォールバック。
      trackEvent('result_share', { method: 'x', mode: params.mode });
      openExternal(xShareUrl(buildShareText(params)));
      return;
    }
    if (outcome === 'shared') {
      trackEvent('result_share', { method: 'native', mode: params.mode });
    }
  };

  const handleX = () => {
    trackEvent('result_share', { method: 'x', mode: params.mode });
    openExternal(xShareUrl(buildShareText(params)));
  };

  const handleLine = () => {
    trackEvent('result_share', { method: 'line', mode: params.mode });
    openExternal(lineShareUrl());
  };

  const handleCopy = async () => {
    const ok = await copyShareText(params);
    if (ok) {
      trackEvent('result_share', { method: 'copy', mode: params.mode });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div style={sectionStyle}>
      <p style={promptStyle}>けっかをシェアしよう！</p>
      <button style={primaryStyle} onClick={handleNative}>📣 結果をシェア</button>
      <div style={rowStyle}>
        <button style={{ ...miniBtnStyle, background: '#000' }} onClick={handleX}>𝕏 でシェア</button>
        <button style={{ ...miniBtnStyle, background: '#06C755' }} onClick={handleLine}>LINE</button>
        <button style={{ ...miniBtnStyle, background: colors.violet }} onClick={handleCopy}>
          {copied ? '✓ コピー済' : '🔗 コピー'}
        </button>
      </div>
    </div>
  );
};

const sectionStyle: React.CSSProperties = {
  marginTop: '4px',
  padding: '18px 16px',
  background: 'linear-gradient(135deg, #FFF6FB 0%, #FBF3FF 100%)',
  borderRadius: '20px',
  border: `2px dashed ${colors.primary}`,
  textAlign: 'center',
};

const promptStyle: React.CSSProperties = {
  margin: '0 0 12px', color: colors.primaryDark,
  fontFamily: fonts.heading, fontWeight: 'bold', fontSize: '1.05em',
};

const primaryStyle: React.CSSProperties = {
  display: 'block', width: '100%',
  background: colors.actionGradient, color: '#fff', border: 'none',
  borderRadius: '50px', padding: '14px', fontSize: '1.08em', fontWeight: 'bold',
  fontFamily: fonts.heading, cursor: 'pointer', boxShadow: `0 5px 0 ${colors.primaryDark}`,
};

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
  gap: '8px', marginTop: '12px',
};

const miniBtnStyle: React.CSSProperties = {
  color: '#fff', border: 'none', borderRadius: '50px',
  padding: '9px 16px', fontSize: '0.85em', fontWeight: 'bold',
  fontFamily: fonts.body, cursor: 'pointer', whiteSpace: 'nowrap',
  boxShadow: '0 3px 8px rgba(74,68,88,0.2)',
};

export default ResultShare;

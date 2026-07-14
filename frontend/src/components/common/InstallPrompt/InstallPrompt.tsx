import React, { useEffect, useRef, useState } from 'react';
import { colors, fonts } from '../../../styles/theme';
import { trackEvent } from '../../../services/analytics';

// 「ホーム画面に追加(PWAインストール)」をやさしく誘導するバナー。
// - Android/PCのChrome系: beforeinstallprompt を捕まえて自前ボタンから prompt() を呼ぶ。
// - iOS Safari: beforeinstallprompt が発火しないため、共有ボタンからの手動手順を案内する。
// 一度閉じられたら一定期間は再表示せず、しつこくならないようにする。

// beforeinstallprompt は標準のTS libに型が無いため最小限の型だけ定義する。
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa_prompt_dismissed_at';
// 「あとで」を押されたら14日間は再表示しない。
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
// 起動直後に出すと唐突なので、少し遊んでから出す。
const SHOW_DELAY_MS = 4000;

const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

// iOSのChrome/Firefox(crios/fxios)は「ホーム画面に追加」ができないためSafariのみ対象にする。
const isIosSafari = (): boolean =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
  !/crios|fxios/i.test(window.navigator.userAgent);

const recentlyDismissed = (): boolean => {
  const ts = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
  return ts > 0 && Date.now() - ts < DISMISS_COOLDOWN_MS;
};

const InstallPrompt: React.FC = () => {
  const [mode, setMode] = useState<'native' | 'ios' | null>(null);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      // ブラウザ既定のミニバナーを抑止し、アプリの世界観に合った自前UIで誘導する。
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setMode('native');
      trackEvent('pwa_prompt_shown', { mode: 'native' });
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onInstalled = () => {
      setMode(null);
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    };
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari 向けの手動案内(少し待ってから)。
    let iosTimer: number | undefined;
    if (isIosSafari()) {
      iosTimer = window.setTimeout(() => {
        if (!isStandalone() && !recentlyDismissed()) {
          setMode('ios');
          trackEvent('pwa_prompt_shown', { mode: 'ios' });
        }
      }, SHOW_DELAY_MS);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  const handleDismiss = () => {
    if (mode) trackEvent('pwa_prompt_dismissed', { mode });
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setMode(null);
  };

  const handleInstall = async () => {
    const deferred = deferredRef.current;
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    trackEvent('pwa_install_result', { outcome: choice.outcome });
    // 「あとで」を選ばれた場合もクールダウンを効かせる。
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    deferredRef.current = null;
    setMode(null);
  };

  if (!mode) return null;

  return (
    <div style={overlayStyle} role="dialog" aria-label="ホーム画面に追加">
      <div style={cardStyle}>
        <button style={closeStyle} onClick={handleDismiss} aria-label="閉じる">×</button>
        <div style={iconStyle}>📲</div>
        {mode === 'native' ? (
          <>
            <p style={titleStyle}>ホーム画面に追加しよう！</p>
            <p style={bodyStyle}>
              アプリみたいにワンタップで開けて、オフラインでも遊べるよ。
            </p>
            <button style={installBtnStyle} onClick={handleInstall}>
              ホーム画面に追加する
            </button>
            <button style={laterStyle} onClick={handleDismiss}>あとでにする</button>
          </>
        ) : (
          <>
            <p style={titleStyle}>ホーム画面に追加しよう！</p>
            <p style={bodyStyle}>
              画面下の共有ボタン <span style={iosIconStyle}>⬆️</span> をタップして、
              <br />
              「ホーム画面に追加」を選ぶと、アプリみたいに遊べるよ。
            </p>
            <button style={installBtnStyle} onClick={handleDismiss}>わかった！</button>
          </>
        )}
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  justifyContent: 'center',
  padding: '0 12px calc(12px + env(safe-area-inset-bottom))',
  zIndex: 60,
  pointerEvents: 'none',
};

const cardStyle: React.CSSProperties = {
  pointerEvents: 'auto',
  position: 'relative',
  width: '100%',
  maxWidth: 420,
  background: colors.surface,
  borderRadius: 22,
  padding: '20px 22px 18px',
  boxShadow: '0 8px 30px rgba(74,68,88,0.28)',
  border: `2px solid ${colors.tertiary}`,
  textAlign: 'center',
  fontFamily: fonts.body,
  animation: 'screenIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
};

const closeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 12,
  background: 'transparent',
  border: 'none',
  fontSize: '1.4em',
  lineHeight: 1,
  color: colors.inkSoft,
  cursor: 'pointer',
  padding: 4,
};

const iconStyle: React.CSSProperties = {
  fontSize: '2em',
  marginBottom: 2,
};

const titleStyle: React.CSSProperties = {
  margin: '2px 0 6px',
  color: colors.primaryDark,
  fontFamily: fonts.heading,
  fontWeight: 'bold',
  fontSize: '1.15em',
};

const bodyStyle: React.CSSProperties = {
  margin: '0 0 14px',
  color: colors.ink,
  fontSize: '0.9em',
  lineHeight: 1.7,
};

const iosIconStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0 2px',
};

const installBtnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: colors.actionGradient,
  color: '#fff',
  border: 'none',
  borderRadius: 50,
  padding: '13px',
  fontSize: '1.02em',
  fontWeight: 'bold',
  fontFamily: fonts.heading,
  cursor: 'pointer',
  boxShadow: `0 4px 0 ${colors.primaryDark}`,
};

const laterStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'transparent',
  color: colors.inkSoft,
  border: 'none',
  padding: '10px 0 2px',
  fontSize: '0.85em',
  fontWeight: 'bold',
  cursor: 'pointer',
};

export default InstallPrompt;

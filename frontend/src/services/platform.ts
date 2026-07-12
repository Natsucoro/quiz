// src/services/platform.ts
// Trusted Web Activity(TWA = Google Playで配布するAndroidアプリのラッパー)内で
// 動作しているかどうかを判定する。TWA経由でChromeが開かれた場合、
// document.referrerが "android-app://<パッケージ名>" になることを利用する。
//
// Androidアプリのパッケージ名は twa-manifest.json / bubblewrap生成物と一致させること。
const ANDROID_PACKAGE_NAME = 'app.web.watashihadare_quiz.twa';

export const isRunningInTwa = (): boolean => {
  try {
    return document.referrer.startsWith(`android-app://${ANDROID_PACKAGE_NAME}`);
  } catch {
    return false;
  }
};

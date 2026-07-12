// src/services/analytics.ts
// アプリの利用状況・購入ファネルをGoogle Analytics(Firebase Analytics/GA4)へ計測するための薄いラッパー。
// 個人情報(メールアドレス等)は絶対にパラメータへ含めないこと。

import { logEvent } from 'firebase/analytics';
import { analytics } from '../lib/firebase';

type AnalyticsEvent =
  | { name: 'select_genre'; params: { genre: string } }
  | { name: 'select_difficulty'; params: { genre: string; difficulty: number } }
  | { name: 'quiz_start'; params: { genre: string; difficulty: number } }
  | { name: 'question_answered'; params: { genre: string; difficulty: number; quiz_id: string; is_correct: boolean } }
  | { name: 'hint_used'; params: { genre: string; difficulty: number; quiz_id: string; hint_number: number } }
  | { name: 'surrender'; params: { genre: string; difficulty: number; quiz_id: string } }
  | { name: 'quiz_complete'; params: { genre: string; difficulty: number; score: number; question_count: number } }
  | { name: 'image_search_click'; params: { genre: string; difficulty: number; quiz_id: string; source: 'answer' | 'option' } }
  | { name: 'view_paywall'; params: { genre: string; difficulty: number } }
  | { name: 'close_paywall'; params: { genre: string; difficulty: number; purchased: boolean } }
  | { name: 'login_start'; params: { method: 'email' | 'google' } }
  | { name: 'login_success'; params: { method: 'email' | 'google' } }
  | { name: 'begin_checkout'; params: { plan_type: 'single' | 'genre' | 'all'; value: number; currency: 'JPY' } }
  | { name: 'purchase'; params: { transaction_id: string; plan_type: 'single' | 'genre' | 'all'; value: number; currency: 'JPY' } };

// analyticsの初期化に失敗する環境(一部のWebView・プライベートブラウジング等)でも
// アプリ本体が落ちないよう、必ずtry/catchで包む。
export const trackEvent = <E extends AnalyticsEvent>(name: E['name'], params: E['params']): void => {
  try {
    if (!analytics) return;
    logEvent(analytics, name, params);
  } catch (error) {
    console.error('Analytics log failed:', error);
  }
};

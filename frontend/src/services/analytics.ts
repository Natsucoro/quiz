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
  | { name: 'purchase'; params: { transaction_id: string; plan_type: 'single' | 'genre' | 'all'; value: number; currency: 'JPY' } }
  | { name: 'question_request_submit'; params: { text_length: number } }
  | { name: 'pwa_prompt_shown'; params: { mode: 'native' | 'ios' } }
  | { name: 'pwa_prompt_dismissed'; params: { mode: 'native' | 'ios' } }
  | { name: 'pwa_install_result'; params: { outcome: 'accepted' | 'dismissed' } }
  | { name: 'time_attack_finish'; params: { genre: string; difficulty: number; question_count: number; time_ms: number; is_best: boolean } }
  | { name: 'result_share'; params: { method: 'native' | 'x' | 'line' | 'copy'; mode: 'normal' | 'timeattack' } };

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

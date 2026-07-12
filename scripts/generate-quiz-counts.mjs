#!/usr/bin/env node
// scripts/generate-quiz-counts.mjs
//
// data/quizzes/*.json はジャンルあたり500問前後・全16ジャンルで合計8MB超あり、
// このままフロントエンドに全件静的importするとJSバンドルが肥大化する
// (Core Web Vitals悪化の原因)。
//
// トップページ・課金モーダルの「◯問」表示には問題本文などの重いフィールドは不要で
// 件数だけあれば足りるため、ビルド時にこのスクリプトで軽量な件数サマリーを生成し、
// quizEngine.tsはこのサマリーだけを静的importする(実際の問題本文は選択したジャンルの
// みdynamic importで遅延読み込みする)。
//
// npm run dev / npm run build 実行時に自動生成されるため、手動更新やデータとの
// 乖離は発生しない(frontend/package.jsonのpredev/prebuildフックから呼ばれる)。

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const quizzesDir = join(__dirname, '../data/quizzes');
const outPath = join(__dirname, '../frontend/src/data/quizCounts.generated.json');

// トップページのジャンルタイル表示順は、このオブジェクトのキー挿入順(=このリストの
// 順序)に依存する(quizEngine.tsのgetAvailableGenres()がObject.keysで返すため)。
// readdirSync()のアルファベット順に任せると表示順が意図せず変わってしまうため、
// 従来のquizEngine.ts静的import順と同じ順序を明示的に固定する。新ジャンル追加時は
// このリストにもファイルを追記すること(未記載のファイルがあるとエラーで気づける)。
const FILE_ORDER = [
  'mammals.json', 'insects.json', 'plants.json', 'vehicles.json',
  'fish.json', 'birds.json', 'reptiles.json', 'marine.json',
  'history.json', 'geography_jp.json', 'geography_world.json',
  'tools.json', 'food.json', 'ai_robot.json', 'dinosaurs.json', 'space.json',
];

const actualFiles = readdirSync(quizzesDir).filter((f) => f.endsWith('.json'));
const missingFromOrder = actualFiles.filter((f) => !FILE_ORDER.includes(f));
const missingFromDisk = FILE_ORDER.filter((f) => !actualFiles.includes(f));
if (missingFromOrder.length > 0 || missingFromDisk.length > 0) {
  console.error('[generate-quiz-counts] FILE_ORDERとdata/quizzes/の内容が一致しません。');
  if (missingFromOrder.length > 0) console.error('  FILE_ORDER未記載:', missingFromOrder);
  if (missingFromDisk.length > 0) console.error('  ファイルが存在しない:', missingFromDisk);
  process.exit(1);
}

/** @type {Record<string, Record<string, number>>} */
const counts = {};

for (const file of FILE_ORDER) {
  const quizzes = JSON.parse(readFileSync(join(quizzesDir, file), 'utf-8'));
  for (const q of quizzes) {
    counts[q.genre] ??= {};
    counts[q.genre][q.difficulty] = (counts[q.genre][q.difficulty] ?? 0) + 1;
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(counts, null, 2) + '\n');
console.log(`[generate-quiz-counts] ${outPath} を生成しました (${Object.keys(counts).length}ジャンル)`);

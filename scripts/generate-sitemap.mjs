#!/usr/bin/env node
// scripts/generate-sitemap.mjs
//
// frontend/public/sitemap.xml をビルド時に自動生成する。
//
// 以前は sitemap.xml を手書きで管理していたため、(1) 新しいジャンル紹介ページや
// ブログ記事を追加しても sitemap への追記を忘れて漏れる、(2) lastmod が更新されず
// 「サイトの内容がずっと変わっていない」とクローラーに誤認され再クロールされにくく
// なる、という問題があった。このスクリプトは frontend/public/ 配下の実ファイルを
// 走査して URL を自動収集し、各ページの lastmod を git の最終コミット日から求める
// ため、ページを追加すれば自動で sitemap に載り、更新すれば lastmod も追従する。
//
// npm run dev / npm run build 実行時に自動生成される(frontend/package.json の
// predev/prebuild フックから generate-quiz-counts と一緒に呼ばれる)。

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const publicDir = join(repoRoot, 'frontend/public');
const outPath = join(publicDir, 'sitemap.xml');

const BASE_URL = 'https://watashihadare-quiz.web.app';

// フォールバック用の当日日付(git が使えない環境向け)。
const today = new Date().toISOString().slice(0, 10);

// リポジトリ全体の最終コミット日(個別ファイルの日付が取れない場合の第2フォールバック)。
let headDate = today;
try {
  headDate = execSync('git log -1 --format=%cs', { cwd: repoRoot }).toString().trim() || today;
} catch {
  // git 非対応環境ではフォールバックの today を使う。
}

/**
 * 指定ファイルの最終更新日(YYYY-MM-DD)を git の最終コミット日から求める。
 * 取得できない場合はリポジトリの HEAD 日付 → 当日 の順にフォールバックする。
 * @param {string} absFile
 * @returns {string}
 */
function lastmodFor(absFile) {
  try {
    const rel = absFile.replace(repoRoot + '/', '');
    const d = execSync(`git log -1 --format=%cs -- "${rel}"`, { cwd: repoRoot }).toString().trim();
    return d || headDate;
  } catch {
    return headDate;
  }
}

/**
 * public/ 配下の 1 ディレクトリから *.html を収集して URL エントリ化する。
 * index.html はディレクトリURL(末尾スラッシュ)として、それ以外は個別ページとして扱う。
 * @param {string} subdir 例: 'genres' / 'blog'
 * @param {{ index: string, page: string }} priorities
 * @returns {Array<{loc: string, file: string, changefreq: string, priority: string}>}
 */
function collectDir(subdir, priorities) {
  const dirAbs = join(publicDir, subdir);
  if (!existsSync(dirAbs)) return [];
  const entries = [];
  const files = readdirSync(dirAbs)
    .filter((f) => f.endsWith('.html'))
    .sort();
  // index.html(ディレクトリトップ)を先頭に置く。
  if (files.includes('index.html')) {
    entries.push({
      loc: `${BASE_URL}/${subdir}/`,
      file: join(dirAbs, 'index.html'),
      changefreq: 'monthly',
      priority: priorities.index,
    });
  }
  for (const f of files) {
    if (f === 'index.html') continue;
    entries.push({
      loc: `${BASE_URL}/${subdir}/${f}`,
      file: join(dirAbs, f),
      changefreq: 'monthly',
      priority: priorities.page,
    });
  }
  return entries;
}

// URL エントリを構築(生成順がそのまま sitemap の並び順になる)。
/** @type {Array<{loc: string, file: string, changefreq: string, priority: string}>} */
const urls = [];

// トップページ(SPA本体)。lastmod はアプリ本体 index.html のコミット日を用いる。
urls.push({
  loc: `${BASE_URL}/`,
  file: join(repoRoot, 'frontend/index.html'),
  changefreq: 'weekly',
  priority: '1.0',
});

// よくある質問。
urls.push({
  loc: `${BASE_URL}/faq.html`,
  file: join(publicDir, 'faq.html'),
  changefreq: 'monthly',
  priority: '0.8',
});

// ジャンル別クイズ紹介ページ(SEOの中核コンテンツ)。
urls.push(...collectDir('genres', { index: '0.8', page: '0.7' }));

// 雑学ブログ。
urls.push(...collectDir('blog', { index: '0.7', page: '0.6' }));

const body = urls
  .map((u) => {
    const lastmod = lastmodFor(u.file);
    return [
      '  <url>',
      `    <loc>${u.loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${u.changefreq}</changefreq>`,
      `    <priority>${u.priority}</priority>`,
      '  </url>',
    ].join('\n');
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

writeFileSync(outPath, xml);
console.log(`[generate-sitemap] ${outPath} を生成しました (${urls.length}URL)`);

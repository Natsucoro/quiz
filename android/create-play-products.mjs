#!/usr/bin/env node
// android/create-play-products.mjs
//
// Google Play Consoleに、このアプリの購入商品(In-app products)を一括登録する。
// 14ジャンル×有料レベル6つ+ジャンルまとめ買い14個+全ジャンルまとめ買い1個=99商品を
// 手作業で登録するのは大変なため、Google Play Developer APIでまとめて作成する。
//
// 事前準備:
//   1. Play Consoleでアプリを作成し、パッケージ名を予約しておく
//      (android/twa-manifest.jsonのpackageIdと一致させること)
//   2. Play Consoleの「API アクセス」でサービスアカウントを作成し、
//      「注文管理」権限を付与、JSON鍵をダウンロードする
//   3. npm install googleapis (このディレクトリ、またはリポジトリのどこかで)
//
// 実行方法:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//   node android/create-play-products.mjs
//
// 既に存在する商品IDはスキップし、存在しないものだけ新規作成する(何度実行しても安全)。

import { google } from 'googleapis';

const PACKAGE_NAME = 'app.web.watashihadare_quiz.twa';

// なつみさんの「Googleの手数料分を上乗せしたい」という方針に合わせて調整すること。
// ここではWeb版と同額をデフォルトにしている(Google Play手数料15%を上乗せする場合、
// 120円→141円、330円→388円、1480円→1741円 が目安)。
const SINGLE_PRICE_JPY = 120;
const GENRE_BUNDLE_PRICE_JPY = 330; // 有料レベル6つ × 55円
const ALL_BUNDLE_PRICE_JPY = 1480;

const GENRE_SLUGS = {
  '哺乳類': 'mammals',
  '昆虫': 'insects',
  '植物': 'plants',
  '魚類': 'fish',
  '鳥類': 'birds',
  '爬虫類': 'reptiles',
  '海洋生物': 'marine',
  '乗り物': 'vehicles',
  '道具': 'tools',
  '歴史上の人物': 'history',
  '日本の地理': 'geography_jp',
  '世界の地理': 'geography_world',
  '食べ物': 'food',
  '生成AI': 'generative_ai',
};

const PAID_DIFFICULTIES = [3, 4, 5, 8, 9, 10];

function buildProductList() {
  const products = [];

  for (const [genre, slug] of Object.entries(GENRE_SLUGS)) {
    for (const lv of PAID_DIFFICULTIES) {
      products.push({
        sku: `single_${slug}_lv${lv}`,
        title: `「${genre} Lv.${lv}」レベル解放`,
        description: `「${genre}」ジャンルのレベル${lv}を解放します。`,
        priceJpy: SINGLE_PRICE_JPY,
      });
    }
    products.push({
      sku: `genre_${slug}`,
      title: `「${genre}」まとめ買い(全レベル解放)`,
      description: `「${genre}」ジャンルの全レベルをまとめて解放します。`,
      priceJpy: GENRE_BUNDLE_PRICE_JPY,
    });
  }

  products.push({
    sku: 'bundle_all',
    title: '全ジャンル・全レベル まとめ買い解放',
    description: '全14ジャンル・全レベルをまとめて解放します。',
    priceJpy: ALL_BUNDLE_PRICE_JPY,
  });

  return products;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const androidPublisher = google.androidpublisher({ version: 'v3', auth });

  const products = buildProductList();
  console.log(`登録対象: ${products.length}件`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of products) {
    try {
      await androidPublisher.inappproducts.get({
        packageName: PACKAGE_NAME,
        sku: product.sku,
      });
      console.log(`[SKIP] ${product.sku} は既に存在します`);
      skipped += 1;
      continue;
    } catch (err) {
      if (err?.code !== 404 && err?.response?.status !== 404) {
        console.error(`[ERROR] ${product.sku} の存在確認に失敗:`, err.message || err);
        failed += 1;
        continue;
      }
      // 404 = 未作成、これから作成する
    }

    try {
      await androidPublisher.inappproducts.insert({
        packageName: PACKAGE_NAME,
        requestBody: {
          packageName: PACKAGE_NAME,
          sku: product.sku,
          status: 'active',
          purchaseType: 'managedUser',
          defaultPrice: {
            priceMicros: String(product.priceJpy * 1_000_000),
            currency: 'JPY',
          },
          listings: {
            'ja-JP': {
              title: product.title,
              description: product.description,
            },
          },
        },
      });
      console.log(`[CREATED] ${product.sku} (¥${product.priceJpy})`);
      created += 1;
    } catch (err) {
      console.error(`[ERROR] ${product.sku} の作成に失敗:`, err.message || err);
      failed += 1;
    }
  }

  console.log(`\n完了: 作成${created}件 / スキップ${skipped}件 / 失敗${failed}件`);
}

main().catch((err) => {
  console.error('スクリプト実行エラー:', err);
  process.exit(1);
});

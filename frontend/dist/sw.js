
const CACHE_NAME = 'quiz-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/bundle.js', // Reactアプリのビルド後のJSファイルパスを想定
  '/static/css/main.css', // Reactアプリのビルド後のCSSファイルパスを想定
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  // 必要に応じて、音声ファイルやJSONデータなどもキャッシュ対象に追加
  // '/data/quizzes/animals.json', // サーバーからフェッチされる場合、動的キャッシュで対応
  '/se/correct.mp3', // 例: 効果音ファイル
  '/se/incorrect.mp3' // 例: 効果音ファイル
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュにあればそれを使う
        if (response) {
          return response;
        }
        // キャッシュになければネットワークから取得
        return fetch(event.request).then(
          (response) => {
            // レスポンスが不正な場合（例: ステータスが200以外）はキャッシュしない
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 新しいリソースをキャッシュに追加
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        );
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // 現在のキャッシュ以外の古いキャッシュを削除
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

# 楽譜カメラの読み取りサーバー(Audiveris + Flask)。Cloud Run 向け。
FROM ubuntu:22.04

# Audiveris(Java同梱の自己完結パッケージ)と、動作に要る描画ライブラリ
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates python3 python3-pip \
      libfreetype6 libfontconfig1 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L -o /tmp/audiveris.deb \
      https://github.com/Audiveris/audiveris/releases/download/5.8.1/Audiveris-5.8.1-ubuntu22.04-x86_64.deb \
    && dpkg -x /tmp/audiveris.deb / && rm /tmp/audiveris.deb

RUN pip3 install --no-cache-dir flask gunicorn

WORKDIR /srv
COPY app.py .

# Cloud Run は $PORT を渡してくる。ワーカー1・スレッド2(Audiverisが重いので絞る)
CMD exec gunicorn --bind :${PORT:-8080} --workers 1 --threads 2 --timeout 300 app:app

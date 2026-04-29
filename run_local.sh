#!/bin/bash
# ローカル開発サーバー起動スクリプト
set -e

# NVMのロード
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# frontendディレクトリへ移動
cd "$(dirname "$0")/frontend"

echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

echo ""
echo "=== 開発サーバー起動中 ==="
echo "URL: http://localhost:5173"
echo "Ctrl+C で停止"
echo ""

# ローカルモードで起動
LOCAL=true npm run dev

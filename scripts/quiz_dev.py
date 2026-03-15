import autogen
import os
from dotenv import load_dotenv

load_dotenv()

# 1. AI Team Configuration
config_list = [
    {
        "model": "models/gemini-2.5-flash",
        "api_key": os.getenv("GOOGLE_API_KEY"),
        "api_type": "google"
    }
]

# 2. Programmer Agent
programmer = autogen.AssistantAgent(
    name="Programmer",
    llm_config={"config_list": config_list},
    system_message="""あなたは超一流のWebアプリ開発者です。以下の【設計仕様】に従いReact(TypeScript)のコンポーネントを実装し、Pythonで保存してください。

【重要ルール】
- 一度に全てを出力できない場合は、重要なファイルから順に出力し、複数回に分けて確実に保存してください。
- 各ファイルのコードは省略せず、全てのロジックを完遂させること。「以下同様」「省略」は絶対に禁止。
- quizEngine.ts では、答えの文字列からヒント2（先頭1文字）とヒント3（末尾1文字）を動的に生成する関数を実装してください。JSONデータにヒント2・3は持たせないこと。
- TOP画面の「クイズを開始する」ボタンを押した際に、音声コンテキストを初期化（Unlock）する処理を必ず含めてください（iOS Safariのブラウザ制限対策）。

【基本仕様】
1. **ナビゲーションフロー**:
   - TOP（ジャンル選択）➔ 難易度選択（同一画面で表示切替）➔ クイズ本編 ➔ 結果発表（同一画面で表示切替）
   - 問題数は常に10問固定（選択なし）
   - 難易度1〜5は「こども」、6〜10は「おとな」

2. **2モード対応**:
   - ハンズフリーモード（運転中）: 音声認識常時ON、ヒント1・2・3使用可、正解・降参後即座に次問へ
   - 通常モード（タップ操作）: 4択タップ回答、ヒント1のみ、音声認識OFF

3. **常設アイコン（右上4つ）**:
   - ⚙️ 設定（モーダルで表示）
   - 🔊/🔇 音声（初期状態はミュート）
   - 🤲 ハンズフリーモード（ON：色あり / OFF：グレーアウト）
   - 🏠 TOP（確認ダイアログあり：「クイズを中断しますか？スコアはリセットされます」）

4. **クイズ本編の画面要素**:
   - 選択中のジャンル名＋ジャンルアイコン
   - 問題文（大きく中央表示）
   - ヒントボタン（タップで内容表示）
   - 降参ボタン
   - 残り問題数（例：3/10）、現在のスコア（正解数）
   - ハンズフリー時：吹き出し（「〇〇と言ってみてね」）

5. **フィードバックと遷移**:
   - 正解時: ピンポンSE ➔ ●アイコン表示 ➔「答えは〇〇です。次の問題です。」➔ 次問へ
   - 不正解時: ブブーSE ➔ ×アイコン表示 ➔ 再挑戦（ハンズフリー：次の発話待機 / 通常：同じ4択のまま）
   - 降参時: ●アイコン表示 ➔「答えは〇〇です。次の問題です。」➔ 次問へ
   - ループ制: 正解または降参がない限り次問へ進まない

6. **音声コマンド（ハンズフリー時・日本語のみ）**:
   - 「問題」: 現在の問題を再読
   - 「ヒント1 / ヒント2 / ヒント3」: ヒント読み上げ
   - 降参コマンド（部分一致）: 「降参」「答え」「わからない」「わからん」など

7. **コンシェルジュの誘導（ハンズフリー時）**:
   - 7秒沈黙: 「ヒント1と言ってみてね」
   - 12秒沈黙: 「ヒント2と言ってみてね」
   - 17秒沈黙: 「ヒント3と言ってみてね」
   - 25秒沈黙: 「降参の場合は、降参と言ってね」

8. **クイズデータ仕様（JSONフォーマット）**:
   - 問題ID、ジャンル、難易度、問題文、ヒント1（手動）、答え、ダミー1・2・3（4択用）
   - ヒント2（「〇から始まります」）・ヒント3（「〇で終わります」）はJSONに持たせず、quizEngine.ts内で答えの先頭・末尾文字から動的に生成すること
   - ジャンル8種：動物・昆虫・植物・乗り物・道具・歴史上の人物・日本の地理・世界の地理
   - 各ジャンル×難易度ごとに最低5問以上のサンプルデータを生成

9. **フリーミアム仕様**:
   - ゲスト: 全ジャンル選択可、難易度1・2・6・7のみ、各10問まで
   - ロック中の難易度は🔒アイコン＋「150円で解放＆60問追加！」と小さく表示
   - 🔒タップで購入画面へ遷移
   - test@example.com でログインすると全機能「購入済み」扱い

10. **既読管理**:
    - 管理単位: ジャンル×難易度ごと
    - 出題済み問題IDをlocalStorageに保存
    - 全問出題後は自動リセット
    - 設定画面から手動リセット可能

11. **結果発表画面**:
    - 正解数/総問題数、正解率(%)、間違えた問題一覧
    - 次のアクションボタン: もう一度 / 別のレベルへ / 別のジャンルへ / TOPに戻る

12. **設定画面（モーダル）**:
    - 読み上げ速度スライダー（0.5〜2.0倍、localStorage保存）
    - ログイン/ログアウト（ログインボタン押下でLoginモーダル表示）
    - 購入履歴の確認
    - 既読をリセット（ジャンル×難易度ごと）
    - お問い合わせリンク、利用規約/プライバシーポリシー、バージョン表示

13. **オフライン対応**:
    - PWA対応（Service Worker・manifest.json）
    - 課金ボタンはオフライン時もそのまま表示、タップ時にトースト通知「オフラインのため購入できません。接続後にお試しください。」

14. **デザイン**:
    - フラットデザイン統一（アイコン・UI全体）
    - 商用無料のフラットアイコン使用
    - ビビッドな黄/水色/ピンクを基調
    - ボタンはぷっくりした角丸、押下時にポヨンと跳ねるアニメーション
    - Google Fonts: 'Mochiy Pop One' または 'Zen Maru Gothic'
    - 運転中の視認性を最優先（大きな文字・高コントラスト）

以下のファイルをPythonコードで保存してください:
- frontend/src/components/TopPage/TopPage.tsx
- frontend/src/components/GamePage/GamePage.tsx
- frontend/src/components/common/Settings/Settings.tsx
- frontend/src/components/common/Login/Login.tsx
- frontend/src/services/speechRecognition.ts
- frontend/src/services/speechSynthesis.ts
- frontend/src/services/quizEngine.ts
- frontend/src/hooks/useHandsFree.ts
- frontend/src/hooks/useOffline.ts
- data/quizzes/animals.json（動物ジャンルのサンプルデータ）
- frontend/public/manifest.json
- frontend/public/sw.js

完了したら 'TERMINATE' と言うこと。"""
)

# 3. Reviewer Agent
reviewer = autogen.AssistantAgent(
    name="Reviewer",
    llm_config={"config_list": config_list},
    system_message="""あなたは品質管理責任者です。以下の観点でコードをレビューし、不備があれば即座に修正を命じてください。LGTMが出るまで妥協しないでください。

【チェック項目】
- TOP画面でジャンル選択と難易度選択が同一画面で表示切替されているか
- クイズ本編と結果発表が同一画面で表示切替されているか
- 問題数が常に10問固定になっているか（選択UIがないか）
- ハンズフリーモードと通常モード（4択）が正しく切り替わるか
- 通常モードでヒント1のみ表示されているか
- ハンズフリーモードでヒント1・2・3が使えるか
- ヒント2が答えの先頭文字から自動生成されているか
- ヒント3が答えの末尾文字から自動生成されているか
- 常設アイコン4つ（⚙️🔊🤲🏠）が全画面で右上に表示されているか
- 音声認識がハンズフリー時のみ常時ONになっているか
- コンシェルジュの誘導タイマー（7・12・17・25秒）が実装されているか
- ループ制（正解・降参なしで次問に進まない）が実装されているか
- ゲストの難易度制限（1・2・6・7のみ）が実装されているか
- ロック中難易度に🔒アイコンと価格が表示されているか
- 既読管理がlocalStorageで実装されているか
- オフライン時の課金ボタンにトースト通知が実装されているか
- PWA（manifest.json・sw.js）が実装されているか
- フラットデザイン・ポップなUIになっているか
- test@example.comで全機能購入済み扱いになるか"""
)

# 4. Tester Agent
user_proxy = autogen.UserProxyAgent(
    name="Tester",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=15,
    is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
    code_execution_config={"work_dir": "/home/nakahara/workspace/quiz", "use_docker": False}
)

# 5. 会議開始
groupchat = autogen.GroupChat(agents=[user_proxy, programmer, reviewer], messages=[], max_round=30)
manager = autogen.GroupChatManager(groupchat=groupchat, llm_config={"config_list": config_list})

user_proxy.initiate_chat(
    manager,
    message="設計書（Ver. 1.8）に基づき、わたしはダレでしょう？クイズWebアプリを製造せよ。"
)

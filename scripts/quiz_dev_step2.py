import autogen
import os
from dotenv import load_dotenv

load_dotenv()

# 設計書を読み込む
DOCS_DIR = "/home/nakahara/workspace/quiz/docs"
with open(f"{DOCS_DIR}/わたしはダレでしょう？クイズ集！設計書（Ver. 1.8）.md", encoding="utf-8") as f:
    SPEC = f.read()

config_list = [
    {
        "model": "models/gemini-2.5-flash",
        "api_key": os.getenv("GOOGLE_API_KEY"),
        "api_type": "google"
    }
]

programmer = autogen.AssistantAgent(
    name="Programmer",
    llm_config={"config_list": config_list},
    system_message=f"""あなたは超一流のWebアプリ開発者です。以下の【設計書】に従い、指定された3ファイルをPythonコードで保存してください。

【重要ルール】
- コードは省略せず、全ロジックを完遂させること。「以下同様」「省略」は絶対に禁止。
- 既存ファイル（TopPage.tsx・GamePage.tsx・quizEngine.ts等）との整合性を保つこと。
- Zustandは `zustand` パッケージを使用すること。

【設計書】
{SPEC}

【追加仕様・念押し事項】

■ frontend/src/App.tsx
- React + TypeScript
- 画面状態: 'top' | 'game' の2種類をuseStateで管理
- 'top' のとき <TopPage /> を表示、'game' のとき <GamePage /> を表示
- TopPageのprops: `onStart: (genre: string, difficulty: number) => void`
- GamePageのprops: `genre: string`, `difficulty: number`, `onBack: () => void`
- 選択中のジャンル・難易度をAppのstateで保持しGamePageに渡す
- App.tsxはシンプルなルーター役に徹する（常設アイコンは各コンポーネント内で管理）
- useEffect内でdocument.headにGoogleフォント（Mochiy Pop One）のlinkタグを動的追加する

【念押し】既存のTopPage.tsxとGamePage.tsxは独自のprops設計（setCurrentPage・isPremiumUser等）になっている。
App.tsxを生成する際は、上記のシンプルなprops（onStart / onBack）に合わせてTopPage.tsxとGamePage.tsxも同時に修正・上書き保存すること。

■ frontend/src/store/settingsStore.ts
- Zustandで以下のstateを管理:
  - speechRate: number（読み上げ速度、初期値1.0）
  - isMuted: boolean（音声ミュート、初期値true）
  - isHandsFree: boolean（ハンズフリーモード、初期値false）
- アクション: setSpeechRate / setIsMuted / setIsHandsFree
- 全stateをzustand/middlewareのpersistでlocalStorageに永続化

■ frontend/src/store/purchaseStore.ts
- Zustandで以下のstateを管理:
  - purchasedItems: string[]（例: "animals_3"、初期値[]）
  - isLoggedIn: boolean（初期値false）
  - userEmail: string | null（初期値null）
- アクション:
  - login(email: string): isLoggedIn=true, userEmail=emailをセット。
    email === "test@example.com" の場合は全ジャンル×難易度3〜5・8〜10（計48アイテム）をpurchasedItemsにセット
  - logout(): 全stateをリセット
  - addPurchase(itemId: string): purchasedItemsに追加
  - isPurchased(itemId: string): boolean を返すセレクター
- 全stateをzustand/middlewareのpersistでlocalStorageに永続化
- ジャンル8種のID: animals / insects / plants / vehicles / tools / historical_figures / japan_geography / world_geography

【念押し】quizEngine.tsは現在animalsのみインポートしている。
他7ジャンルのJSONファイル（insects.json / plants.json / vehicles.json / tools.json /
historical_figures.json / japan_geography.json / world_geography.json）も
data/quizzes/に生成し、quizEngine.tsのインポートも全8ジャンル対応に修正・上書き保存すること。
各JSONは各難易度（1〜10）に最低5問以上のサンプルデータを含めること。

以下のファイルをPythonコードで保存してください:
- frontend/src/App.tsx
- frontend/src/store/settingsStore.ts
- frontend/src/store/purchaseStore.ts
- frontend/src/components/TopPage/TopPage.tsx（App.tsxのpropsに合わせて修正）
- frontend/src/components/GamePage/GamePage.tsx（App.tsxのpropsに合わせて修正）
- frontend/src/services/quizEngine.ts（全8ジャンル対応に修正）
- data/quizzes/insects.json
- data/quizzes/plants.json
- data/quizzes/vehicles.json
- data/quizzes/tools.json
- data/quizzes/historical_figures.json
- data/quizzes/japan_geography.json
- data/quizzes/world_geography.json

完了したら 'TERMINATE' と言うこと。"""
)

reviewer = autogen.AssistantAgent(
    name="Reviewer",
    llm_config={"config_list": config_list},
    system_message="""あなたは品質管理責任者です。生成された全ファイルを以下の観点でレビューし、不備があれば即座に修正を命じてください。LGTMが出るまで妥協しないこと。

【App.tsx チェック】
- 'top' / 'game' の画面切替が正しく実装されているか
- TopPageに onStart(genre, difficulty) props が渡されているか
- GamePageに genre・difficulty・onBack props が渡されているか
- ジャンル・難易度がAppのstateで保持されGamePageに渡されているか
- Googleフォント（Mochiy Pop One）がuseEffect内で動的追加されているか

【TopPage.tsx / GamePage.tsx チェック】
- App.tsxのprops（onStart / onBack）に合わせて修正されているか
- 旧props（setCurrentPage・isPremiumUser等）が残っていないか
- settingsStore・purchaseStoreからZustandでstateを取得しているか

【settingsStore.ts チェック】
- speechRate・isMuted・isHandsFreeがpersistで永続化されているか
- 各setterアクションが正しく実装されているか

【purchaseStore.ts チェック】
- test@example.comログイン時に全48アイテムが購入済みになるか
- 全ジャンル8種×難易度3〜5・8〜10（計48アイテム）が漏れなくセットされているか
- isPurchasedセレクターが正しく動作するか
- persistで永続化されているか

【quizEngine.ts チェック】
- 全8ジャンルのJSONがインポートされているか
- animalsのみのインポートになっていないか

【JSONデータ チェック】
- 7ジャンル分（insects/plants/vehicles/tools/historical_figures/japan_geography/world_geography）が生成されているか
- 各JSONに難易度1〜10・各5問以上のデータがあるか
- hint2・hint3フィールドがJSONに含まれていないか（動的生成のため不要）

【共通チェック】
- TypeScriptの型定義に不備がないか
- 省略・「以下同様」が使われていないか"""
)

user_proxy = autogen.UserProxyAgent(
    name="Tester",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=10,
    is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
    code_execution_config={"work_dir": "/home/nakahara/workspace/quiz", "use_docker": False}
)

groupchat = autogen.GroupChat(agents=[user_proxy, programmer, reviewer], messages=[], max_round=20)
manager = autogen.GroupChatManager(groupchat=groupchat, llm_config={"config_list": config_list})

user_proxy.initiate_chat(
    manager,
    message="App.tsx・settingsStore.ts・purchaseStore.ts・TopPage.tsx（修正）・GamePage.tsx（修正）・quizEngine.ts（修正）・残り7ジャンルのJSONを仕様通りに生成・保存せよ。"
)

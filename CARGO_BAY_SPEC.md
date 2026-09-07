# Hub Terminal — Cargo Bay MVP 実装仕様書

更新日: 2026-09-07  
実装主担当: えみ（ChatGPT）  
監査 / GitHub / えみにできないローカル作業: クロちゃん（Claude Code）

---

# 0. 役割分担

Hub Terminal の設計と実装は、原則としてえみが主担当。

理由:
- 会話中に仕様が連続的に変化する
- 設計意図と実装を分離すると一体感が崩れやすい
- UI / データモデル / Timer / Deadline Engine を同じ思想で維持したい

クロちゃんには以下だけを担当してもらう。

- コード監査
- GitHub操作
- ローカル環境でしかできない作業
- えみから直接実行できない操作
- 必要に応じた検証

実装そのものは、可能な限りえみ側で作成し、差分・ファイル・パッチを渡す。

---

# 1. Cargo Bay の目的

Hub Terminal に汎用タスク管理機能「Cargo Bay」を追加する。

Cargo Bay は単なるToDo一覧ではなく、

- カテゴリ
- 案件
- 現在地
- 期日
- デッドライン

を一覧で持ち、カテゴリ固有の作業工程を必要に応じて有効化できる構造にする。

最初の特殊カテゴリは「写真」。

既存の Hub Timer Widget と接続し、Cargo Bay から作業開始・中断・完了を操作できるようにする。

Pomodoro は集中補助の目安なので、Cargo Bay の業務ステータスとは連動させない。

---

# 2. Cargo Bay 基本データモデル

各 Cargo は最低限以下を持つ。

```js
{
  id: string,
  category: string,
  title: string,
  currentStage: string | null,
  dueDate: string | null,
  deadline: string | null,

  processTemplate: string | null,
  enabledStages: string[],
  designMode: "self" | "outsourced" | null,

  createdAt: string,
  updatedAt: string
}
```

一覧表示する列:

```text
カテゴリ | 案件 | 現在地 | 期日 | デッドライン
```

### 用語

- カテゴリ
  - タスクの種類
  - 例: 写真 / 動画 / 開発 / 事務 / 私用

- 案件
  - Cargo の名称

- 現在地
  - そのCargoが今どの工程・状態にいるか
  - 単なる汎用ステータスではなく、カテゴリ固有工程を表示できるようにする

- 期日
  - 自分が設定する「ここまでに終わらせたい日」

- デッドライン
  - 絶対に超えられない最終期限
  - Deadline Engine / アラートの基準日

---

# 3. Category = 写真 の場合だけ有効になる工程

写真カテゴリの標準フロー:

```text
セレクト
→ 現像
→ レタッチ
→ デザイン
→ 入稿
→ 納品
```

ただし各工程は案件単位で ON / OFF 可能にする。

例:

### 結婚式スナップ・アルバムなし

```text
セレクト
→ 現像
→ 納品
```

### 結婚式・アルバムあり

```text
セレクト
→ 現像
→ デザイン
→ 入稿
→ 納品
```

### 結婚式・一部レタッチあり・アルバムあり

```text
セレクト
→ 現像
→ レタッチ
→ デザイン
→ 入稿
→ 納品
```

### 前撮り・記念撮影・アルバムなし

```text
セレクト
→ 現像
→ レタッチ
→ 納品
```

### 前撮り・記念撮影・アルバムあり

```text
セレクト
→ 現像
→ レタッチ
→ デザイン
→ 入稿
→ 納品
```

重要:
撮影ジャンルだけで工程を固定しない。

案件ごとに、

```text
この工程は必要
この工程は不要
```

を切り替えられるようにする。

---

# 4. 写真カテゴリの「現在地」

時間のかかる工程には「中 / 済」を持たせる。

```text
未着手

セレクト中
セレクト済

現像中
現像済

レタッチ中
レタッチ済

デザイン中
デザイン済

入稿済

納品済
```

「入稿中」は原則不要。

入稿は作業セッションというより操作完了イベントに近いため、

```text
デザイン済 → 入稿済
```

でよい。

納品も原則、

```text
入稿済 → 納品済
```

またはアルバムなしの場合、

```text
現像済 / レタッチ済 → 納品済
```

とする。

---

# 5. デザイン工程

デザイン工程が有効な場合、

```js
designMode:
  "self"
  "outsourced"
```

を持てるようにする。

### self

自分でデザインする。

Timer計測対象。

### outsourced

外注する。

外注先が作業している時間そのものはTimer計測しない。

必要なら、

- 依頼準備
- 確認
- 修正対応

だけWork Sessionとして記録する。

MVPでは `designMode` の保持だけでもよい。

---

# 6. Cargo Bay と Hub Timer の役割分担

重要:

Timer Widget 側では、今後「タスクを選ぶ」操作をしない。

タスク選択の起点は Cargo Bay に一本化する。

操作フロー:

```text
Cargo Bay
↓
案件を選ぶ
↓
工程を選ぶ
↓
START
```

Hub Timer Widget は、

```text
現在動いている案件
現在動いている工程
経過時間
Pomodoro
```

を表示する。

つまり、Timer Widget は
「何をやるか選ぶ場所」ではなく、
「今なにをやっていて、どれくらい時間が経っているかを見る場所」
に変える。

---

# 7. Timer Widget の変更

既存Widgetにあるタスク選択プルダウンは削除する。

現在のイメージ:

```text
[タスク選択 ▼] [POMO] [▶] [⏸] [✓]
```

変更後:

```text
案件名
工程名

[POMO] [⏸] [✓]
```

または停止中:

```text
No active task
```

のような表示。

START操作は原則 Cargo Bay 側から行う。

### 表示例

```text
2026.07.31 モアナ｜湊様・三宅様
現像

WORK
00:42:18
```

案件名が長い場合は、

- 1行省略
- tooltip
- 2行表示

などで崩れないようにする。

---

# 8. Timer Widget に表示する Active Session

Timer Widget は共通の Active Session を参照する。

```js
{
  sessionId: string,
  cargoId: string,
  cargoTitle: string,
  category: string,
  stage: string,
  stageLabel: string,
  startedAt: string
}
```

表示:

```text
cargoTitle
stageLabel
```

例:

```text
2026.07.31 モアナ｜湊様・三宅様
現像
```

Active Session がない場合:

```text
No active task
```

または日本語なら、

```text
作業なし
```

UI全体のトーンに合わせて最終決定する。

---

# 9. Cargo Bay から行う Timer 操作

Cargo Bay 側に以下を持つ。

```text
START
中断
完了
```

## START

例:

Cargo:

```text
2026.07.31 モアナ｜湊様・三宅様
```

工程:

```text
現像
```

START時に以下を行う。

1. Work Session 作成
2. cargoId を記録
3. cargoTitle を記録
4. category を記録
5. stage を記録
6. startedAt を記録
7. Hub Timer Engine を開始
8. Cargoの現在地を `現像中` にする
9. Timer Widget に案件名・工程名を表示

例:

```js
{
  sessionId: "...",
  cargoId: "...",
  cargoTitle: "2026.07.31 モアナ｜湊様・三宅様",
  category: "写真",
  stage: "develop",
  stageLabel: "現像",
  startedAt: "...",
  endedAt: null,
  durationSec: null,
  endReason: null
}
```

---

# 10. 中断

中断時:

1. Timer停止
2. Work Sessionへ endedAt 保存
3. duration 保存
4. endReason = "paused"
5. Cargo現在地は「○○中」のまま
6. Active Session を解除
7. Timer Widget は停止状態へ戻る

例:

```text
現像中
```

のまま残す。

理由:

1セッションで工程が終わるとは限らない。

---

# 11. 完了

完了時:

1. Timer停止
2. Work Session保存
3. endReason = "completed"
4. 現工程を「○○済」に変更
5. Active Session を解除
6. Timer Widget は停止状態へ戻る

例:

```text
現像中
↓
現像済
```

その後、次に有効な工程を「次の候補」として提示できる。

---

# 12. Timer Widget 側の操作

Timer Widget 側では、最低限以下を残す。

```text
中断
完了
POMO
```

STARTはCargo Bayに寄せる。

ただし将来、

```text
前回の作業を再開
```

のような導線をTimer Widgetに追加する可能性はある。

MVPでは不要。

### Timer Widget の中断

Cargo Bayの「中断」と同じ処理。

### Timer Widget の完了

Cargo Bayの「完了」と同じ処理。

どこから操作しても共通Engineを通す。

---

# 13. Pomodoroとの関係

Pomodoro は完全に分離する。

Cargoの状態遷移には使用しない。

禁止例:

```text
Pomo終了
→ 現像済
```

これはしない。

Pomoは、

```text
集中時間の目安
```

だけ。

Pomoは自動で工程遷移しない。25分到達後もFocusのまま超過時間を `+mm:ss` で表示し、作業時間の計測を継続する。

休憩開始はユーザーが「中断」を押した時だけ行い、その時点からBreak 5分を計測する。5分を超えても自動でFocusへ戻らず `+mm:ss` で超過表示する。作業再開はCargo Bayから手動でSTARTした時だけFocus 25分へ戻す。

Pomoの表示は時刻差分で計算し、iframe非Active時のtick停止に依存しない。通知・効果音はMVP対象外とする。

Work Timer は、

```text
実作業時間の記録
```

を担当する。

---

# 14. Work Sessions

Timer実測ログとして以下を持つ。

```js
{
  id: string,

  cargoId: string | null,
  cargoTitle: string | null,
  category: string | null,
  stage: string | null,
  stageLabel: string | null,

  startedAt: string,
  endedAt: string | null,
  durationSec: number | null,

  endReason: "paused" | "completed" | null
}
```

同一工程を複数回計測できる。

例:

```text
現像
42分
68分
31分
```

なら、

```text
現像 合計 2時間21分
```

として集計できる。

---

# 15. 将来の案件別工数集計

Cargo単位で、

```text
セレクト   1:12
現像       3:46
レタッチ   2:08
----------------
合計       7:06
```

のように表示可能にする。

MVPではWork Sessionsを正しく紐付けて保存できればよい。

表示実装は後回しでもよい。

---

# 16. Deadline Engine

デッドラインは単なる日付表示ではなく、

```text
現在地
+
残工程
+
工程ごとの必要時間
+
残日数
+
Deadline
```

から危険度を判断するために使う。

## 初期段階

まだTimer実測データが少ないため、工程ごとに仮工数を持たせる。

例:

```js
const PHOTO_STAGE_DEFAULT_HOURS = {
  select: 1.5,
  develop: 4,
  retouch: 3,
  design: 3,
  submit: 0.25,
  delivery: 0.25
};
```

数値は仮置き。

あとで実測値から更新する。

## 将来

Work Sessionsが蓄積したら、

```text
過去の同カテゴリ
過去の同工程
案件ごとの実測
```

から平均 / 中央値などを算出し、必要残時間を推定する。

---

# 17. Deadline Alert の基本考え方

単純に、

```text
Deadlineまであと5日
```

ではなく、

```text
残工程に必要そうな時間に対して
残り可処分時間が不足しそう
```

なら警告を強くする。

MVPでは簡易式でよい。

```js
remainingHours = enabledRemainingStages
  .reduce((sum, stage) => sum + defaultHours[stage], 0);

remainingDays = daysBetween(today, deadline);

requiredHoursPerDay =
  remainingHours / Math.max(remainingDays, 1);
```

簡易Alert:

```text
safe
watch
warning
critical
overdue
```

例:

```js
if (deadlinePassed) overdue
else if (remainingDays <= 1) critical
else if (requiredHoursPerDay >= 4) critical
else if (requiredHoursPerDay >= 2) warning
else if (requiredHoursPerDay >= 1) watch
else safe
```

この閾値も仮置き。

---

# 18. HT上のアラート

将来的にはHome / Cargo Bay上部などに、

```text
⚠ モアナ 湊様・三宅様
Deadlineまで2日
残工程: 現像 → レタッチ → 納品
推定残作業: 6.5h
```

のように表示する。

MVPではCargo一覧のDeadline欄に、

```text
9/12 ⚠
```

のような危険度表示だけでもよい。

---

# 19. 写真以外のCategory

Cargo Bay本体は写真専用にしない。

Categoryに応じてProcess Templateを変えられる構造にする。

将来例:

```text
動画
素材整理 → 編集 → MA → 書き出し → 納品

開発
調査 → 実装 → テスト → Deploy
```

ただしMVPでは、

```text
写真 = 専用Processあり
その他 = 汎用Cargo
```

でよい。

---

# 20. Cargo Bay UI方針

Cargo Bay一覧:

```text
カテゴリ | 案件 | 現在地 | 期日 | デッドライン
```

Cargoを選択 / 展開したら、

写真の場合のみ:

```text
工程を選択
[セレクト] [現像] [レタッチ] [デザイン] ...

[▶ START]
```

実行中は:

```text
[中断] [完了]
```

経過時間そのものはCargo Bay側では表示不要。

既存Hub Timer Widgetに表示する。

---

# 21. 今回最初に登録するCargo

```js
{
  category: "写真",
  title: "2026.07.31 モアナ｜湊様・三宅様",
  currentStage: "セレクト済",
  dueDate: null,
  deadline: null,
  rawDeadlineText: "期限9/9",

  processTemplate: "photo",
  enabledStages: [
    "select",
    "develop",
    "retouch",
    "design",
    "submit",
    "delivery"
  ]
}
```

注意:

レタッチ / デザイン / 入稿が本案件で必要かは未確定。

MVP初期値として全部ONでもよいが、
UIでOFF可能にする。

---

# 22. 推奨 stage key

表示名と内部値は分ける。

```js
const PHOTO_STAGES = [
  { key: "select", label: "セレクト" },
  { key: "develop", label: "現像" },
  { key: "retouch", label: "レタッチ" },
  { key: "design", label: "デザイン" },
  { key: "submit", label: "入稿" },
  { key: "delivery", label: "納品" }
];
```

現在地:

```js
function stageStatusLabel(stage, state) {
  // state: idle | active | completed
}
```

例:

```text
develop + active
→ 現像中

develop + completed
→ 現像済
```

---

# 23. 共通 Timer Engine

既存のTimer関数を、

```js
startWorkSession()
pauseWorkSession()
completeWorkSession()
```

のような共通Engineへ寄せる。

UIイベント:

```text
Cargo Bay START
→ startWorkSession({ cargoId, stage })

Cargo Bay 中断
→ pauseWorkSession()

Cargo Bay 完了
→ completeWorkSession()

Timer Widget 中断
→ pauseWorkSession()

Timer Widget 完了
→ completeWorkSession()
```

Timer Widget には task selector を持たせない。

Active Session の案件名と工程名だけ表示する。

---

# 24. Active Session の永続化

既存Timerの弱点として、
画面のライフサイクルやiframe依存で時間計測が止まる問題がある。

Timerの正本は「tickの回数」ではなく、

```text
startedAt
```

にする。

表示時は毎回、

```js
elapsedSec =
  Math.floor((Date.now() - startedAt) / 1000);
```

で算出する。

Active Session は localStorage 等に保存し、

```js
{
  cargoId,
  cargoTitle,
  category,
  stage,
  stageLabel,
  startedAt
}
```

を保持する。

画面が非Activeでも、
戻ってきた時に正しい経過時間を再計算できる構造にする。

setInterval は「時間の正本」ではなく、
表示更新用にだけ使う。

---

# 25. 実装時の重要ルール

1. Cargo Bay に別Timer Engineを作らない
2. 既存Hub Timerと共通のセッション状態を使う
3. Timer Widget のタスク選択UIは削除する
4. タスク選択はCargo Bayに一本化する
5. Timer WidgetにはActive Cargo + 工程を表示する
6. Pomoとは業務ロジックを分離
7. Timer停止と工程完了を同義にしない
8. 「中断」と「完了」を明確に分ける
9. 写真カテゴリをハードコードしすぎず Process Template として分離
10. 結婚式だからレタッチなし、など案件種別で工程を固定しない
11. 各工程は案件ごとにON/OFF可能
12. Deadlineは将来の逆算アラート計算に使えるデータ構造にする
13. TimerはstartedAt基準で計算し、画面非Activeでも時間が失われないようにする
14. まずローカル保存でもよい。外部DB接続は後段でよい

---

# 26. 完成条件 — Cargo Bay MVP

以下が動けばMVP完了。

- Cargo一覧が表示できる
- 5列:
  - カテゴリ
  - 案件
  - 現在地
  - 期日
  - デッドライン
- Cargo追加・編集ができる
- Category = 写真 で写真工程が表示される
- 写真工程を案件単位でON/OFFできる
- Cargoから工程選択 → STARTできる
- Timer Widget のタスク選択UIがなくなっている
- Timer Widget に実行中の案件名が表示される
- Timer Widget に実行中の工程名が表示される
- Timer Widgetで時間が動く
- 画面が非Activeでも経過時間がずれない
- Cargoから中断できる
- Cargoから完了できる
- Timer Widgetからも中断できる
- Timer Widgetからも完了できる
- 中断では現在地が「○○中」のまま
- 完了では「○○済」へ進む
- Work Sessionsに時間が残る
- Pomoが25分/5分に到達しても自動遷移しない
- Pomo到達だけで工程ステータスが変わらない
- 中断でBreak開始、Cargo Bayからの手動STARTでFocus再開
- Deadline危険度の最低限の算出ができる

---

# 27. 今回は後回しでよいもの

- Notion DB連携
- Cloud DB
- 複数端末同期
- 自動学習による工数推定
- 詳細な工数グラフ
- 外注先管理
- 通知Push
- AIによる自動工程判定
- 写真以外のProcess Template実装

---

# 28. 設計思想

Cargo Bay は、

```text
何をやるか
```

を決める場所。

Process は、

```text
そのCargoのどの工程をやるか
```

を表す。

Hub Timer は、

```text
今なにをやっていて、実際に何分使ったか
```

を表示・記録する。

Deadline Engine は、

```text
このペースで間に合うか
```

を判断する。

この4つを分離する。

```text
Cargo
↓
Category / Process
↓
Work Session
↓
Deadline Engine
```

Hub Terminal全体として、
画面ごとに同じ機能を複製せず、
同じEngineを必要な場所から操作する構造を優先する。

---

# v4 追補 — Pomodoro / Focus Session

Pomodoro は Work Timer から完全分離する。Cargo の START は Pomodoro を開始しない。

操作は Timer Widget の POMO ボタンだけで行う。

```text
OFF --POMO--> Focus 25:00
Focus --BREAK--> Break 5:00
Break --FOCUS--> Focus 25:00（毎回リセット）
```

- 25分到達で自動 Break しない。以後 `+mm:ss` で超過表示。
- 5分到達で自動 Focus しない。以後 `+mm:ss` で超過表示。
- Break 中も Work Timer は、Cargo の作業セッションが生きている限り加算を続ける。
- Cargo START は Pomo 状態を変更しない。
- Cargo 中断 / 完了は Work Session を閉じ、Pomo が動いていれば OFF / 25:00 初期状態へリセットする。Break への遷移はしない。
- 通知 / 効果音は v4 対象外。

## Focus Session 計測

Pomo の Focus フェーズだけを `hub-focus-sessions-v1` に独立記録する。

```js
{
  id,
  startedAt,
  endedAt,
  durationSec,
  endReason,
  workSessionId,
  cargoId,
  cargoTitle,
  stage,
  stageLabel
}
```

これにより、Work Session（拘束・作業時間）と Focus Session（集中モード時間）を別指標として集計できる。

例:
```text
Work: 2:12:00
Focus: 1:18:00
```

Focus は Pomo を開始した時点の active Cargo / 工程へ紐付ける。Cargo が無い状態でも Pomo 単独利用は可能で、その場合関連IDは null。

Pomo state は `hub-pomo-state-v1` に保持し、時刻差分で表示する。iframe / tab が非アクティブでも、復帰時に経過時間を再計算する。

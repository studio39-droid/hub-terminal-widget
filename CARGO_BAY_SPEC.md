# Hub Terminal — Cargo Bay / Timer v5 統合仕様

更新日: 2026-09-07  
実装主担当: えみ（ChatGPT）  
監査 / GitHub: クロちゃん（Claude Code）

## 1. v5の正本

v5では Cargo Bay と Hub Timer を別機能として設計しない。同じ Session Engine を異なるUIから操作する。

時間は4層に分ける。

```text
Task累計
  └─ Work Session #1
       ├─ Work
       ├─ Break
       └─ Focus
  └─ Work Session #2
       ├─ Work
       ├─ Break
       └─ Focus
```

- Task累計: 同じCargo / 工程の全SessionのWorkを日跨ぎで合算
- Work Session: 今回の作業のまとまり。■で閉じる
- Work: Session内で実際に作業している時間
- Break: Sessionは開いたままWorkを止めている時間
- Focus: Pomo Focusとして手動計測した集中時間

**Sessionを閉じてもTask累計はゼロにならない。**

## 2. Cargo Bay

Cargo Bayは「何をやるか / どの工程をやるか」を決める場所。

写真工程:

```text
セレクト → 現像 → レタッチ → デザイン → 入稿 → 納品
```

各工程は案件単位でON/OFF可能。

一覧:

```text
カテゴリ | 案件 | 現在地 | 期日 | デッドライン
```

### Cargo START

- Sessionが無ければ新しいWork Sessionを作る
- Workを開始
- Cargo現在地を `○○中` にする
- Pomoには触らない

同じCargo / 同じ工程のSessionがBreak中ならSTARTはWork再開として扱う。

### Cargo 中断

- Workを停止
- SessionをBreakへ移す
- **Sessionは閉じない**
- Cargo現在地は `○○中` のまま
- Pomoが動作中ならOFFへ止める

### Cargo 完了

- 現在工程を `○○済` にする
- 開いているSessionをCloseする
- Work / Break / Focusを保存
- Task累計は過去Sessionと合算して残る

## 3. Hub Timer操作

上段:

```text
[ Active Cargo / Stage ] [ POMO ] [ ▶ ] [ ⏸ ] [ ■ ]
```

- POMO: Pomodoro ON/OFF
- ▶: Break中のWorkを再開。Pomoは自動再開しない
- ⏸: Work中断。Sessionは継続。PomoはOFF
- ■: Session Close。Cargo工程は完了させない

Timer側にタスク選択は持たせない。新規Session開始はCargo Bayが入口。

## 4. ■ Session Close

例:

```text
14:00 Cargo START
14:30 ⏸
14:40 ▶
15:10 ■
```

保存:

```text
Started  14:00
Ended    15:10
Session  1:10:00
Work     1:00:00
Break    0:10:00
Focus    実測値
```

■はTask / 工程の完了ではない。

保存順序:

```text
■
↓
Session record upsert
↓
Cargo state更新
↓
Active Session解除
↓
Timer初期化
```

保存失敗時はActive Sessionを消さない。Session IDでupsertするため、Retry時に同じログを二重追加しない。

MVPの保存先はlocalStorage。将来Cloudflare Worker → Notion Work Sessions DBへ差し替える。

## 5. Task累計

Work Session保存値をCargo単位 / 工程単位で合算する。

例:

```text
9/7 現像 Session #1  Work 1:00
9/8 現像 Session #2  Work 1:52
9/9 現像 Session #3  Work 1:40
-------------------------------
現像 Task累計          Work 4:32
```

Cargo詳細に最低限:

- 累計 Work
- 累計 Focus
- Session件数

を表示する。

## 6. Pomo

PomoはWork / Cargo状態から独立した補助タイマー。

- Cargo STARTでPomoを開始しない
- ▶でPomoを再開しない
- Pomo Focus中に⏸した場合、Focusを閉じてPomo OFF
- Break中もWorkが動いているケースは可能（Pomo Breakを手動で開始した場合）
- Focus / Break到達で自動遷移しない
- 通知 / 効果音は保留

### POMO ON/OFF

- OFF → POMO: Focus開始
- ON → POMO: OFF

### Focus / Break 手動切替

`F/B`で手動切替。

```text
Focus → Break
Break → Focus
```

モードを切り替えた瞬間にそのフェーズの開始時刻を現在時刻へ置く。したがってBreak→Focusは新しいFocus時間から開始する。

### Focus / Break時間変更

Focus候補:

```text
15 / 20 / 25 / 30 / 45 / 60 分
```

Break候補:

```text
5 / 10 / 15 / 20 分
```

**Duration変更ではstartedAtを変えない。**

例:

```text
Break 5分開始
3分経過
Break 20分へ変更
→ 残り17分
```

### POMO ↻

現在のFocus / Breakだけを今からやり直す。

- Focusなら現在時刻から設定Focus時間
- Breakなら現在時刻から設定Break時間

### WORK ↻

現在SessionのWork時間だけ0へ戻す。

- Session開始時刻は変えない
- Break累計は変えない
- Pomoには触らない
- まだ保存されていない現在SessionのWork値だけリセット

## 7. 0:00 / 超過

Focus / Breakとも自動遷移しない。

```text
00:02
00:01
00:00
点滅 約5回
+00:01
+00:02
```

0:00通過時に画面がActiveな場合だけ点滅する。

iframe / tabが非Activeで0:00を通過した場合、復帰後は実時間差から即 `+mm:ss` を表示し、遅れて点滅しない。

## 8. 時間の正本

tick回数は時間の正本にしない。

Active Session:

```js
{
  sessionId,
  cargoId,
  cargoTitle,
  category,
  stage,
  stageLabel,
  sessionStartedAt,
  phase: 'work' | 'break',
  phaseStartedAt,
  workAccumSec,
  breakAccumSec
}
```

Work表示:

```text
workAccumSec + (phase === work ? now - phaseStartedAt : 0)
```

Breakも同様。

setIntervalは表示更新だけに使う。

## 9. Work Session record

v5新規レコード:

```js
{
  id,
  cargoId,
  cargoTitle,
  category,
  stage,
  stageLabel,
  startedAt,
  endedAt,
  sessionDurationSec,
  workDurationSec,
  breakDurationSec,
  focusDurationSec,
  endReason,
  stageCompleted
}
```

v4以前の `durationSec` レコードもTask累計でWork時間として読み込めるよう後方互換を持つ。

## 10. Focus Session

`hub-focus-sessions-v1` は維持。

Focusごとに:

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

を残す。

Work Session Close時に同じ `workSessionId` のFocus Sessionを合算し、`focusDurationSec`としてWork Sessionにもスナップショットする。

## 11. v4からの移行

v4のActive Sessionは以下の形だった。

```js
{ sessionId, cargoId, ..., startedAt }
```

v5読み込み時に自動で:

```text
sessionStartedAt = startedAt
phase = work
phaseStartedAt = startedAt
workAccumSec = 0
breakAccumSec = 0
```

へ移行する。

既存Work Sessionログは削除しない。

## 12. rawDeadlineText

seed Cargoの:

```js
rawDeadlineText: '期限9/9'
```

は期日 / デッドラインのどちらか未確定なので勝手に分類しない。

v5ではCargo一覧と詳細に:

```text
期限9/9（未分類）
```

として可視化する。

ユーザーが期日またはデッドラインを明示保存したらrawDeadlineTextを消す。

## 13. Deadline Engine

v4の5段階を維持。

```text
safe / watch / warning / critical / overdue
```

写真工程の仮工数による残作業推定も維持。今回はDeadlineロジックの意味変更をしない。

## 14. v5で触らないもの

- Clock
- Weather
- Vocabulary
- Notion API / Cloudflare Worker本実装
- 通知 / 効果音

Clock / Weather / Vocabularyは回帰禁止。

## 15. 次段

v5ローカルSession Engine安定後:

```text
■ Close
  ↓
Cloudflare Worker
  ↓
Notion Work Sessions DB
```

へ保存Sinkを差し替える。

Notion保存成功後だけActive SessionをResetする契約はv5 localStorage実装と同じにする。

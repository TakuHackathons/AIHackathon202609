# Empathy AI Companion

教育機関向けのAI相談サービスです。利用者の質問にAIが回答し、VOICEVOXで生成した音声に合わせて3Dキャラクターが発話します。教員向け管理画面では、学校、教員、施設、学生、授業、出欠、学校規則、進路資料、イベントを管理できます。

## 必要なもの

- Node.js
- pnpm
- Docker
- Cloudflareアカウント
- OrcaRouter APIキー

## ローカル環境の起動

### 1. 依存パッケージをインストールする

プロジェクトルートで実行します。

```sh
pnpm install
```

### 2. 環境変数を設定する

`server/.env.example`を`server/.env`へコピーし、必要な値を設定します。

```env
ORCAROUTER_API_KEY=your-api-key
VOICEVOX_API_ROOT_URL=http://127.0.0.1:50021
```

### 3. ローカルD1を準備する

初回起動時はマイグレーションとseedを実行します。

```sh
pnpm --filter empathy-ai-companion-server db:migrate:local
pnpm --filter empathy-ai-companion-server db:seed:local
```

DBを作り直す場合は、ローカルD1をリセットしてからseedを登録します。

```sh
pnpm --filter empathy-ai-companion-server db:migrate:reset
pnpm --filter empathy-ai-companion-server db:seed:local
```

### 4. VOICEVOXを起動する

```sh
docker pull voicevox/voicevox_engine:cpu-latest
docker run --rm --name empathy-ai-companion-voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
```

### 5. APIサーバーを起動する

別のターミナルで実行します。

```sh
pnpm dev:server
```

APIサーバーは`http://127.0.0.1:8787`で起動します。

### 6. Webフロントエンドを起動する

別のターミナルで実行します。

```sh
pnpm dev:web
```

ブラウザで`http://localhost:3000`を開きます。管理画面は`http://localhost:3000/admin/`です。

## seedデータ

| 項目       | 値              |
| ---------- | --------------- |
| 学校名     | `Sample School` |
| 学校コード | `SAMPLE-SCHOOL` |

| 表示名             | super adminユーザー名 | パスワード                     |
| ------------------ | --------------------- | ------------------------------ |
| Operations Admin   | `super-admin`         | `initial-super-admin-password` |
| Operations Admin 2 | `super-admin-2`       | `initial-super-admin-password` |
| Operations Admin 3 | `super-admin-3`       | `initial-super-admin-password` |

3人はそれぞれのユーザー名とパスワードでログインした後にPasskeyを登録します。Passkey登録後は、そのユーザーの発行済みパスワードが無効になります。

## 管理画面

| URL                 | 操作                                      |
| ------------------- | ----------------------------------------- |
| `/admin/schools`    | 学校の参照・登録・編集                    |
| `/admin/teachers`   | 教員の参照・招待・編集・削除              |
| `/admin/facilities` | 施設情報と営業状態の管理                  |
| `/admin/students`   | 学生番号、性格、配慮事項、タグの管理      |
| `/admin/courses`    | 学期、担当教員、授業、時間割の管理        |
| `/admin/attendance` | 出欠登録とCSV取込                         |
| `/admin/resources`  | 規則、進路資料、イベント、PDFの管理と検索 |
| `/admin/settings`   | Passkeyの追加・削除                       |

super adminで複数学校のデータを操作する場合は、各画面上部の学校選択欄から対象校を選択します。

### Passkeyと端末の追加

ログイン中の教員は、`/admin/settings`の「この端末にPasskeyを追加」から現在の端末、スマートフォン、またはセキュリティキーにPasskeyを追加できます。既存のPasskeyは削除されません。

別の端末へ追加する場合は、次のいずれかの方法で登録します。

- 本人が`/admin/settings`から別端末用のパスワードを発行し、別の端末でユーザー名とパスワードを入力します。このパスワードは15分間有効です。
- super adminが`/admin/teachers`から任意の学校の教員に登録用パスワードを発行します。
- adminが`/admin/teachers`から所属校の教員に登録用パスワードを発行します。

管理者用の登録用パスワードは自動生成され、24時間有効です。発行結果のコピーボタンからパスワードをコピーして対象の教員へ共有します。登録用パスワードからPasskeyを追加しても、すでに登録されているPasskeyは維持されます。「すべてのPasskeyをリセット」は端末紛失時に使用し、対象教員の既存Passkeyを削除します。

### 教育データを登録する順序

1. `/admin/facilities`で教室などの施設と営業時間を登録します。
2. `/admin/students`で学生番号、性格、配慮事項、検索タグを登録します。
3. `/admin/courses`の「Academic terms and periods」を開き、学期と時限を登録します。
4. 同じ画面で授業と担当教員を登録し、「Schedule」から通常時間割と日付ごとの授業回を登録します。施設を使わない授業では施設を未選択にできます。
5. `/admin/attendance`で授業回ごとの出欠を登録するか、CSVを取り込みます。
6. `/admin/resources`で学校規則、進路資料、イベントを登録します。外部URLとPDFはどちらも任意です。

一般教員には、自分が担当する授業だけが表示されます。授業の登録・変更、受講学生の登録、授業回と出欠の登録・変更ができます。学期・時限の設定と削除操作は`admin`以上が行います。

### 施設の営業状態

施設の現在状態は次の優先順位で判定されます。

1. 有効期間内の手動上書き
2. 当日の日付指定例外
3. 曜日ごとの通常営業時間
4. 該当する営業時間がなければ閉鎖中

判定には学校に設定されたタイムゾーンを使用します。

### 出欠CSV

管理画面の`/admin/attendance`で授業を選択し、CSVファイルを取り込みます。

```csv
student_number,course_session_id,status,note
S0001,12,present,
S0002,12,late,交通機関の遅延
S0003,12,excused,公欠
```

`status`には次の値を指定します。

| 値        | 内容 |
| --------- | ---- |
| `present` | 出席 |
| `late`    | 遅刻 |
| `absent`  | 欠席 |
| `excused` | 公欠 |

取込に失敗した行は、行番号と理由が画面に表示されます。正常な行は、ほかの行にエラーがあっても登録されます。

### 教員・施設・学生・授業・資料のCSV取込

各管理画面の「CSV取込」を開き、「テンプレートをダウンロード」からCSV形式を確認できます。CSVは2 MBまでで、教員は100行、その他は500行まで取り込めます。同じ識別キーの行は更新され、新しい行は登録されます。

一連のデータを試す場合は、[CSV取込サンプル](samples/csv/README.md)を参照してください。教員・施設・学生・授業と通常時間割・資料について、相互に整合するCSVを用意しています。

| 管理画面     | 必須列                              | 識別キー                   |
| ------------ | ----------------------------------- | -------------------------- |
| 教員         | `username,name`                     | ユーザー名                 |
| 施設         | `name`                              | 学校内の施設名             |
| 学生         | `student_number`                    | 学校内の学生番号           |
| 授業・時間割 | `course_code,course_name,term_name` | 学期内の授業コード         |
| 資料         | `kind,title`                        | 学校内の資料種別とタイトル |

教員CSVでは`email`と`role`も指定できます。`role`は`general`または`admin`です。`admin`を指定できるのはsuper adminだけです。新規教員に発行されたユーザー名とパスワードは、取込結果に表示されます。

学生の`tags`には、複数のタグを`|`で区切って指定します。

授業CSVで通常時間割も登録する場合は、次の列も指定します。

```text
teacher_username,description,weekday,period_number,facility_name,valid_from,valid_to,location_note
```

`weekday`は日曜日を`0`、月曜日を`1`として、土曜日の`6`までを指定します。CSV取込前に、管理画面で学期、時限、担当教員、必要な施設を登録してください。一般教員が取り込む場合、担当教員はログイン中の教員に固定されます。

資料の`kind`には`rule`、`career`、`event`、`other`のいずれかを指定します。

取込に失敗した行は行番号と理由が表示され、正常な行は登録されます。

### PDF本文検索

規則、進路資料、イベントにはPDFを添付できます。PDFの本文はアップロード時に抽出され、D1のFTS5検索対象へ自動登録されます。管理画面の資料検索と一般画面のAI回答で参照されます。

## 権限

| role          | 操作範囲                                                 |
| ------------- | -------------------------------------------------------- |
| `super_admin` | 全学校の登録・編集、全教員と教育データの管理             |
| `admin`       | 所属校、所属教員、施設、学生、授業、出欠、資料の管理     |
| `general`     | 所属校データの参照、自分が担当する授業と出欠の登録・変更 |

`admin`を付与できるのは`super_admin`だけです。学校の削除は管理画面から実行できません。

学校を削除する場合は、対象環境を明示してスクリプトを実行します。

```sh
pnpm --filter empathy-ai-companion-server delete:school -- <school-id> --local
pnpm --filter empathy-ai-companion-server delete:school -- <school-id> --remote
```

## Cloudflareへのデプロイ

D1とR2のbindingを`server/wrangler.jsonc`へ設定してから実行します。

```sh
pnpm --filter empathy-ai-companion-server exec wrangler d1 create empathy-ai-companion-admin
pnpm --filter empathy-ai-companion-server db:migrate:remote
pnpm --filter empathy-ai-companion-server db:seed:remote
pnpm --filter empathy-ai-companion-server exec wrangler secret put ORCAROUTER_API_KEY
pnpm --filter empathy-ai-companion-server exec wrangler secret put VOICEVOX_API_ROOT_URL
pnpm deploy:cloudflare
```

## 検証

```sh
pnpm lint
pnpm test
pnpm build
pnpm deploy:check
```

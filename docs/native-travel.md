# 端末と現実の旅をつなぐ設計

現在のWeb版では、本人が「現在地から候補を探す」を押すと、前面で最大60秒だけGPSを使う。速度と標高差で徒歩・自転車・登山の候補を出す。富山では直近3点を市内バス・路面電車の公開GTFS経路と照合し、候補が重なる場合は判定を保留する。掲載名所に近い場合は地名を提示する。徒歩などの候補が出ない低速の測位では観光を候補にする。動きセンサーは別の許可で参考の揺れを示す。本人が確認した活動だけを保存し、本体の仕草は候補・確認内容に応じて変わる。Web版の歩数は本人入力。端末の健康データの読出しや裏側での継続測位は未接続。

## Android

Health Connectの利用可否を端末で確認し、歩数を希望した利用者だけに `READ_STEPS` を要求する。集計APIで日別件数を取得し、端末とウェアラブルの重複はHealth Connectの集計に委ねる。バックグラウンドでの歩数読出しは対応端末の機能確認と `READ_HEALTH_DATA_IN_BACKGROUND` を別の許可として扱う。履歴読出しはOSが許可する範囲が基準で、広い履歴への権限は初期導入から分離する。

旅の記録を開始すると、位置を使うフォアグラウンドサービスで通知と停止手段を提供する。継続取得の状況・OSバージョンに応じて権限とGoogle Play審査が関係する。OSによる終了時は記録を中断として扱い、機器の再起動で自動的に追跡し始めない。

- [Health Connectで歩数を取得する](https://developer.android.com/health-and-fitness/health-connect/features/steps)
- [Health Connectのバックグラウンド権限](https://developer.android.com/codelabs/health-connect)
- [Androidのバックグラウンド位置情報](https://developer.android.com/develop/sensors-and-location/location/permissions/background)
- [フォアグラウンドサービスの種類](https://developer.android.com/develop/background-work/services/fgs/service-types)

## iOS

HealthKit capabilityと歩数の読取理由 `NSHealthShareUsageDescription` を用意する。HealthKitの stepCount を統計クエリで日別に集計する。歩数データの変化を受け取る場合は `HKObserverQuery` とバックグラウンド配信用のentitlementを使う。通知後に集計し直す。通知時刻を報酬条件にしない。

Core Locationは、開始・停止が見える旅セッションを設け、前面の許可を最初に得る。継続利用ではLocation Updatesの設定とOSの要件を確認し、対応OSでは `CLBackgroundActivitySession` を検討する。省電力で測位頻度を変え、位置の精度が低ければ保留にする。実際の動作はテスト対象の端末とOSで確認する。

- [HealthKit observer queries](https://developer.apple.com/documentation/healthkit/executing-observer-queries)
- [HealthKitのバックグラウンド配信](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.healthkit.background-delivery)
- [Core Locationのバックグラウンド更新](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)

## 共通データと検証

ネイティブ側のOS連携から受け取る日別データは `{day,timeZone,count,source}`。受信時刻やログイン回数を使わず、同じ利用者・日・報酬の種類の組で一度だけコインを付与する。過去日の記録も受け付け、歩数不足による減点や受取期限を置かない。OSからの再送、複数端末、目標変更、タイムゾーン変更を試験する。

測位と歩数は個別同意。測位の生データは原則端末内に置き、移動推定を本人が確認した後に活動種別・日付・選んだ粗い地域を扱う。共有する投稿やおとも募集に正確なリアルタイムの位置を含めない。歩数と健康情報は公開プロフィール、募集、広告に使わない。GPSなし・精度不足の場合でも手入力できる。端末の許可を撤回でき、OSの設定変更後の再起動でも反映する。

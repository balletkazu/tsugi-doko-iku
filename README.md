# つぎ どこ行く？

旅の写真、日記、栞を分かち合うスマートフォン向けウェブアプリです。

- [開発仕様書](docs/product-spec.md)
- [アーキテクチャと開発計画](docs/architecture.md)
- [試遊・検証・デプロイ](docs/preview.md)
- [写真の出典と利用条件](docs/photo-credits.md)
- [コミュニティの開発計画](docs/community-roadmap.md)
- [乗換検索の比較と開発計画](docs/transit-evaluation.md)
- [旅の部屋、旅人タイプ、写真集](docs/experience-preview.md)
- [富山市の経路検索試作](docs/toyama-pilot.md)
- [コミュニティのデータベース](docs/community-database.md)

## 開発環境

Node.js 22 以上を使います。追加の npm パッケージと API キーは不要です。

```sh
npm test
npm run build
npm run dev
```

開発サーバーは `http://localhost:3000` で `dist/` を配信します。ブラウザー用ソースは `public/` です。ルート直下の `index.html`、`index-1.html`、`index-2.html`、`travel-v03.html` はアプリの参考になった試作版です。

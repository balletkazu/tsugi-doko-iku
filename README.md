# つぎ どこ行く？

心が動く風景から、次の旅へ。旅先を見つけ、公共交通での行き方を考え、自分のペースで旅を記録するスマートフォン向けウェブアプリです。

- [開発仕様書](docs/product-spec.md)
- [アーキテクチャと開発計画](docs/architecture.md)
- [試遊・検証・デプロイ](docs/preview.md)

## 開発環境

Node.js 22 以上を使います。追加の npm パッケージと API キーは不要です。

```sh
npm test
npm run build
npm run dev
```

開発サーバーは `http://localhost:3000` で `dist/` を配信します。ブラウザー用ソースは `public/` です。ルート直下の `index.html`、`index-1.html`、`index-2.html`、`travel-v03.html` はアプリの参考になった試作版です。

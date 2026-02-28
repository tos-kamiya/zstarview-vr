# zstarview-vr

空の見え方を表示する WebVR アプリです（デフォルト観測地点: 東京）。

GitHub Pages（Quest 3 など対応デバイス・ブラウザ向け）:

- https://tos-kamiya.github.io/zstarview-vr/

上記 URL を開くことで利用できます。

## スクリーンショット

デスクトップモード（`?view=fisheye180`）:

![Desktop fisheye 180 screenshot](./imgs/browser-fisheye180.png)

## 使い方（VRモード）

1. アプリを開く:
   - https://tos-kamiya.github.io/zstarview-vr/
2. 必要に応じて URL パラメータで観測地点を指定:
   - `?lat=35.465&lon=133.051`
   - `?city=Tokyo`
   - `?city=Matsue&country=JP`
3. VR を開始:
   - `Enter VR` を押す
   - ユーザーの前方に約 3 秒、地点情報のスプラッシュが表示されます

地点解決の優先順位:

1. `lat` + `lon`（有効な場合）
2. `city`（都市インデックスを遅延読み込みして検索）
3. デフォルト（`Tokyo`）

`city` が見つからない場合（または都市インデックスの読み込み失敗時）は、デフォルト（`Tokyo`）にフォールバックします。
その理由はステータスとスプラッシュに明示されます。
`country` を指定した場合は、その国コード（ISO 3166-1 alpha-2、例: `JP`, `US`）で都市検索を絞り込みます。

## 使い方（デスクトップモード）

1. `?view=fisheye180` を付けて開く:
   - `https://tos-kamiya.github.io/zstarview-vr/?view=fisheye180`
2. 矢印キー操作:
   - `←/→` で方位
   - `↑/↓` で仰角

## ライセンス

このプロジェクトは MIT License で提供されています。

- [LICENSE](./LICENSE)

データソースのライセンス（zstarview データセット由来）:

- 都市名データ（`data/cities1000.txt`）: GeoNames dump  
  Source: https://download.geonames.org/export/dump/  
  License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- 恒星カタログ（生成元データ）: Hipparcos and Tycho Catalogues (ESA 1997) via CDS Strasbourg  
  Source: https://cdsarc.cds.unistra.fr/ftp/I/239/  
  zstarview 側のライセンス注記: ODbL または CC BY-NC 3.0 IGO（非商用）

## 開発者向け情報

ビルド・開発・セットアップの詳細は以下を参照してください。

- [DEVELOPER_NOTES.md](./DEVELOPER_NOTES.md)

## 謝辞

このプロジェクトは OpenAI GPT-5（Codex）の支援を受けて開発されました。

# zstarview-vr

空の見え方を表示する WebVR アプリです（デフォルト観測地点: 東京）。

GitHub Pages（Quest 3 など対応デバイス・ブラウザ向け）:

- https://tos-kamiya.github.io/zstarview-vr/

上記 URL を開くことで利用できます。

## クイックリンク

- デフォルト:
  - [デフォルトURLを開く](https://tos-kamiya.github.io/zstarview-vr/)
- 拡張恒星表示（`maxMag=7`）:
  - [`maxMag=7`で開く](https://tos-kamiya.github.io/zstarview-vr/?maxMag=7)
- 拡張恒星表示（`maxMag=8`）:
  - [`maxMag=8`で開く](https://tos-kamiya.github.io/zstarview-vr/?maxMag=8)
- 拡張恒星表示（`maxMag=9`）:
  - [`maxMag=9`で開く](https://tos-kamiya.github.io/zstarview-vr/?maxMag=9)

主要都市（約20件）:

- [Tokyo, JP](https://tos-kamiya.github.io/zstarview-vr/?city=Tokyo&country=JP)
- [Osaka, JP](https://tos-kamiya.github.io/zstarview-vr/?city=Osaka&country=JP)
- [Matsue, JP](https://tos-kamiya.github.io/zstarview-vr/?city=Matsue&country=JP)
- [Seoul, KR](https://tos-kamiya.github.io/zstarview-vr/?city=Seoul&country=KR)
- [Beijing, CN](https://tos-kamiya.github.io/zstarview-vr/?city=Beijing&country=CN)
- [Shanghai, CN](https://tos-kamiya.github.io/zstarview-vr/?city=Shanghai&country=CN)
- [Taipei, TW](https://tos-kamiya.github.io/zstarview-vr/?city=Taipei&country=TW)
- [Singapore, SG](https://tos-kamiya.github.io/zstarview-vr/?city=Singapore&country=SG)
- [Bangkok, TH](https://tos-kamiya.github.io/zstarview-vr/?city=Bangkok&country=TH)
- [Delhi, IN](https://tos-kamiya.github.io/zstarview-vr/?city=Delhi&country=IN)
- [Dubai, AE](https://tos-kamiya.github.io/zstarview-vr/?city=Dubai&country=AE)
- [Cairo, EG](https://tos-kamiya.github.io/zstarview-vr/?city=Cairo&country=EG)
- [London, GB](https://tos-kamiya.github.io/zstarview-vr/?city=London&country=GB)
- [Paris, FR](https://tos-kamiya.github.io/zstarview-vr/?city=Paris&country=FR)
- [Berlin, DE](https://tos-kamiya.github.io/zstarview-vr/?city=Berlin&country=DE)
- [Istanbul, TR](https://tos-kamiya.github.io/zstarview-vr/?city=Istanbul&country=TR)
- [New York, US](https://tos-kamiya.github.io/zstarview-vr/?city=New%20York&country=US)
- [Los Angeles, US](https://tos-kamiya.github.io/zstarview-vr/?city=Los%20Angeles&country=US)
- [Mexico City, MX](https://tos-kamiya.github.io/zstarview-vr/?city=Mexico%20City&country=MX)
- [Sao Paulo, BR](https://tos-kamiya.github.io/zstarview-vr/?city=Sao%20Paulo&country=BR)

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

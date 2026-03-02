# zstarview-vr

AI支援により開発された Python 製星空ビューア「zstarview」を
WebXR へ移植する実験的プロトタイプです。

GitHub Pages 上で体験できます（Quest 3 などの対応デバイス／ブラウザ向け）：

https://tos-kamiya.github.io/zstarview-vr/

本リポジトリは、デスクトップ版（Python/Qt）から
ブラウザベースの没入型プロトタイプへの移行を進める
過程のマイルストーン・スナップショットです。

元のデスクトップアプリケーション：  
https://github.com/tos-kamiya/zstarview （Python/Qt 版）

## クイックリンク

- デフォルト:
  - [デフォルトURLを開く](https://tos-kamiya.github.io/zstarview-vr/)
- 拡張恒星表示（`maxMag=7`）:
  - [`maxMag=7`で開く](https://tos-kamiya.github.io/zstarview-vr/?maxMag=7)
- 拡張恒星表示（`maxMag=8`）:
  - [`maxMag=8`で開く](https://tos-kamiya.github.io/zstarview-vr/?maxMag=8)
- 拡張恒星表示（`maxMag=9`）:
  - [`maxMag=9`で開く](https://tos-kamiya.github.io/zstarview-vr/?maxMag=9)
- 拡張恒星表示（`maxMag=10`）:
  - [`maxMag=10`で開く](https://tos-kamiya.github.io/zstarview-vr/?maxMag=10)
  - 注意: データサイズが極端に大きいため、実用というよりベンチマーク用途向けです。

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

## スクリーンショット & 動画

**Quest 3 -- ビデオキャプチャ(YouTube)**

[![Watch on YouTube – zstarview-vr demo](./imgs/thumb-DuhdbugqAIg.png)](https://www.youtube.com/watch?v=DuhdbugqAIg)

**デスクトップ（Webブラウザ版）**

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
4. VR 中の操作補助:
   - Quest 3 では左右どちらかのコントローラのメニューボタンで、有名恒星メニューを表示/非表示にできます。パネルは手元近傍に浮かび、もう一度メニューボタンを押すと閉じます。VR を抜けるとパネルは自動で閉じます。
   - デスクトップ環境では `M` キーでも同じパネルが開けるので、ヘッドセットなしで挙動を確認できます。
地点解決の優先順位:

1. `lat` + `lon`（有効な場合）
2. `city`（都市インデックスを遅延読み込みして検索）
3. デフォルト（`Tokyo`）

`city` が見つからない場合（または都市インデックスの読み込み失敗時）は、デフォルト（`Tokyo`）にフォールバックします。
その理由はステータスとスプラッシュに明示されます。
`country` を指定した場合は、その国コード（ISO 3166-1 alpha-2、例: `JP`, `US`）で都市検索を絞り込みます。

## 新機能: 有名恒星へのジャンプ（VR）

VR版では既存の操作思想（ユーザー自身が向きを変える）を維持し、視点や天球の強制回転は行いません。

- **使い方**: 左右どちらかのVRコントローラの「メニューボタン」（デスクトップでは 'M' キー）を押すと、恒星選択メニューが開きます。
- **ナビゲーション**: コントローラのサムスティックを上下に倒す（デスクトップでは上下矢印キー）ことで、リストから恒星を選択できます。
- **プレビュー機能**: メニュー操作中、視界の中心から現在選択されている恒星に向かって、空間上に大円弧（アーチ）が動的に描画されます。また、目標の恒星は水色のサークルマーカーで強調表示されます。
- **メニューを閉じる**: もう一度メニューボタンを押す（デスクトップでは Enter キー）と閉じます。

## 使い方（デスクトップモード）

1. `?view=fisheye180` を付けて開く:
   - https://tos-kamiya.github.io/zstarview-vr/?maxMag=10&view=fisheye180
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
- 恒星カタログ（生成元データ）: Hipparcos and Tycho Catalogues (ESA 1997) および Tycho-2 Catalogue (Hog et al. 2000), via CDS Strasbourg  
  Source（Hipparcos/Tycho）: https://cdsarc.cds.unistra.fr/ftp/I/239/  
  Source（Tycho-2）: https://cdsarc.cds.unistra.fr/ftp/I/259/  
  zstarview 側のライセンス注記: ODbL または CC BY-NC 3.0 IGO（非商用）

## 開発者向け情報

ビルド・開発・セットアップの詳細は以下を参照してください。

- [DEVELOPER_NOTES.md](./DEVELOPER_NOTES.md)

## 謝辞

このプロジェクトは Google Gemini 3 および OpenAI GPT-5（Codex）の支援を受けて開発されました。

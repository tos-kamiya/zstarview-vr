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
   - Quest 3 では左右どちらかのコントローラのメニューボタンで、灰色ベースのワールド固定メニューを表示/非表示にできます。パネルは、開いたコントローラに応じて視界前方のやや左または右に表示されます。もう一度メニューボタンを押すと閉じ、VR を抜けると自動で閉じます。
   - デスクトップ環境では `M` キーでも同じパネルが開けるので、ヘッドセットなしで挙動を確認できます。
地点解決の優先順位:

1. `lat` + `lon`（有効な場合）
2. `city`（都市インデックスを遅延読み込みして検索）
3. デフォルト（`Tokyo`）

`city` が見つからない場合（または都市インデックスの読み込み失敗時）は、デフォルト（`Tokyo`）にフォールバックします。
その理由はステータスとスプラッシュに明示されます。
`country` を指定した場合は、その国コード（ISO 3166-1 alpha-2、例: `JP`, `US`）で都市検索を絞り込みます。

## 新機能: VRメニュー / 有名恒星へのジャンプ

VR版では既存の操作思想（ユーザー自身が向きを変える）を維持し、視点や天球の強制回転は行いません。

- **使い方**: 左右どちらかのVRコントローラの「メニューボタン」（デスクトップでは `M` キー）を押すとメニューが開きます。
- **トップレベル項目**: 現在は `Jump to Star`、`Display Options`、`About` を用意しています。
- **ホバーと選択**: VR ではメニュー項目にポインタを合わせてホバーし、トリガーで決定します。ホバー中と選択済みでは見た目が変わります。
- **Display Options**:
  - `Asterisms` でアステリズムの常時線とホバー強調を切り替えられます。
  - `DSO` で深宇宙天体のマーカーとラベルを切り替えられます。
  - 各トグルの現在値は `☑` / `☐` で表示されます。
- **Jump to Star の挙動**:
  - 恒星リストを開いた直後は、まだ何も選択されていません。
  - 未選択状態では、メニュー上でホバーしている恒星に向かってアーチとターゲットマーカーが表示されます。
  - 恒星に対してトリガーを押すと、その恒星が選択され、メニューを閉じるまでアーチとマーカーはその恒星に固定されます。
- **メニューを閉じる**: もう一度メニューボタンを押すと閉じます。閉じると Jump to Star の選択状態はクリアされます。

## 新機能: 星座（アステリズム）オーバーレイ（zstarview から移植）

- アステリズムは常時うっすら表示され、有名恒星にポインターを合わせると対応する線パターンを明るく強調表示します。
- 同じ恒星に複数のアステリズムがある場合は、3秒ごとに切り替えて表示します。
- アステリズム定義は zstarview と同じ HIP/source-id ベースで取り込んでいます。

取り込み済みアステリズム:

- 冬: `Winter Triangle`（冬の大三角）, `Orion's Belt`（オリオンの三ツ星）, `Winter Hexagon`（冬のダイヤモンド）, `Southern Cross`（南十字）, `Southern Pointers`（南十字のポインター）, `Diamond Cross`（ダイヤモンドクロス）, `False Cross`（偽南十字）
- 春: `Big Dipper`（北斗七星）, `Little Dipper`（こぐま座のひしゃく）, `Spring Triangle`（春の大三角）, `Arc to Arcturus`（アルクトゥールスへの弧）, `Leo Sickle`（しし座の鎌）, `Southern Triangle`（南の三角）
- 夏: `Summer Triangle`（夏の大三角）, `Northern Cross`（北十字）, `Teapot`（ティーポット）, `Keystone`（ヘルクレスの要石）
- 秋: `Great Square of Pegasus`（ペガススの四辺形）, `Circlet of Pisces`（うお座の環）, `Water Jar of Aquarius`（みずがめ座の水がめ）, `Cassiopeia W`（カシオペヤのW）, `House of Cepheus`（ケフェウスの家）, `Job's Coffin`（ヨブの棺）

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
- 深宇宙天体データ（`public/data/dso.csv`）: OpenNGC（PyOngc 経由）  
  Source: https://github.com/mattiaverga/OpenNGC  
  License: CC BY-SA 4.0

## 開発者向け情報

ビルド・開発・セットアップの詳細は以下を参照してください。

- [DEVELOPER_NOTES.md](./DEVELOPER_NOTES.md)

## 謝辞

このプロジェクトは Google Gemini 3 および OpenAI GPT-5（Codex）の支援を受けて開発されました。

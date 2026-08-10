"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- vinext 배포에서는 안내 페이지 간 이동에 전체 문서 탐색이 필요합니다. */

import { useEffect, useState } from "react";
import { LANGUAGE_OPTIONS, Language, detectLanguage } from "./i18n";
import { APP_VERSION } from "./version";

type PageKind = "guide" | "privacy" | "terms";
type GuideStep = { title: string; body: string; tip: string };
type LegalSection = { title: string; paragraphs?: string[]; bullets?: string[] };
type PageCopy = {
  back: string; guideNav: string; privacyNav: string; termsNav: string; contactNav: string;
  light: string; dark: string; language: string; localFooter: string; updated: string;
  guide: { eyebrow: string; title: string; lead: string; start: string; localTitle: string; localBody: string; flowTitle: string; flow: string[]; stepsTitle: string; stepsLead: string; steps: GuideStep[]; contactTitle: string; contactBody: string; contactButton: string };
  privacy: { eyebrow: string; title: string; lead: string; sections: LegalSection[]; googleLink: string; adsLink: string; cloudflareLink: string };
  terms: { eyebrow: string; title: string; lead: string; sections: LegalSection[] };
};

const CONTACT_URL = "https://github.com/pipeCHeck/260805_PaletteForge/issues";

const COPY: Record<Language, PageCopy> = {
  ko: {
    back: "편집기로 돌아가기", guideNav: "서비스 안내", privacyNav: "개인정보처리방침", termsNav: "이용약관", contactNav: "문의", light: "라이트", dark: "다크", language: "언어 선택", localFooter: "이미지와 영상은 서버로 전송되지 않고 브라우저 안에서 처리됩니다.", updated: "시행일 2026년 8월 7일",
    guide: {
      eyebrow: "PALETTE FORGE GUIDE", title: "이미지와 영상의 색을 원하는 스타일로 다시 설계하세요.", lead: "PaletteForge는 이미지와 영상을 제한된 팔레트와 픽셀 스타일로 변환하는 브라우저 도구입니다. 필요한 색은 정확히 고정하고, 나머지는 원본의 분위기나 색상 다양성에 맞춰 자동으로 구성할 수 있습니다.", start: "이미지·영상 변환 시작하기", localTitle: "원본 이미지와 영상은 이 브라우저 밖으로 나가지 않습니다.", localBody: "불러오기, 디코딩, 색 보정, 픽셀화, 팔레트 계산과 내보내기를 기기 안에서 처리합니다. 원본 미디어와 변환 결과를 PaletteForge 서버나 계정에 업로드하지 않습니다.", flowTitle: "이미지와 영상에 공통으로 적용되는 흐름", flow: ["미디어 입력", "색 보정", "픽셀화", "팔레트 구성", "OKLab 매핑", "파일 내보내기"], stepsTitle: "어떤 작업을 할 수 있나요?", stepsLead: "이미지는 세밀하게 편집하고 여러 장을 내보낼 수 있으며, 영상은 하나의 공통 팔레트 또는 장면에 반응하는 프레임별 팔레트로 변환할 수 있습니다.",
      steps: [
        { title: "이미지 또는 영상을 선택하세요", body: "이미지는 PNG, JPEG, WebP를 여러 장 불러오거나 Ctrl+V로 붙여넣을 수 있습니다. 영상 변환 창에서는 MP4와 WebM 한 개를 선택합니다.", tip: "투명 PNG와 WebM의 알파 채널도 지원 범위 안에서 유지합니다." },
        { title: "색 보정과 픽셀 스타일을 정하세요", body: "밝기, 대비, 채도와 색조를 조절하고 필요하면 픽셀화를 켜 블록 크기와 투명도 방식을 선택합니다.", tip: "보정은 누적되지 않고 항상 원본에서 다시 계산됩니다." },
        { title: "팔레트의 크기와 성향을 정하세요", body: "최종 색상 수를 정하고 자동 팔레트 성향을 주조색, 원본 균형, 색상 다양성 사이에서 조절합니다. 준비된 팔레트 프리셋도 바로 적용할 수 있습니다.", tip: "투명 픽셀은 대표 색상 계산에서 제외됩니다." },
        { title: "필요한 색과 영향력을 고정하세요", body: "HEX·RGB 입력이나 이미지 스포이드로 색을 고정하고 슬롯별 가중치로 매칭 범위를 조절합니다. 고정한 색은 정확한 RGB 값으로 유지됩니다.", tip: "프레임별 자동 영상 모드에서는 장면에 맞춰 팔레트를 자동 생성합니다." },
        { title: "영상에 맞는 팔레트 방식을 고르세요", body: "공통 팔레트는 영상 전 구간의 대표 프레임을 분석해 하나의 팔레트를 사용합니다. 프레임별 자동 팔레트는 장면 전환과 시간적 안정화를 고려해 매 프레임 갱신합니다.", tip: "공통 팔레트는 일관성이 높고, 프레임별 모드는 장면별 색을 더 잘 반영합니다." },
        { title: "결과를 확인하고 내보내세요", body: "이미지는 PNG, JPEG, WebP로 저장하고 영상은 입력 컨테이너에 맞춰 MP4 또는 WebM으로 내보냅니다. 호환되는 영상의 원본 오디오는 재압축하지 않고 유지합니다.", tip: "긴 영상과 고해상도 영상은 기기 성능에 따라 시간이 오래 걸릴 수 있습니다." },
      ],
      contactTitle: "문제가 있거나 개선 의견이 있나요?", contactBody: "재현 방법, 사용한 브라우저와 함께 GitHub Issues에 남겨주세요. 원본 미디어에 민감한 정보가 있다면 공개로 첨부하지 마세요.", contactButton: "GitHub Issues에서 문의하기",
    },
    privacy: {
      eyebrow: "PRIVACY", title: "개인정보처리방침", lead: "PaletteForge는 원본 이미지와 영상을 수집하지 않는 브라우저 기반 로컬 처리 도구입니다. 아래 내용은 편집 기능, 호스팅과 광고에서 처리될 수 있는 정보를 설명합니다.", googleLink: "Google 서비스 사용 시 데이터 처리 방식", adsLink: "Google 광고 설정", cloudflareLink: "Cloudflare 개인정보처리방침",
      sections: [
        { title: "1. 기본 원칙", paragraphs: ["이미지와 영상의 디코딩, 색 보정, 팔레트 계산, 프레임 변환과 파일 생성은 사용자의 브라우저에서 수행됩니다. 운영자는 원본 미디어, 변환 결과, 오디오 또는 팔레트 설정을 별도 서버나 데이터베이스로 전송하거나 저장하지 않습니다."] },
        { title: "2. 브라우저에서 처리되는 정보", bullets: ["선택하거나 붙여넣은 이미지, 선택한 영상과 변환 결과", "색 보정·픽셀화·팔레트·가중치·영상 변환·내보내기 설정", "언어와 라이트·다크 모드 선택"], paragraphs: ["미디어와 작업 상태는 페이지가 열린 동안 브라우저 메모리에 존재합니다. 영상 변환 중에는 프레임과 결과 파일도 기기 메모리에서 처리됩니다. 언어와 화면 모드는 다음 방문을 위해 브라우저 로컬 저장소에 보관될 수 있습니다."] },
        { title: "3. 서버 및 호스팅", paragraphs: ["서비스 제공과 보안을 위해 Cloudflare가 일반적인 접속 정보(IP 주소, 요청 시각, 브라우저·기기 정보 등)를 처리할 수 있습니다. 이 처리는 Cloudflare의 정책에 따릅니다."] },
        { title: "4. Google AdSense와 광고 쿠키", paragraphs: ["서비스는 향후 Google AdSense 광고를 표시할 수 있습니다. 광고가 활성화되면 Google과 광고 파트너가 광고 제공, 빈도 제한, 성과 측정, 부정 사용 방지 및 이용자 선택에 따른 맞춤 광고를 위해 쿠키, IP 주소, 방문 URL과 브라우저 식별 정보를 처리할 수 있습니다.", "Google을 포함한 제3자 광고 사업자는 사용자의 이전 방문 기록을 바탕으로 광고를 제공할 수 있습니다. 사용자는 Google 광고 설정에서 맞춤 광고를 관리하거나 해제할 수 있습니다."] },
        { title: "5. 보관과 삭제", paragraphs: ["운영자가 원본 미디어나 변환 결과를 보관하지 않으므로 서버 삭제 요청 대상이 되는 미디어 데이터는 없습니다. 페이지를 닫거나 새로고침하면 메모리의 작업 데이터가 사라지며, 저장된 언어·테마 정보는 브라우저의 사이트 데이터 삭제 기능으로 제거할 수 있습니다."] },
        { title: "6. 이용자의 선택과 문의", paragraphs: ["광고 동의 메시지가 표시되는 지역에서는 동의, 거부 또는 옵션 관리 기능을 사용할 수 있습니다. 본 방침이나 서비스의 데이터 처리에 관한 문의는 하단 GitHub Issues를 통해 접수할 수 있습니다."] },
        { title: "7. 방침 변경", paragraphs: ["서비스 기능이나 관련 정책이 변경되면 본 방침을 수정하고 페이지의 시행일을 갱신합니다. 중요한 변경은 서비스 화면에서 알릴 수 있습니다."] },
      ],
    },
    terms: {
      eyebrow: "TERMS", title: "이용약관", lead: "PaletteForge를 이용하면 아래 조건에 동의한 것으로 봅니다. 이 약관은 무료 이미지·영상 팔레트 변환 도구의 이용 범위와 책임을 설명합니다.",
      sections: [
        { title: "1. 서비스의 목적", paragraphs: ["PaletteForge는 이미지와 영상의 색상 수 제한, 고정·자동 팔레트, 색 보정, 픽셀화, 프레임별 시간 안정화와 파일 내보내기 기능을 제공하는 브라우저 기반 도구입니다."] },
        { title: "2. 이용과 결과물", paragraphs: ["서비스는 별도 계정 없이 이용할 수 있습니다. 사용자가 변환하여 저장한 결과물의 이용 여부와 적합성은 사용자가 직접 확인해야 합니다."] },
        { title: "3. 미디어와 권리", bullets: ["사용자는 처리할 권한이 있는 이미지와 영상만 불러와야 합니다.", "타인의 저작권, 초상권, 상표권 또는 개인정보를 침해하는 방식으로 서비스를 이용해서는 안 됩니다.", "운영자는 사용자가 처리한 원본 미디어나 결과물에 대한 소유권을 주장하지 않습니다."] },
        { title: "4. 금지되는 이용", bullets: ["불법 행위 또는 타인의 권리 침해", "서비스의 보안·안정성을 방해하는 자동화된 공격", "악성코드 배포나 기만적인 다운로드 유도", "광고를 부정하게 클릭하거나 노출을 조작하는 행위"] },
        { title: "5. 로컬 처리와 데이터 보호", paragraphs: ["이미지와 영상은 브라우저에서 처리되지만, 사용자는 중요한 원본을 별도로 보관하고 공용 기기 사용 시 다운로드 파일과 브라우저 데이터를 직접 관리해야 합니다."] },
        { title: "6. 서비스와 광고", paragraphs: ["서비스는 무료로 제공되며 운영을 위해 광고가 표시될 수 있습니다. 광고 내용과 광고주의 외부 서비스는 해당 제공자의 책임과 정책에 따릅니다."] },
        { title: "7. 보증과 책임의 범위", paragraphs: ["운영자는 서비스의 중단 없는 제공, 모든 브라우저·코덱에서의 동일한 작동 또는 특정 목적에 대한 변환 결과의 적합성을 보증하지 않습니다. 고해상도·장시간 영상은 기기 성능과 메모리에 따라 실패할 수 있습니다. 법령상 허용되는 범위에서 사용자의 설정, 브라우저 오류, 기기 문제 또는 파일 관리로 발생한 손해에 대한 책임은 제한될 수 있습니다."] },
        { title: "8. 변경과 준거", paragraphs: ["기능과 운영 환경에 따라 서비스 또는 약관이 변경될 수 있으며 시행일을 갱신합니다. 별도 규정이 없는 사항은 대한민국의 관련 법령을 따릅니다. 문의는 하단 GitHub Issues를 이용해주세요."] },
      ],
    },
  },
  ja: {
    back: "編集画面に戻る", guideNav: "サービス案内", privacyNav: "プライバシーポリシー", termsNav: "利用規約", contactNav: "お問い合わせ", light: "ライト", dark: "ダーク", language: "言語を選択", localFooter: "画像と動画はサーバーへ送信されず、ブラウザー内で処理されます。", updated: "施行日 2026年8月7日",
    guide: {
      eyebrow: "PALETTE FORGE GUIDE", title: "画像と動画の色を、思いどおりのスタイルへ。", lead: "PaletteForgeは、画像と動画を限られたパレットやピクセルスタイルへ変換するブラウザーツールです。必要な色を正確に固定し、残りは元の雰囲気や色の多様性に合わせて自動生成できます。", start: "画像・動画の変換を始める", localTitle: "元の画像と動画は、このブラウザーの外へ出ません。", localBody: "読み込み、デコード、色補正、ピクセル化、パレット計算、書き出しを端末内で処理します。元メディアや変換結果をPaletteForgeのサーバーやアカウントへアップロードしません。", flowTitle: "画像と動画に共通する処理", flow: ["メディア入力", "色補正", "ピクセル化", "パレット構成", "OKLabマッピング", "ファイル出力"], stepsTitle: "できること", stepsLead: "画像は細かく編集して複数書き出しでき、動画は共通パレットまたはシーンに反応するフレーム別パレットで変換できます。",
      steps: [
        { title: "画像または動画を選ぶ", body: "画像はPNG、JPEG、WebPを複数読み込むか、Ctrl+Vで貼り付けられます。動画変換ではMP4またはWebMを1本選びます。", tip: "透明PNGとWebMのアルファも対応範囲内で保持します。" },
        { title: "色補正とピクセルスタイルを決める", body: "明るさ、コントラスト、彩度、色相を調整し、必要ならピクセル化のブロックサイズと透明度方式を選びます。", tip: "補正は累積せず、常に元データから再計算されます。" },
        { title: "パレットの大きさと傾向を決める", body: "最終色数を設定し、自動パレットを主要色、元のバランス、色の多様性の間で調整します。プリセットも選択できます。", tip: "透明ピクセルは代表色の計算から除外されます。" },
        { title: "必要な色と影響範囲を固定する", body: "HEX・RGB入力や画像スポイトで色を固定し、スロット別の重みで割り当て範囲を調整します。固定色は正確なRGB値を保ちます。", tip: "動画のフレーム別自動モードではシーンに合わせてパレットを生成します。" },
        { title: "動画のパレット方式を選ぶ", body: "共通パレットは動画全体の代表フレームから1つのパレットを作ります。フレーム別モードはシーン切替と時間的な安定性を考慮して更新します。", tip: "共通モードは一貫性、フレーム別モードはシーンごとの色表現に向いています。" },
        { title: "確認して書き出す", body: "画像はPNG、JPEG、WebP、動画は入力に合わせてMP4またはWebMで保存します。互換性のある元音声は再圧縮せず保持します。", tip: "長時間・高解像度動画は端末性能により時間がかかります。" },
      ], contactTitle: "不具合や改善案がありますか？", contactBody: "再現手順とブラウザー情報をGitHub Issuesへお寄せください。機密情報を含む元メディアは公開添付しないでください。", contactButton: "GitHub Issuesで問い合わせる",
    },
    privacy: { eyebrow: "PRIVACY", title: "プライバシーポリシー", lead: "PaletteForgeは元の画像や動画を収集しないブラウザー内処理ツールです。編集、ホスティング、広告で扱われる可能性のある情報を説明します。", googleLink: "Googleサービス利用時のデータ処理", adsLink: "Google広告設定", cloudflareLink: "Cloudflareプライバシーポリシー", sections: [
      { title: "1. 基本方針", paragraphs: ["画像と動画のデコード、補正、パレット計算、フレーム変換、ファイル生成はブラウザー内で行われます。運営者は元メディア、変換結果、音声、パレット設定を独自サーバーやデータベースへ送信・保存しません。"] },
      { title: "2. ブラウザー内の情報", bullets: ["読み込んだ画像、選択した動画と変換結果", "補正・ピクセル化・パレット・動画変換・書き出し設定", "言語と表示モード"], paragraphs: ["メディアと作業状態はページを開いている間メモリーに存在し、動画のフレームと結果ファイルも端末上で処理されます。言語と表示モードはローカルストレージに保存される場合があります。"] },
      { title: "3. ホスティング", paragraphs: ["サービス提供とセキュリティのため、CloudflareがIPアドレス、時刻、ブラウザー・端末情報など一般的な接続情報を処理する場合があります。"] },
      { title: "4. Google AdSense", paragraphs: ["将来Google AdSense広告を表示する場合、Googleと広告パートナーが広告配信、測定、不正防止、利用者の選択に応じたパーソナライズのため、Cookie、IPアドレス、URL、ブラウザー識別情報を処理することがあります。", "Google広告設定からパーソナライズ広告を管理・無効化できます。"] },
      { title: "5. 保存と削除", paragraphs: ["元メディアと変換結果は運営者のサーバーに保存されません。ページを閉じるとメモリー上の作業データは消え、言語・テーマはブラウザーのサイトデータ削除で消去できます。"] },
      { title: "6. 選択と問い合わせ", paragraphs: ["対象地域では広告同意メッセージから同意、拒否、設定管理ができます。問い合わせはGitHub Issuesで受け付けます。"] },
      { title: "7. 変更", paragraphs: ["機能や関連ポリシーの変更時は本ページと施行日を更新します。重要な変更はサービス画面で告知する場合があります。"] },
    ] },
    terms: { eyebrow: "TERMS", title: "利用規約", lead: "PaletteForgeを利用すると、以下の条件に同意したものとみなされます。無料の画像・動画パレット変換ツールの利用範囲と責任を説明します。", sections: [
      { title: "1. 目的", paragraphs: ["PaletteForgeは画像と動画の減色、固定・自動パレット、色補正、ピクセル化、フレーム間安定化、書き出しを提供するブラウザーツールです。"] },
      { title: "2. 利用と成果物", paragraphs: ["アカウントなしで利用できます。変換結果の用途と適合性は利用者が確認してください。"] },
      { title: "3. メディアと権利", bullets: ["処理する権限のある画像と動画のみ使用してください。", "著作権、肖像権、商標権、個人情報を侵害してはいけません。", "運営者は元メディアや成果物の所有権を主張しません。"] },
      { title: "4. 禁止事項", bullets: ["違法行為や権利侵害", "セキュリティを妨げる攻撃", "マルウェアや誤認ダウンロードの配布", "広告クリックや表示の不正操作"] },
      { title: "5. ローカル処理", paragraphs: ["重要な元メディアは利用者がバックアップし、共有端末ではダウンロードファイルとブラウザーデータを管理してください。"] },
      { title: "6. サービスと広告", paragraphs: ["サービスは無料で、運営のため広告を表示する場合があります。広告先は各提供者の責任とポリシーに従います。"] },
      { title: "7. 保証と責任", paragraphs: ["継続提供、すべてのブラウザーやコーデックでの同一動作、特定目的への適合を保証しません。高解像度・長時間動画は端末の性能やメモリーにより失敗する場合があります。法令の範囲で、設定・端末・ファイル管理による損害への責任が制限される場合があります。"] },
      { title: "8. 変更と準拠", paragraphs: ["サービスや規約は変更される場合があります。特段の定めがない事項は大韓民国の関連法令に従い、問い合わせはGitHub Issuesで受け付けます。"] },
    ] },
  },
  en: {
    back: "Back to editor", guideNav: "Guide", privacyNav: "Privacy", termsNav: "Terms", contactNav: "Contact", light: "Light", dark: "Dark", language: "Select language", localFooter: "Images and videos stay in your browser and are never uploaded to a server.", updated: "Effective August 7, 2026",
    guide: {
      eyebrow: "PALETTE FORGE GUIDE", title: "Reshape the colors of images and videos into your own style.", lead: "PaletteForge is a browser tool that transforms images and videos with limited palettes and pixel styling. Lock exact colors when they matter, then let the remaining palette follow the source mood or favor broader color variety.", start: "Start image or video conversion", localTitle: "Your source images and videos never leave this browser.", localBody: "Loading, decoding, adjustments, pixelation, palette calculation, and export all run on your device. PaletteForge does not upload source media or converted results to a server or account.", flowTitle: "A shared pipeline for images and videos", flow: ["Media input", "Adjust", "Pixelate", "Build palette", "OKLab map", "Export file"], stepsTitle: "What can you do?", stepsLead: "Edit and batch-export images in detail, or convert video with one consistent palette or a scene-responsive palette generated for each frame.",
      steps: [
        { title: "Choose an image or video", body: "Load multiple PNG, JPEG, or WebP images, or paste one with Ctrl+V. The video converter accepts one MP4 or WebM file at a time.", tip: "Alpha in transparent PNG and WebM is preserved where the browser and output support it." },
        { title: "Set adjustments and pixel style", body: "Tune brightness, contrast, saturation, and hue. Enable pixelation when needed, then choose block size and alpha behavior.", tip: "Adjustments never accumulate; every result is recalculated from the source." },
        { title: "Choose palette size and character", body: "Set the final color count and move the automatic palette between dominant colors, source balance, and broader color diversity. Ready-made presets are also available.", tip: "Transparent pixels are excluded from representative-color analysis." },
        { title: "Lock essential colors and coverage", body: "Use HEX, RGB, or the image eyedropper to lock exact colors, then control their matching range with per-slot weights.", tip: "Automatic palette-per-frame video mode generates colors for each scene instead of using fixed slots." },
        { title: "Choose a video palette strategy", body: "Common mode samples the full timeline and applies one palette throughout. Per-frame mode updates the palette with scene-change detection and temporal stabilization.", tip: "Common mode favors consistency; per-frame mode follows the colors of each scene." },
        { title: "Review and export", body: "Save images as PNG, JPEG, or WebP and videos as MP4 or WebM to match the input container. Compatible source audio is preserved without re-encoding.", tip: "Long or high-resolution videos may take substantial time depending on the device." },
      ], contactTitle: "Found a problem or have an idea?", contactBody: "Open a GitHub Issue with reproduction steps and your browser. Do not publicly attach source media that contains sensitive information.", contactButton: "Contact via GitHub Issues",
    },
    privacy: { eyebrow: "PRIVACY", title: "Privacy Policy", lead: "PaletteForge is a browser-based local-processing tool that does not collect source images or videos. This policy explains data that may be handled by editing, hosting, and advertising.", googleLink: "How Google uses data on partner sites", adsLink: "Google Ads Settings", cloudflareLink: "Cloudflare Privacy Policy", sections: [
      { title: "1. Core principle", paragraphs: ["Image and video decoding, adjustments, palette calculation, frame processing, and file generation happen in your browser. The operator does not send or store source media, converted results, audio, or palette settings in a separate server or database."] },
      { title: "2. Data handled in the browser", bullets: ["Loaded or pasted images, selected videos, and converted results", "Adjustment, pixelation, palette, weight, video conversion, and export settings", "Language and light or dark mode"], paragraphs: ["Media and working state remain in browser memory while the page is open. Video frames and output files are also processed in device memory. Language and display mode may be kept in local storage for future visits."] },
      { title: "3. Hosting", paragraphs: ["Cloudflare may process ordinary connection data such as IP address, request time, browser, and device information to deliver and secure the service under its own policy."] },
      { title: "4. Google AdSense", paragraphs: ["The service may display Google AdSense ads in the future. When ads are enabled, Google and advertising partners may process cookies, IP addresses, visited URLs, and browser identifiers for delivery, frequency control, measurement, fraud prevention, and personalization based on user choices.", "You can manage or disable personalized advertising in Google Ads Settings."] },
      { title: "5. Retention and deletion", paragraphs: ["The operator does not retain source media or converted results. Closing or refreshing the page clears working memory, and saved language or theme preferences can be removed through your browser's site-data controls."] },
      { title: "6. Your choices and contact", paragraphs: ["Where applicable, an advertising consent message lets you consent, refuse, or manage options. Questions are accepted through GitHub Issues."] },
      { title: "7. Changes", paragraphs: ["This policy and its effective date will be updated when the service or related policies change. Material changes may also be announced in the service."] },
    ] },
    terms: { eyebrow: "TERMS", title: "Terms of Use", lead: "By using PaletteForge, you agree to these terms. They describe the scope and responsibilities of this free image and video palette conversion tool.", sections: [
      { title: "1. Purpose", paragraphs: ["PaletteForge is a browser-based tool for image and video color reduction, fixed and automatic palettes, adjustments, pixelation, frame-to-frame stabilization, and file export."] },
      { title: "2. Use and output", paragraphs: ["No account is required. You are responsible for checking whether exported results are suitable for your intended use."] },
      { title: "3. Media and rights", bullets: ["Only process images and videos you have the right to use.", "Do not infringe copyright, publicity, trademark, or privacy rights.", "The operator claims no ownership over your source media or output."] },
      { title: "4. Prohibited use", bullets: ["Illegal activity or rights infringement", "Attacks that disrupt service security or stability", "Malware distribution or deceptive downloads", "Fraudulent ad clicks or impression manipulation"] },
      { title: "5. Local processing", paragraphs: ["Keep backups of important source files and manage downloads and browser data carefully on shared devices."] },
      { title: "6. Service and advertising", paragraphs: ["The service is free and may show advertising to support operation. External ads and services are governed by their providers' policies."] },
      { title: "7. Warranty and liability", paragraphs: ["The operator does not guarantee uninterrupted availability, identical behavior across every browser or codec, or fitness of output for a particular purpose. High-resolution or long videos may fail because of device performance or memory limits. Liability for losses caused by settings, browser or device errors, or file management may be limited where permitted by law."] },
      { title: "8. Changes and governing rules", paragraphs: ["The service and these terms may change, with the effective date updated accordingly. Unless otherwise specified, applicable laws of the Republic of Korea govern. Contact is available through GitHub Issues."] },
    ] },
  },
  es: {
    back: "Volver al editor", guideNav: "Guía", privacyNav: "Privacidad", termsNav: "Términos", contactNav: "Contacto", light: "Claro", dark: "Oscuro", language: "Seleccionar idioma", localFooter: "Las imágenes y los vídeos permanecen en tu navegador y nunca se suben a un servidor.", updated: "En vigor desde el 7 de agosto de 2026",
    guide: {
      eyebrow: "GUÍA DE PALETTE FORGE", title: "Rediseña los colores de tus imágenes y vídeos con el estilo que quieras.", lead: "PaletteForge es una herramienta web que transforma imágenes y vídeos con paletas limitadas y estilos de píxel. Fija colores exactos cuando sean importantes y deja que el resto de la paleta siga el ambiente del original o favorezca una mayor variedad cromática.", start: "Empezar a convertir imágenes o vídeos", localTitle: "Tus imágenes y vídeos originales nunca salen de este navegador.", localBody: "La carga, decodificación, corrección de color, pixelado, cálculo de la paleta y exportación se realizan en tu dispositivo. PaletteForge no sube los archivos originales ni los resultados convertidos a ningún servidor o cuenta.", flowTitle: "Un proceso común para imágenes y vídeos", flow: ["Entrada", "Ajustes", "Pixelado", "Crear paleta", "Mapeo OKLab", "Exportar archivo"], stepsTitle: "¿Qué puedes hacer?", stepsLead: "Edita imágenes con precisión y expórtalas por lotes, o convierte vídeos con una paleta común y estable o con una paleta por fotograma que reacciona a cada escena.",
      steps: [
        { title: "Elige una imagen o un vídeo", body: "Carga varias imágenes PNG, JPEG o WebP, o pega una con Ctrl+V. El conversor de vídeo admite un archivo MP4 o WebM cada vez.", tip: "El canal alfa de PNG y WebM transparentes se conserva cuando el navegador y el formato de salida lo permiten." },
        { title: "Define los ajustes y el estilo de píxel", body: "Ajusta el brillo, contraste, saturación y tono. Activa el pixelado cuando lo necesites y elige el tamaño de bloque y el comportamiento del alfa.", tip: "Los ajustes no se acumulan: cada resultado se vuelve a calcular desde el original." },
        { title: "Elige el tamaño y el carácter de la paleta", body: "Define el número final de colores y mueve la paleta automática entre colores dominantes, equilibrio original y mayor diversidad. También puedes aplicar preajustes listos para usar.", tip: "Los píxeles transparentes se excluyen del análisis de colores representativos." },
        { title: "Fija los colores esenciales y su alcance", body: "Usa HEX, RGB o el cuentagotas de imagen para fijar colores exactos y controla su intervalo de coincidencia con el peso de cada ranura.", tip: "El modo automático por fotograma genera colores para cada escena en lugar de usar ranuras fijas." },
        { title: "Elige una estrategia de paleta para el vídeo", body: "El modo común analiza fotogramas de toda la línea temporal y aplica una única paleta. El modo por fotograma actualiza la paleta detectando cambios de escena y estabilizándola en el tiempo.", tip: "El modo común favorece la consistencia; el modo por fotograma sigue mejor los colores de cada escena." },
        { title: "Revisa y exporta", body: "Guarda imágenes como PNG, JPEG o WebP y vídeos como MP4 o WebM, según el contenedor de entrada. El audio original compatible se conserva sin volver a codificarlo.", tip: "Los vídeos largos o de alta resolución pueden tardar bastante según el dispositivo." },
      ], contactTitle: "¿Has encontrado un problema o tienes una idea?", contactBody: "Abre una incidencia en GitHub con los pasos para reproducirla y el navegador utilizado. No adjuntes públicamente archivos originales que contengan información sensible.", contactButton: "Contactar mediante GitHub Issues",
    },
    privacy: { eyebrow: "PRIVACIDAD", title: "Política de privacidad", lead: "PaletteForge es una herramienta de procesamiento local en el navegador que no recopila tus imágenes o vídeos originales. Esta política explica los datos que pueden intervenir en la edición, el alojamiento y la publicidad.", googleLink: "Cómo usa Google los datos en sitios asociados", adsLink: "Configuración de anuncios de Google", cloudflareLink: "Política de privacidad de Cloudflare", sections: [
      { title: "1. Principio básico", paragraphs: ["La decodificación de imágenes y vídeos, los ajustes, el cálculo de paletas, el procesamiento de fotogramas y la creación de archivos se realizan en tu navegador. El operador no envía ni guarda los archivos originales, los resultados convertidos, el audio o los ajustes de paleta en un servidor o base de datos independiente."] },
      { title: "2. Datos tratados en el navegador", bullets: ["Imágenes cargadas o pegadas, vídeos seleccionados y resultados convertidos", "Ajustes de color, pixelado, paleta, pesos, conversión de vídeo y exportación", "Idioma y modo claro u oscuro"], paragraphs: ["Los archivos y el estado de trabajo permanecen en la memoria del navegador mientras la página está abierta. Los fotogramas y archivos de salida también se procesan en la memoria del dispositivo. El idioma y el modo de visualización pueden conservarse en el almacenamiento local para futuras visitas."] },
      { title: "3. Alojamiento", paragraphs: ["Cloudflare puede tratar datos de conexión habituales, como la dirección IP, la hora de la solicitud y la información del navegador y dispositivo, para ofrecer y proteger el servicio conforme a su propia política."] },
      { title: "4. Google AdSense", paragraphs: ["El servicio puede mostrar anuncios de Google AdSense en el futuro. Cuando se activen, Google y sus socios publicitarios podrán tratar cookies, direcciones IP, URL visitadas e identificadores del navegador para mostrar anuncios, limitar su frecuencia, medir resultados, prevenir el fraude y personalizar según las elecciones del usuario.", "Puedes administrar o desactivar la publicidad personalizada en la configuración de anuncios de Google."] },
      { title: "5. Conservación y eliminación", paragraphs: ["El operador no conserva los archivos originales ni los resultados convertidos. Al cerrar o actualizar la página se borra el estado de trabajo de la memoria; las preferencias de idioma y tema se pueden eliminar desde los controles de datos del sitio del navegador."] },
      { title: "6. Tus opciones y contacto", paragraphs: ["Cuando corresponda, el mensaje de consentimiento publicitario permite aceptar, rechazar o administrar las opciones. Las consultas se reciben mediante GitHub Issues."] },
      { title: "7. Cambios", paragraphs: ["Esta política y su fecha de entrada en vigor se actualizarán cuando cambien el servicio o las políticas relacionadas. Los cambios importantes también podrán anunciarse dentro del servicio."] },
    ] },
    terms: { eyebrow: "TÉRMINOS", title: "Términos de uso", lead: "Al utilizar PaletteForge, aceptas estos términos. Describen el alcance y las responsabilidades de esta herramienta gratuita de conversión de paletas para imágenes y vídeos.", sections: [
      { title: "1. Finalidad", paragraphs: ["PaletteForge es una herramienta web para reducir los colores de imágenes y vídeos, usar paletas fijas o automáticas, realizar ajustes, aplicar pixelado, estabilizar fotogramas y exportar archivos."] },
      { title: "2. Uso y resultados", paragraphs: ["No se requiere una cuenta. Eres responsable de comprobar que los resultados exportados sean adecuados para el uso que pretendes darles."] },
      { title: "3. Archivos y derechos", bullets: ["Procesa únicamente imágenes y vídeos que tengas derecho a utilizar.", "No infrinjas derechos de autor, imagen, marcas o privacidad.", "El operador no reclama la propiedad de tus archivos originales ni de los resultados." ] },
      { title: "4. Usos prohibidos", bullets: ["Actividades ilegales o infracciones de derechos", "Ataques que perjudiquen la seguridad o estabilidad del servicio", "Distribución de programas maliciosos o descargas engañosas", "Clics fraudulentos en anuncios o manipulación de impresiones"] },
      { title: "5. Procesamiento local", paragraphs: ["Conserva copias de seguridad de los archivos originales importantes y administra con cuidado las descargas y los datos del navegador en dispositivos compartidos."] },
      { title: "6. Servicio y publicidad", paragraphs: ["El servicio es gratuito y puede mostrar publicidad para contribuir a su funcionamiento. Los anuncios y servicios externos se rigen por las políticas de sus proveedores."] },
      { title: "7. Garantía y responsabilidad", paragraphs: ["El operador no garantiza la disponibilidad ininterrumpida, un funcionamiento idéntico en todos los navegadores o códecs ni que los resultados sean adecuados para un fin concreto. Los vídeos largos o de alta resolución pueden fallar debido al rendimiento o la memoria del dispositivo. La responsabilidad por pérdidas causadas por ajustes, errores del navegador o dispositivo o la gestión de archivos puede limitarse cuando la ley lo permita."] },
      { title: "8. Cambios y legislación aplicable", paragraphs: ["El servicio y estos términos pueden cambiar y su fecha de entrada en vigor se actualizará en consecuencia. Salvo indicación contraria, se aplica la legislación pertinente de la República de Corea. Puedes contactar mediante GitHub Issues."] },
    ] },
  },
};

function StepVisual({ index }: { index: number }) {
  if (index === 0) return <div className="guide-demo demo-upload" aria-hidden="true"><span className="demo-plus">＋</span><span className="demo-key">Ctrl&nbsp;V</span></div>;
  if (index === 1) return <div className="guide-demo demo-sliders" aria-hidden="true"><i /><i /><i /></div>;
  if (index === 2) return <div className="guide-demo demo-palette" aria-hidden="true"><i /><i /><i /><i /><i /></div>;
  if (index === 3) return <div className="guide-demo demo-pick" aria-hidden="true"><i /><b>#F01400</b></div>;
  if (index === 4) return <div className="guide-demo demo-video" aria-hidden="true"><span>ONE</span><span>FRAME</span><i /><i /><i /></div>;
  return <div className="guide-demo demo-export" aria-hidden="true"><span>PNG</span><span>MP4</span><span>WebM</span></div>;
}

export default function InfoPage({ kind }: { kind: PageKind }) {
  const [language, setLanguage] = useState<Language>("ko");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    let storedLanguage: string | null = null; let storedTheme: string | null = null;
    try { storedLanguage = localStorage.getItem("palette-forge-language"); storedTheme = localStorage.getItem("palette-forge-theme"); } catch { /* 기본값을 사용합니다. */ }
    const nextLanguage = storedLanguage === "ko" || storedLanguage === "ja" || storedLanguage === "en" || storedLanguage === "es" ? storedLanguage : detectLanguage(navigator.language);
    const nextTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.lang = nextLanguage; document.documentElement.dataset.theme = nextTheme;
    const timer = window.setTimeout(() => { setLanguage(nextLanguage); setTheme(nextTheme); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const chooseLanguage = (next: Language) => { setLanguage(next); document.documentElement.lang = next; try { localStorage.setItem("palette-forge-language", next); } catch { /* 전환은 유지합니다. */ } };
  const toggleTheme = () => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); document.documentElement.dataset.theme = next; try { localStorage.setItem("palette-forge-theme", next); } catch { /* 전환은 유지합니다. */ } };
  const copy = COPY[language];
  const legal = kind === "privacy" ? copy.privacy : copy.terms;
  return <main className="info-page">
    <header className="info-topbar">
      <a className="info-brand" href="/"><span>PF</span><strong>Palette Forge</strong></a>
      <nav aria-label="Information"><a className={kind === "guide" ? "active" : ""} href="/guide">{copy.guideNav}</a><a className={kind === "privacy" ? "active" : ""} href="/privacy">{copy.privacyNav}</a><a className={kind === "terms" ? "active" : ""} href="/terms">{copy.termsNav}</a></nav>
      <div className="info-actions"><button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? copy.light : copy.dark}>{theme === "dark" ? "☀" : "☾"}</button><label><span aria-hidden="true">文</span><select value={language} aria-label={copy.language} onChange={(event) => chooseLanguage(event.target.value as Language)}>{LANGUAGE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><a className="back-editor" href="/">{copy.back}</a></div>
    </header>

    {kind === "guide" ? <>
      <section className="info-hero"><span className="eyebrow">{copy.guide.eyebrow}</span><h1>{copy.guide.title}</h1><p>{copy.guide.lead}</p><a className="info-primary" href="/">{copy.guide.start}<span>→</span></a></section>
      <section className="local-promise"><div className="local-orbit" aria-hidden="true"><span>LOCAL</span><i /><i /><i /></div><div><span className="eyebrow">PRIVACY BY DESIGN</span><h2>{copy.guide.localTitle}</h2><p>{copy.guide.localBody}</p></div></section>
      <section className="process-section"><div className="info-section-head"><span className="eyebrow">WORKFLOW</span><h2>{copy.guide.flowTitle}</h2></div><ol className="process-flow">{copy.guide.flow.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></li>)}</ol></section>
      <section className="guide-section"><div className="info-section-head"><span className="eyebrow">HOW TO USE</span><h2>{copy.guide.stepsTitle}</h2><p>{copy.guide.stepsLead}</p></div><div className="guide-grid">{copy.guide.steps.map((step, index) => <article className="guide-card" key={step.title}><div className="guide-card-top"><span>{String(index + 1).padStart(2, "0")}</span><StepVisual index={index} /></div><h3>{step.title}</h3><p>{step.body}</p><small>{step.tip}</small></article>)}</div></section>
      <section className="contact-section" id="contact"><span className="eyebrow">CONTACT</span><h2>{copy.guide.contactTitle}</h2><p>{copy.guide.contactBody}</p><a href={CONTACT_URL} target="_blank" rel="noreferrer">{copy.guide.contactButton}<span>↗</span></a></section>
    </> : <article className="legal-page">
      <header><span className="eyebrow">{legal.eyebrow}</span><h1>{legal.title}</h1><p>{legal.lead}</p><small>{copy.updated}</small></header>
      <div className="legal-layout"><aside><strong>{legal.title}</strong>{legal.sections.map((section) => <a key={section.title} href={`#section-${section.title.split(".")[0]}`}>{section.title}</a>)}</aside><div className="legal-content">{legal.sections.map((section) => <section id={`section-${section.title.split(".")[0]}`} key={section.title}><h2>{section.title}</h2>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}{kind === "privacy" && <div className="legal-links"><a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">{copy.privacy.googleLink} ↗</a><a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">{copy.privacy.adsLink} ↗</a><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">{copy.privacy.cloudflareLink} ↗</a></div>}</div></div>
    </article>}

    <footer className="info-footer"><div><strong>Palette Forge</strong><p>{copy.localFooter}</p></div><nav><a href="/guide">{copy.guideNav}</a><a href="/privacy">{copy.privacyNav}</a><a href="/terms">{copy.termsNav}</a><a href="/guide#contact">{copy.contactNav}</a></nav><small>© 2026 Palette Forge <span className="app-version" title={`Version ${APP_VERSION}`}>v{APP_VERSION}</span></small></footer>
  </main>;
}

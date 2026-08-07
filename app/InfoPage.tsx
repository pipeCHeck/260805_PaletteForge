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
    back: "편집기로 돌아가기", guideNav: "서비스 안내", privacyNav: "개인정보처리방침", termsNav: "이용약관", contactNav: "문의", light: "라이트", dark: "다크", language: "언어 선택", localFooter: "이미지는 서버로 전송되지 않고 브라우저 안에서 처리됩니다.", updated: "시행일 2026년 8월 6일",
    guide: {
      eyebrow: "PALETTE FORGE GUIDE", title: "색을 줄이는 과정은 단순하게, 결과는 정확하게.", lead: "이미지를 불러오고, 원하는 색을 고정하고, 팔레트 수를 정한 뒤 내보내세요. 복잡한 설정도 실제 작업 순서대로 배치했습니다.", start: "지금 이미지 변환하기", localTitle: "원본 이미지는 이 브라우저 밖으로 나가지 않습니다.", localBody: "불러오기, 색 보정, 팔레트 계산, 내보내기까지 기기 안에서 처리됩니다. 이미지 파일을 PaletteForge 서버에 업로드하거나 계정에 저장하지 않습니다.", flowTitle: "한눈에 보는 처리 순서", flow: ["원본", "색 보정", "픽셀화", "팔레트 생성", "OKLab 매핑", "내보내기"], stepsTitle: "처음부터 내보내기까지", stepsLead: "위에서 아래로 여섯 단계만 따라가면 됩니다.",
      steps: [
        { title: "이미지를 불러오세요", body: "PNG, JPEG, WebP를 선택하거나 화면에서 Ctrl+V를 눌러 클립보드 이미지를 바로 추가합니다. 여러 장도 원래 순서대로 유지됩니다.", tip: "투명 PNG의 알파 값도 그대로 읽습니다." },
        { title: "필요한 만큼만 보정하세요", body: "밝기, 대비, 채도, 색조를 조절합니다. 픽셀 아트가 목적이라면 픽셀화를 켜고 블록 크기와 투명도 방식을 정합니다.", tip: "모든 보정은 항상 원본에서 다시 계산됩니다." },
        { title: "최종 색상 수를 정하세요", body: "결과에 사용할 팔레트 슬롯 수를 입력합니다. 자동 슬롯은 보정된 이미지를 분석해 대표 색상으로 채워집니다.", tip: "투명 픽셀은 색상 수 계산에서 제외됩니다." },
        { title: "꼭 필요한 색을 고정하세요", body: "팔레트 슬롯을 열어 HEX·RGB를 입력하거나 이미지 스포이드로 픽셀을 선택합니다. 고정한 RGB 값은 자동 추출 과정에서 바뀌지 않습니다.", tip: "확대된 미리보기에서도 스포이드를 사용할 수 있습니다." },
        { title: "가중치로 색의 영향력을 조절하세요", body: "가중치를 높이면 해당 팔레트 색상과 매칭되는 범위가 넓어지고, 낮추면 좁아집니다. 팔레트 자체는 유지되어 결과를 예측하기 쉽습니다.", tip: "1.0은 편향이 없는 기본값입니다." },
        { title: "변환하고 원하는 형식으로 저장하세요", body: "변환 실행으로 결과를 확인한 뒤 PNG, JPEG, WebP로 내보냅니다. 투명도, 배경색, 품질과 픽셀 최적화 해상도를 선택할 수 있습니다.", tip: "여러 이미지는 각각 겹치지 않는 파일명으로 저장됩니다." },
      ],
      contactTitle: "문제가 있거나 개선 의견이 있나요?", contactBody: "재현 방법, 사용한 브라우저와 함께 GitHub Issues에 남겨주세요. 원본 이미지에 민감한 정보가 있다면 공개로 첨부하지 마세요.", contactButton: "GitHub Issues에서 문의하기",
    },
    privacy: {
      eyebrow: "PRIVACY", title: "개인정보처리방침", lead: "PaletteForge는 이미지 원본을 수집하지 않는 로컬 처리 도구입니다. 아래 내용은 현재 서비스와 향후 광고 기능에서 처리될 수 있는 정보를 설명합니다.", googleLink: "Google 서비스 사용 시 데이터 처리 방식", adsLink: "Google 광고 설정", cloudflareLink: "Cloudflare 개인정보처리방침",
      sections: [
        { title: "1. 기본 원칙", paragraphs: ["PaletteForge의 이미지 변환은 사용자의 브라우저에서 수행됩니다. 운영자는 사용자가 불러온 이미지, 변환 결과 또는 팔레트 설정을 별도 서버나 데이터베이스로 전송하거나 저장하지 않습니다."] },
        { title: "2. 브라우저에서 처리되는 정보", bullets: ["사용자가 선택하거나 클립보드에서 붙여넣은 이미지와 변환 결과", "밝기·대비·채도·색조·픽셀화·팔레트·내보내기 설정", "언어와 라이트·다크 모드 선택"] , paragraphs: ["이미지와 변환 상태는 페이지가 열린 동안 브라우저 메모리에 존재합니다. 언어와 화면 모드는 다음 방문을 위해 브라우저 로컬 저장소에 보관될 수 있습니다."] },
        { title: "3. 서버 및 호스팅", paragraphs: ["서비스 제공과 보안을 위해 Cloudflare가 일반적인 접속 정보(IP 주소, 요청 시각, 브라우저·기기 정보 등)를 처리할 수 있습니다. 이 처리는 Cloudflare의 정책에 따릅니다."] },
        { title: "4. Google AdSense와 광고 쿠키", paragraphs: ["서비스는 향후 Google AdSense 광고를 표시할 수 있습니다. 광고가 활성화되면 Google과 광고 파트너가 광고 제공, 빈도 제한, 성과 측정, 부정 사용 방지 및 이용자 선택에 따른 맞춤 광고를 위해 쿠키, IP 주소, 방문 URL과 브라우저 식별 정보를 처리할 수 있습니다.", "Google을 포함한 제3자 광고 사업자는 사용자의 이전 방문 기록을 바탕으로 광고를 제공할 수 있습니다. 사용자는 Google 광고 설정에서 맞춤 광고를 관리하거나 해제할 수 있습니다."] },
        { title: "5. 보관과 삭제", paragraphs: ["운영자가 이미지 원본이나 변환 결과를 보관하지 않으므로 서버 삭제 요청 대상이 되는 이미지 데이터는 없습니다. 페이지를 닫거나 새로고침하면 메모리의 작업 데이터가 사라지며, 저장된 언어·테마 정보는 브라우저의 사이트 데이터 삭제 기능으로 제거할 수 있습니다."] },
        { title: "6. 이용자의 선택과 문의", paragraphs: ["광고 동의 메시지가 표시되는 지역에서는 동의, 거부 또는 옵션 관리 기능을 사용할 수 있습니다. 본 방침이나 서비스의 데이터 처리에 관한 문의는 하단 GitHub Issues를 통해 접수할 수 있습니다."] },
        { title: "7. 방침 변경", paragraphs: ["서비스 기능이나 관련 정책이 변경되면 본 방침을 수정하고 페이지의 시행일을 갱신합니다. 중요한 변경은 서비스 화면에서 알릴 수 있습니다."] },
      ],
    },
    terms: {
      eyebrow: "TERMS", title: "이용약관", lead: "PaletteForge를 이용하면 아래 조건에 동의한 것으로 봅니다. 이 약관은 무료 이미지 변환 도구의 이용 범위와 책임을 설명합니다.",
      sections: [
        { title: "1. 서비스의 목적", paragraphs: ["PaletteForge는 이미지의 색상 수 제한, 고정 팔레트, 색 보정, 픽셀화와 파일 내보내기 기능을 제공하는 브라우저 기반 도구입니다."] },
        { title: "2. 이용과 결과물", paragraphs: ["서비스는 별도 계정 없이 이용할 수 있습니다. 사용자가 변환하여 저장한 결과물의 이용 여부와 적합성은 사용자가 직접 확인해야 합니다."] },
        { title: "3. 이미지와 저작권", bullets: ["사용자는 처리할 권한이 있는 이미지만 불러와야 합니다.", "타인의 저작권, 초상권, 상표권 또는 개인정보를 침해하는 방식으로 서비스를 이용해서는 안 됩니다.", "운영자는 사용자가 처리한 이미지나 결과물에 대한 소유권을 주장하지 않습니다."] },
        { title: "4. 금지되는 이용", bullets: ["불법 행위 또는 타인의 권리 침해", "서비스의 보안·안정성을 방해하는 자동화된 공격", "악성코드 배포나 기만적인 다운로드 유도", "광고를 부정하게 클릭하거나 노출을 조작하는 행위"] },
        { title: "5. 로컬 처리와 데이터 보호", paragraphs: ["이미지는 브라우저에서 처리되지만, 사용자는 중요한 원본을 별도로 보관하고 공용 기기 사용 시 다운로드 파일과 브라우저 데이터를 직접 관리해야 합니다."] },
        { title: "6. 서비스와 광고", paragraphs: ["서비스는 무료로 제공되며 운영을 위해 광고가 표시될 수 있습니다. 광고 내용과 광고주의 외부 서비스는 해당 제공자의 책임과 정책에 따릅니다."] },
        { title: "7. 보증과 책임의 범위", paragraphs: ["운영자는 서비스의 중단 없는 제공, 모든 브라우저에서의 동일한 작동 또는 특정 목적에 대한 변환 결과의 적합성을 보증하지 않습니다. 법령상 허용되는 범위에서 사용자의 설정, 브라우저 오류, 기기 문제 또는 파일 관리로 발생한 손해에 대한 책임은 제한될 수 있습니다."] },
        { title: "8. 변경과 준거", paragraphs: ["기능과 운영 환경에 따라 서비스 또는 약관이 변경될 수 있으며 시행일을 갱신합니다. 별도 규정이 없는 사항은 대한민국의 관련 법령을 따릅니다. 문의는 하단 GitHub Issues를 이용해주세요."] },
      ],
    },
  },
  ja: {
    back: "編集画面に戻る", guideNav: "サービス案内", privacyNav: "プライバシーポリシー", termsNav: "利用規約", contactNav: "お問い合わせ", light: "ライト", dark: "ダーク", language: "言語を選択", localFooter: "画像はサーバーへ送信されず、ブラウザー内で処理されます。", updated: "施行日 2026年8月6日",
    guide: {
      eyebrow: "PALETTE FORGE GUIDE", title: "減色の流れはシンプルに、結果は正確に。", lead: "画像を読み込み、必要な色を固定し、パレット数を決めて書き出します。設定は実際の作業順に並んでいます。", start: "画像を変換する", localTitle: "元画像はこのブラウザーの外へ出ません。", localBody: "読み込み、色補正、パレット計算、書き出しは端末内で行われます。画像をPaletteForgeのサーバーへアップロードしたり、アカウントに保存したりしません。", flowTitle: "処理の流れ", flow: ["原画像", "色補正", "ピクセル化", "パレット生成", "OKLabマッピング", "書き出し"], stepsTitle: "読み込みから書き出しまで", stepsLead: "上から順に6つのステップを進めるだけです。",
      steps: [
        { title: "画像を読み込む", body: "PNG、JPEG、WebPを選ぶか、Ctrl+Vでクリップボード画像を追加します。複数画像の順番も維持されます。", tip: "透明PNGのアルファ値も保持します。" },
        { title: "必要な補正を行う", body: "明るさ、コントラスト、彩度、色相を調整します。ピクセルアートならブロックサイズとアルファ方式も設定できます。", tip: "補正は毎回元画像から再計算されます。" },
        { title: "最終色数を決める", body: "結果に使うパレットスロット数を入力します。自動スロットは補正画像から代表色を抽出します。", tip: "透明ピクセルは色数に含まれません。" },
        { title: "必要な色を固定する", body: "HEX・RGB入力または画像スポイトで色を選びます。固定RGBは自動抽出で変更されません。", tip: "拡大したプレビューでもスポイトを使えます。" },
        { title: "重みで影響範囲を調整する", body: "重みを上げるとその色に割り当てられる範囲が広がり、下げると狭くなります。パレット自体は維持されます。", tip: "1.0が偏りのない基本値です。" },
        { title: "変換して保存する", body: "結果を確認し、PNG、JPEG、WebPで書き出します。透明度、背景色、品質、ピクセル最適化解像度を選べます。", tip: "複数画像は重複しない名前で保存されます。" },
      ], contactTitle: "不具合や改善案がありますか？", contactBody: "再現手順とブラウザー情報をGitHub Issuesへお寄せください。機密情報を含む原画像は公開添付しないでください。", contactButton: "GitHub Issuesで問い合わせる",
    },
    privacy: { eyebrow: "PRIVACY", title: "プライバシーポリシー", lead: "PaletteForgeは元画像を収集しないローカル処理ツールです。現在のサービスと将来の広告機能で処理される可能性のある情報を説明します。", googleLink: "Googleサービス利用時のデータ処理", adsLink: "Google広告設定", cloudflareLink: "Cloudflareプライバシーポリシー", sections: [
      { title: "1. 基本方針", paragraphs: ["画像変換はブラウザー内で行われます。運営者は画像、変換結果、パレット設定を独自サーバーやデータベースへ送信・保存しません。"] },
      { title: "2. ブラウザー内の情報", bullets: ["読み込んだ画像と変換結果", "補正・ピクセル化・パレット・書き出し設定", "言語と表示モード"], paragraphs: ["画像と作業状態はページを開いている間メモリーに存在します。言語と表示モードはローカルストレージに保存される場合があります。"] },
      { title: "3. ホスティング", paragraphs: ["サービス提供とセキュリティのため、CloudflareがIPアドレス、時刻、ブラウザー・端末情報など一般的な接続情報を処理する場合があります。"] },
      { title: "4. Google AdSense", paragraphs: ["将来Google AdSense広告を表示する場合、Googleと広告パートナーが広告配信、測定、不正防止、利用者の選択に応じたパーソナライズのため、Cookie、IPアドレス、URL、ブラウザー識別情報を処理することがあります。", "Google広告設定からパーソナライズ広告を管理・無効化できます。"] },
      { title: "5. 保存と削除", paragraphs: ["画像は運営者のサーバーに保存されません。ページを閉じるとメモリー上の作業データは消え、言語・テーマはブラウザーのサイトデータ削除で消去できます。"] },
      { title: "6. 選択と問い合わせ", paragraphs: ["対象地域では広告同意メッセージから同意、拒否、設定管理ができます。問い合わせはGitHub Issuesで受け付けます。"] },
      { title: "7. 変更", paragraphs: ["機能や関連ポリシーの変更時は本ページと施行日を更新します。重要な変更はサービス画面で告知する場合があります。"] },
    ] },
    terms: { eyebrow: "TERMS", title: "利用規約", lead: "PaletteForgeを利用すると、以下の条件に同意したものとみなされます。無料画像変換ツールの利用範囲と責任を説明します。", sections: [
      { title: "1. 目的", paragraphs: ["PaletteForgeは減色、固定パレット、色補正、ピクセル化、書き出しを提供するブラウザーツールです。"] },
      { title: "2. 利用と成果物", paragraphs: ["アカウントなしで利用できます。変換結果の用途と適合性は利用者が確認してください。"] },
      { title: "3. 画像と権利", bullets: ["処理する権限のある画像のみ使用してください。", "著作権、肖像権、商標権、個人情報を侵害してはいけません。", "運営者は画像や成果物の所有権を主張しません。"] },
      { title: "4. 禁止事項", bullets: ["違法行為や権利侵害", "セキュリティを妨げる攻撃", "マルウェアや誤認ダウンロードの配布", "広告クリックや表示の不正操作"] },
      { title: "5. ローカル処理", paragraphs: ["重要な元画像は利用者がバックアップし、共有端末ではダウンロードファイルとブラウザーデータを管理してください。"] },
      { title: "6. サービスと広告", paragraphs: ["サービスは無料で、運営のため広告を表示する場合があります。広告先は各提供者の責任とポリシーに従います。"] },
      { title: "7. 保証と責任", paragraphs: ["継続提供、全ブラウザーでの同一動作、特定目的への適合を保証しません。法令の範囲で、設定・端末・ファイル管理による損害への責任が制限される場合があります。"] },
      { title: "8. 変更と準拠", paragraphs: ["サービスや規約は変更される場合があります。特段の定めがない事項は大韓民国の関連法令に従い、問い合わせはGitHub Issuesで受け付けます。"] },
    ] },
  },
  en: {
    back: "Back to editor", guideNav: "Guide", privacyNav: "Privacy", termsNav: "Terms", contactNav: "Contact", light: "Light", dark: "Dark", language: "Select language", localFooter: "Images never leave your browser and are not uploaded to a server.", updated: "Effective August 6, 2026",
    guide: {
      eyebrow: "PALETTE FORGE GUIDE", title: "A simple workflow for precise color reduction.", lead: "Load an image, lock the colors you need, choose a palette size, and export. Every control follows the order in which the image is processed.", start: "Start converting", localTitle: "Your source image never leaves this browser.", localBody: "Loading, adjustments, palette calculation, and export all happen on your device. PaletteForge does not upload images to its server or save them to an account.", flowTitle: "Processing at a glance", flow: ["Original", "Adjust", "Pixelate", "Build palette", "OKLab map", "Export"], stepsTitle: "From source to export", stepsLead: "Follow six clear steps from top to bottom.",
      steps: [
        { title: "Load an image", body: "Choose PNG, JPEG, or WebP files, or press Ctrl+V to paste an image. Multiple images retain their original order.", tip: "Alpha values in transparent PNGs are preserved." },
        { title: "Make only the adjustments you need", body: "Tune brightness, contrast, saturation, and hue. For pixel art, enable pixelation and choose its block size and alpha behavior.", tip: "Every adjustment is recalculated from the source." },
        { title: "Choose the final color count", body: "Set the number of palette slots. Automatic slots analyze the adjusted image and fill themselves with representative colors.", tip: "Transparent pixels do not count as colors." },
        { title: "Lock essential colors", body: "Enter HEX or RGB values, or sample a pixel with the image eyedropper. A fixed RGB value is never changed by automatic extraction.", tip: "The eyedropper works on a zoomed preview too." },
        { title: "Shape color coverage with weights", body: "A higher weight expands the matching range of that palette color; a lower weight narrows it. The palette stays stable and predictable.", tip: "1.0 is the unbiased default." },
        { title: "Convert and export", body: "Review the result and export PNG, JPEG, or WebP. Choose alpha handling, background, quality, and pixel-optimized resolution.", tip: "Batch exports use collision-free file names." },
      ], contactTitle: "Found a problem or have an idea?", contactBody: "Open a GitHub Issue with reproduction steps and your browser. Do not publicly attach a source image that contains sensitive information.", contactButton: "Contact via GitHub Issues",
    },
    privacy: { eyebrow: "PRIVACY", title: "Privacy Policy", lead: "PaletteForge is a local-processing tool that does not collect source images. This policy explains data that may be handled by the current service and future advertising features.", googleLink: "How Google uses data on partner sites", adsLink: "Google Ads Settings", cloudflareLink: "Cloudflare Privacy Policy", sections: [
      { title: "1. Core principle", paragraphs: ["Image conversion happens in your browser. The operator does not send or store source images, converted results, or palette settings in a separate server or database."] },
      { title: "2. Data handled in the browser", bullets: ["Loaded or pasted images and converted results", "Adjustment, pixelation, palette, and export settings", "Language and light or dark mode"], paragraphs: ["Images and working state remain in browser memory while the page is open. Language and display mode may be kept in local storage for future visits."] },
      { title: "3. Hosting", paragraphs: ["Cloudflare may process ordinary connection data such as IP address, request time, browser, and device information to deliver and secure the service under its own policy."] },
      { title: "4. Google AdSense", paragraphs: ["The service may display Google AdSense ads in the future. When ads are enabled, Google and advertising partners may process cookies, IP addresses, visited URLs, and browser identifiers for delivery, frequency control, measurement, fraud prevention, and personalization based on user choices.", "You can manage or disable personalized advertising in Google Ads Settings."] },
      { title: "5. Retention and deletion", paragraphs: ["The operator does not retain source images or results. Closing or refreshing the page clears working memory, and saved language or theme preferences can be removed through your browser's site-data controls."] },
      { title: "6. Your choices and contact", paragraphs: ["Where applicable, an advertising consent message lets you consent, refuse, or manage options. Questions are accepted through GitHub Issues."] },
      { title: "7. Changes", paragraphs: ["This policy and its effective date will be updated when the service or related policies change. Material changes may also be announced in the service."] },
    ] },
    terms: { eyebrow: "TERMS", title: "Terms of Use", lead: "By using PaletteForge, you agree to these terms. They describe the scope and responsibilities of this free image conversion tool.", sections: [
      { title: "1. Purpose", paragraphs: ["PaletteForge is a browser-based tool for color reduction, fixed palettes, adjustments, pixelation, and image export."] },
      { title: "2. Use and output", paragraphs: ["No account is required. You are responsible for checking whether exported results are suitable for your intended use."] },
      { title: "3. Images and rights", bullets: ["Only process images you have the right to use.", "Do not infringe copyright, publicity, trademark, or privacy rights.", "The operator claims no ownership over your images or output."] },
      { title: "4. Prohibited use", bullets: ["Illegal activity or rights infringement", "Attacks that disrupt service security or stability", "Malware distribution or deceptive downloads", "Fraudulent ad clicks or impression manipulation"] },
      { title: "5. Local processing", paragraphs: ["Keep backups of important source files and manage downloads and browser data carefully on shared devices."] },
      { title: "6. Service and advertising", paragraphs: ["The service is free and may show advertising to support operation. External ads and services are governed by their providers' policies."] },
      { title: "7. Warranty and liability", paragraphs: ["The operator does not guarantee uninterrupted availability, identical behavior in every browser, or fitness of output for a particular purpose. Liability for losses caused by settings, browser or device errors, or file management may be limited where permitted by law."] },
      { title: "8. Changes and governing rules", paragraphs: ["The service and these terms may change, with the effective date updated accordingly. Unless otherwise specified, applicable laws of the Republic of Korea govern. Contact is available through GitHub Issues."] },
    ] },
  },
};

function StepVisual({ index }: { index: number }) {
  if (index === 0) return <div className="guide-demo demo-upload" aria-hidden="true"><span className="demo-plus">＋</span><span className="demo-key">Ctrl&nbsp;V</span></div>;
  if (index === 1) return <div className="guide-demo demo-sliders" aria-hidden="true"><i /><i /><i /></div>;
  if (index === 2) return <div className="guide-demo demo-palette" aria-hidden="true"><i /><i /><i /><i /><i /></div>;
  if (index === 3) return <div className="guide-demo demo-pick" aria-hidden="true"><i /><b>#F01400</b></div>;
  if (index === 4) return <div className="guide-demo demo-weights" aria-hidden="true"><i /><i /><i /></div>;
  return <div className="guide-demo demo-export" aria-hidden="true"><span>PNG</span><span>JPG</span><span>WebP</span></div>;
}

export default function InfoPage({ kind }: { kind: PageKind }) {
  const [language, setLanguage] = useState<Language>("ko");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    let storedLanguage: string | null = null; let storedTheme: string | null = null;
    try { storedLanguage = localStorage.getItem("palette-forge-language"); storedTheme = localStorage.getItem("palette-forge-theme"); } catch { /* 기본값을 사용합니다. */ }
    const nextLanguage = storedLanguage === "ko" || storedLanguage === "ja" || storedLanguage === "en" ? storedLanguage : detectLanguage(navigator.language);
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

import type { Language } from "./languages";

export function examplePreviewImage(imagePath: string) {
  if (imagePath.startsWith("/examples/results/")) return imagePath.replace("/examples/results/", "/examples/previews/results/").replace(/\.png$/i, ".webp");
  if (imagePath.startsWith("/examples/")) return imagePath.replace("/examples/", "/examples/previews/").replace(/\.png$/i, ".webp");
  return imagePath;
}

export type LocalizedText = Record<Language, string>;

export type ExampleStory = {
  id: string;
  slug: string;
  image: string;
  resultImage: string;
  palettePreview: string;
  orientation: "portrait" | "landscape";
  name: LocalizedText;
  summary: LocalizedText;
  goal: LocalizedText;
  method: LocalizedText;
  colorCount: number;
  adjustments: { brightness: number; contrast: number; saturation: number; hue: number };
  pixelation: { enabled: boolean; size: number };
  colorize?: boolean;
  surfaceCleanup: number;
  palette: string[];
};

const localized = (ko: string, ja: string, en: string, es: string): LocalizedText => ({ ko, ja, en, es });

export const EXAMPLE_STORIES: ExampleStory[] = [
  {
    id: "example-01",
    slug: "witch-of-starlight",
    image: "/examples/example-01.png",
    resultImage: "/examples/results/example-01.png",
    palettePreview: "/examples/loading/example-01.png",
    orientation: "portrait",
    name: localized("별빛을 품은 마녀", "星を抱く魔女", "Witch of Starlight", "Bruja de luz estelar"),
    summary: localized("어두운 의상과 별빛의 대비를 13색으로 선명하게 분리한 사례입니다.", "暗い衣装と星明かりの対比を13色で鮮明に分けた例です。", "A 13-color study that separates dark clothing from luminous starlight.", "Un estudio de 13 colores que separa la ropa oscura de la luz estelar."),
    goal: localized("깊은 남보라를 그림자로 유지하면서 하늘색·노랑·분홍의 발광감을 잃지 않는 것이 목표였습니다.", "深い青紫を影として残しながら、水色・黄色・ピンクの発光感を保つことを目標にしました。", "The goal was to keep deep indigo shadows while preserving the glow of cyan, yellow, and pink.", "El objetivo fue conservar sombras índigo profundas sin perder el brillo cian, amarillo y rosa."),
    method: localized("흰색과 어두운 남색을 기준점으로 고정하고, 중간 채도의 색 가중치를 낮춰 발광색 사이의 경계가 탁해지지 않도록 했습니다.", "白と濃紺を基準色として固定し、中彩度色の重みを抑えて発光色の境界が濁らないようにしました。", "White and deep navy anchor the range, while lighter weights on mid-saturation colors keep the glowing accents distinct.", "El blanco y el azul marino fijan el rango; los pesos bajos en tonos medios mantienen separados los acentos luminosos."),
    colorCount: 13,
    adjustments: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    pixelation: { enabled: false, size: 8 },
    surfaceCleanup: 50,
    palette: ["#FFFFFF", "#03053C", "#160252", "#300467", "#2F33A3", "#60A9CE", "#05C9FC", "#BAEE68", "#FEE039", "#F9A77A", "#F46795", "#CF3B96", "#7D0E93"],
  },
  {
    id: "example-03",
    slug: "city-monument",
    image: "/examples/example-03.png",
    resultImage: "/examples/results/example-03.png",
    palettePreview: "/examples/loading/example-03.png",
    orientation: "landscape",
    name: localized("도심의 기념비", "街角の記念碑", "City Monument", "Monumento urbano"),
    summary: localized("청록 계열 8색과 3px 블록으로 차가운 도시 실루엣을 정리한 사례입니다.", "青緑系8色と3pxブロックで、冷たい都市のシルエットを整理した例です。", "Eight teal shades and 3 px blocks simplify a cool urban silhouette.", "Ocho tonos turquesa y bloques de 3 px simplifican una silueta urbana fría."),
    goal: localized("복잡한 건축 질감은 줄이되 밝은 면에서 어두운 면으로 이어지는 깊이는 남기는 것이 목표였습니다.", "建築の細かな質感を減らしながら、明部から暗部へ続く奥行きを残すことを目標にしました。", "The goal was to reduce architectural noise without flattening the depth from highlights to shadows.", "El objetivo fue reducir el ruido arquitectónico sin perder profundidad entre luces y sombras."),
    method: localized("명도 순서가 분명한 청록 팔레트를 고정하고 면 정리를 최대로 적용해 작은 색 얼룩을 넓은 덩어리로 묶었습니다.", "明度順が明確な青緑パレットを固定し、面整理を最大にして細かな色むらを大きな面へまとめました。", "A fixed teal ramp preserves value order, while maximum surface cleanup groups small color noise into broader shapes.", "Una rampa turquesa fija conserva el orden tonal y la limpieza máxima agrupa el ruido en superficies amplias."),
    colorCount: 8,
    adjustments: { brightness: -10, contrast: 15, saturation: 0, hue: 0 },
    pixelation: { enabled: true, size: 3 },
    surfaceCleanup: 100,
    palette: ["#071D2B", "#0B3C5D", "#0E5E78", "#167D9A", "#45B8AC", "#70CFBE", "#A8E6CF", "#EAF9F3"],
  },
  {
    id: "example-04",
    slug: "silver-blade-knight",
    image: "/examples/example-04.png",
    resultImage: "/examples/results/example-04.png",
    palettePreview: "/examples/loading/example-04.png",
    orientation: "landscape",
    name: localized("은빛 검의 기사", "銀剣の騎士", "Knight of the Silver Blade", "Caballero de la espada de plata"),
    summary: localized("5단계 회색조만으로 금속의 윤곽과 강한 명암을 남긴 사례입니다.", "5段階のグレースケールだけで金属の輪郭と強い明暗を残した例です。", "A five-step grayscale palette that keeps metallic contours and strong contrast.", "Una paleta de cinco grises que conserva contornos metálicos y alto contraste."),
    goal: localized("색 정보 없이도 갑옷·검·배경이 서로 구분되고 삽화 같은 선명한 형태가 남도록 설계했습니다.", "色情報がなくても鎧・剣・背景を区別し、挿絵のような明快な形を残すよう設計しました。", "It was designed so armor, blade, and background remain readable without relying on hue.", "Se diseñó para distinguir armadura, espada y fondo sin depender del matiz."),
    method: localized("대비를 크게 높이고 간격이 일정한 회색을 고정해 가장 밝은 반사광과 가장 어두운 외곽선이 섞이지 않게 했습니다.", "コントラストを大きく上げ、間隔の揃った灰色を固定して、反射光と輪郭線が混ざらないようにしました。", "High contrast and an evenly spaced gray ramp keep bright reflections separate from the darkest outlines.", "El contraste alto y una rampa gris uniforme separan los reflejos brillantes de los contornos oscuros."),
    colorCount: 5,
    adjustments: { brightness: -5, contrast: 70, saturation: 0, hue: 0 },
    pixelation: { enabled: false, size: 8 },
    surfaceCleanup: 100,
    palette: ["#111317", "#4B4E4A", "#858983", "#C5C8C0", "#F4F4EF"],
  },
  {
    id: "example-05",
    slug: "golden-carbonara",
    image: "/examples/example-05.png",
    resultImage: "/examples/results/example-05.png",
    palettePreview: "/examples/loading/example-05.png",
    orientation: "landscape",
    name: localized("황금빛 카르보나라", "黄金色のカルボナーラ", "Golden Carbonara", "Carbonara dorada"),
    summary: localized("노랑·갈색·초록 20색으로 음식의 따뜻함과 재료 구분을 함께 살린 사례입니다.", "黄・茶・緑の20色で、料理の温かさと素材の区別を両立した例です。", "Twenty warm yellows, browns, and greens preserve both appetite and ingredient separation.", "Veinte amarillos, marrones y verdes cálidos conservan el aspecto apetitoso y separan los ingredientes."),
    goal: localized("크림과 면의 밝은 영역이 한 색으로 뭉치지 않으면서 허브와 그릇의 어두운 색도 충분히 남기는 것이 목표였습니다.", "クリームと麺の明部が一色につぶれず、ハーブや器の暗色も残すことを目標にしました。", "The goal was to keep cream and noodles distinct while retaining the darker herbs and bowl.", "El objetivo fue separar crema y pasta sin perder las hierbas oscuras ni el cuenco."),
    method: localized("따뜻한 색의 간격을 촘촘하게 두고 검정·짙은 갈색·초록을 보조축으로 사용해 재료별 경계를 유지했습니다.", "暖色の間隔を細かく取り、黒・濃茶・緑を補助軸にして素材ごとの境界を保ちました。", "A dense warm ramp is balanced by black, deep brown, and green anchors that preserve ingredient boundaries.", "Una rampa cálida densa se equilibra con negro, marrón oscuro y verde para conservar los límites de cada ingrediente."),
    colorCount: 20,
    adjustments: { brightness: 0, contrast: 40, saturation: 10, hue: 0 },
    pixelation: { enabled: false, size: 3 },
    surfaceCleanup: 75,
    palette: ["#E4911D", "#000000", "#5B1C01", "#B04E0C", "#FEEB9C", "#647707", "#FAAA1A", "#230200", "#A4C830", "#293800", "#F0D4B7", "#CEA989", "#DE6E17", "#041300", "#FEF4E4", "#BC8759", "#33292B", "#FCDB5B", "#68503E", "#981507"],
  },
  {
    id: "example-06",
    slug: "coral-geometry",
    image: "/examples/example-06.png",
    resultImage: "/examples/results/example-06.png",
    palettePreview: "/examples/loading/example-06.png",
    orientation: "portrait",
    name: localized("산호빛 기하학", "珊瑚色の幾何学", "Coral Geometry", "Geometría coral"),
    summary: localized("산호색과 청록색의 보색 대비를 12색으로 정돈한 그래픽 사례입니다.", "コーラルと青緑の補色対比を12色に整えたグラフィック例です。", "A graphic study that organizes coral and cyan contrast into twelve colors.", "Un estudio gráfico que organiza el contraste coral y cian en doce colores."),
    goal: localized("원본의 경쾌한 색 대비는 유지하면서 작은 장식 요소가 배경에 묻히지 않도록 했습니다.", "原画像の軽快な色対比を保ちながら、小さな装飾が背景に埋もれないようにしました。", "The goal was to retain the lively complementary contrast without losing small decorative elements.", "El objetivo fue conservar el contraste complementario sin perder los detalles decorativos pequeños."),
    method: localized("흰색과 짙은 자주를 양 끝에 두고 노랑·산호·청록을 단계별로 고정해 서로 다른 색 계열의 역할을 분명히 했습니다.", "白と濃い紫を両端に置き、黄・コーラル・青緑を段階的に固定して各色系統の役割を明確にしました。", "White and deep plum define the ends, while stepped yellow, coral, and cyan families keep each color role clear.", "El blanco y el ciruela oscuro fijan los extremos; amarillos, corales y cian escalonados mantienen claro cada papel."),
    colorCount: 12,
    adjustments: { brightness: -10, contrast: 0, saturation: 25, hue: 0 },
    pixelation: { enabled: false, size: 8 },
    surfaceCleanup: 62,
    palette: ["#FFFFFF", "#1E0B20", "#FDE302", "#F89B3F", "#F87D7F", "#EE1436", "#EB1569", "#9C0A64", "#3D195A", "#2D528B", "#23A1C9", "#55DDE9"],
  },
  {
    id: "example-07",
    slug: "crate-fortress-squad",
    image: "/examples/example-07.png",
    resultImage: "/examples/results/example-07.png",
    palettePreview: "/examples/loading/example-07.png",
    orientation: "landscape",
    name: localized("상자 요새 부대", "木箱要塞の部隊", "Crate Fortress Squad", "Escuadrón de la fortaleza de cajas"),
    summary: localized("5색 녹색 팔레트와 5px 픽셀화로 휴대용 게임기 화면처럼 바꾼 사례입니다.", "5色の緑パレットと5pxのピクセル化で携帯ゲーム機風に変えた例です。", "A five-green palette and 5 px pixelation create a handheld-console look.", "Una paleta de cinco verdes y pixelado de 5 px crean un aspecto de consola portátil."),
    goal: localized("귀여운 캐릭터의 표정과 상자 윤곽은 읽히면서 색의 종류는 과감하게 줄이는 것이 목표였습니다.", "キャラクターの表情と箱の輪郭を読めるまま、色数を大胆に減らすことを目標にしました。", "The goal was to reduce the palette aggressively while keeping faces and the crate silhouette readable.", "El objetivo fue reducir mucho la paleta manteniendo legibles las caras y la silueta de la caja."),
    method: localized("어두운 윤곽색 하나와 밝기 차이가 분명한 녹색 네 가지를 고정하고 픽셀 블록을 적용해 작은 질감을 정리했습니다.", "暗い輪郭色1色と明度差の明確な緑4色を固定し、ピクセルブロックで細かな質感を整理しました。", "One dark outline color and four clearly separated greens are fixed, then pixel blocks simplify fine texture.", "Se fija un contorno oscuro y cuatro verdes bien separados; los bloques simplifican la textura fina."),
    colorCount: 5,
    adjustments: { brightness: -4, contrast: 20, saturation: 0, hue: 0 },
    pixelation: { enabled: true, size: 5 },
    surfaceCleanup: 75,
    palette: ["#252525", "#0F380F", "#306230", "#8BAC0F", "#9BBC0F"],
  },
  {
    id: "example-08",
    slug: "cube-ranger",
    image: "/examples/example-08.png",
    resultImage: "/examples/results/example-08.png",
    palettePreview: "/examples/loading/example-08.png",
    orientation: "landscape",
    name: localized("큐브 레인저", "キューブレンジャー", "Cube Ranger", "Ranger cúbico"),
    summary: localized("15색 고채도 팔레트와 7px 블록으로 아케이드 스프라이트 감각을 강조한 사례입니다.", "15色の高彩度パレットと7pxブロックでアーケードスプライト感を強調した例です。", "A 15-color high-saturation palette and 7 px blocks push the image toward arcade sprite art.", "Una paleta saturada de 15 colores y bloques de 7 px llevan la imagen hacia el arte de sprites arcade."),
    goal: localized("노란 장비와 청록 머리, 분홍 큐브가 서로 경쟁하지 않고 캐릭터별 실루엣이 또렷하게 남도록 했습니다.", "黄色の装備、青緑の髪、ピンクのキューブが競合せず、各キャラクターの輪郭が明確に残るようにしました。", "The goal was to keep yellow gear, cyan hair, and pink cubes distinct without sacrificing character silhouettes.", "El objetivo fue separar equipo amarillo, cabello cian y cubos rosas sin perder las siluetas."),
    method: localized("채도를 크게 높인 뒤 검정과 갈색을 윤곽축으로 사용하고 청록·노랑·분홍을 독립된 강조색으로 고정했습니다.", "彩度を大きく上げ、黒と茶を輪郭軸にし、青緑・黄・ピンクを独立した強調色として固定しました。", "After boosting saturation, black and brown anchor the outlines while cyan, yellow, and pink remain independent accents.", "Tras elevar la saturación, negro y marrón anclan los contornos; cian, amarillo y rosa quedan como acentos independientes."),
    colorCount: 15,
    adjustments: { brightness: 0, contrast: 40, saturation: 100, hue: -5 },
    pixelation: { enabled: true, size: 7 },
    surfaceCleanup: 50,
    palette: ["#FEB318", "#030101", "#833209", "#14F3FD", "#FE0C54", "#26677E", "#2B1C15", "#E46512", "#41AEBB", "#F5EEE6", "#562105", "#AA5211", "#E29221", "#B70C35", "#134557"],
  },
  {
    id: "example-09",
    slug: "sunlit-market-adventurer",
    image: "/examples/example-09.png",
    resultImage: "/examples/results/example-09.png",
    palettePreview: "/examples/loading/example-09.png",
    orientation: "landscape",
    name: localized("햇살 시장의 모험가", "陽だまり市場の冒険者", "Adventurer at the Sunlit Market", "Aventurera del mercado soleado"),
    summary: localized("단일 색상화와 12색 팔레트로 햇빛·그림자·인물의 선을 포스터처럼 재구성한 사례입니다.", "単色化と12色パレットで、日差し・影・人物線をポスター風に再構成した例です。", "Monochrome colorization and twelve fixed colors rebuild sunlight, shadow, and linework like a poster.", "La colorización monocroma y doce colores fijos reconstruyen luz, sombra y línea como un cartel."),
    goal: localized("흰 머리와 밝은 피부의 깨끗한 면은 지키면서 머리카락 선과 사과의 붉은색이 사라지지 않게 조정했습니다.", "白い髪と明るい肌のきれいな面を守りながら、髪の線とリンゴの赤を残すよう調整しました。", "The goal was to keep clean white hair and skin planes while retaining hair detail and the apple's red accents.", "El objetivo fue mantener limpios el cabello blanco y la piel sin perder las líneas ni el rojo de la manzana."),
    method: localized("단일 색상화를 먼저 적용한 뒤 밝기와 대비를 조절하고, 흰색·자주·청록 계열의 가중치를 수동으로 나눠 선과 면의 균형을 맞췄습니다.", "単色化を先に適用してから明るさとコントラストを調整し、白・紫・青緑の重みを手動で分けて線と面を整えました。", "Colorization is applied first, then brightness and contrast are tuned; manual weights balance white, magenta, and cyan between lines and broad surfaces.", "Primero se aplica la colorización; después se ajustan brillo y contraste, y pesos manuales equilibran blanco, magenta y cian."),
    colorCount: 12,
    adjustments: { brightness: 22, contrast: -18, saturation: -58, hue: -11 },
    pixelation: { enabled: false, size: 2 },
    colorize: true,
    surfaceCleanup: 82,
    palette: ["#FFFFFF", "#1E0B20", "#FDE302", "#F89B3F", "#F87D7F", "#EE1436", "#EB1569", "#9C0A64", "#3D195A", "#2D528B", "#23A1C9", "#55DDE9"],
  },
];

export function findExample(slug: string) {
  return EXAMPLE_STORIES.find((example) => example.slug === slug);
}

export const PUBLIC_COPY = {
  ko: {
    navFeatures: "기능", navExamples: "변환 사례", navWorkflow: "사용 흐름", navGuide: "상세 가이드", editor: "편집기 열기",
    eyebrow: "LOCAL PALETTE STUDIO", title1: "원하는 색으로,", title2: "새롭게 다시 만들기.",
    lead: "Palette Forge는 이미지와 영상의 색을 원하는 팔레트로 재구성하는 브라우저 편집 도구입니다. 색 보정·고정 색상·팔레트 가중치·면 정리·픽셀화 같은 변환 요소를 한 흐름에서 조절할 수 있습니다.",
    primary: "이미지 편집 시작", secondary: "사례부터 살펴보기", local: "서버 업로드 없이 로컬 처리", fixed: "고정색은 정확한 RGB로 유지", video: "이미지와 영상 모두 지원",
    featureEyebrow: "WHAT MAKES IT DIFFERENT", featureTitle: "팔레트로 넓어지는 표현",
    features: [
      ["이미지 스타일 재구성", "팔레트와 색 보정을 바꿔 같은 이미지를 빈티지 포스터, 레트로 게임, 모노톤처럼 서로 다른 분위기로 재구성할 수 있습니다."],
      ["원하는 색을 주인공으로", "브랜드 컬러나 캐릭터의 상징색을 고정하고 가중치를 조절해, 결과에서 어떤 색을 더 넓게 사용할지 설계할 수 있습니다."],
      ["깔끔한 픽셀 아트 만들기", "블록 크기와 투명도 방식을 정하고 작은 색 얼룩을 정리해, 원본을 선명한 저색상 픽셀 스타일로 바꿀 수 있습니다."],
      ["영상에 하나의 색감 입히기", "영상 전체에 같은 팔레트를 유지하거나 장면에 맞춰 바꾸면서, 프레임 사이의 거슬리는 색 반짝임을 줄일 수 있습니다."],
    ],
    exampleEyebrow: "REAL SETTINGS, EXPLAINED", exampleTitle: "실전 변환 사례", exampleLead: "각 사례에는 사용한 팔레트와 보정값, 그 설정을 선택한 이유를 함께 기록했습니다.", allExamples: "모든 사례와 설정 보기", openCase: "사례 자세히 보기",
    workflowEyebrow: "WORKFLOW", workflowTitle: "네 단계 변환 흐름", workflow: [
      ["01", "불러오기", "PNG·JPEG·WebP를 선택하거나 붙여넣고, 목록에서 편집할 이미지를 고릅니다."],
      ["02", "색 정하기", "최종 색상 수를 정하고 반드시 살릴 색은 HEX·RGB 또는 스포이드로 고정합니다."],
      ["03", "변환 스타일 조절", "색 보정, 자동 팔레트 성향, 면 정리와 픽셀 블록 크기를 결과에 맞춰 조절합니다."],
      ["04", "변환·내보내기", "항상 원본에서 다시 계산한 결과를 PNG·JPEG·WebP로 저장합니다."],
    ],
    guideEyebrow: "LEARN THE CONTROLS", guideTitle: "핵심 조절 개념", guides: [
      ["고정 색상과 자동 색상", "직접 고른 색을 지키면서 나머지 슬롯만 이미지에서 계산하는 방법을 알아보세요."],
      ["가중치와 면 정리", "색의 사용 범위와 작은 색 얼룩을 조절해 디테일과 깔끔한 면 사이의 균형을 잡습니다."],
      ["픽셀화와 투명도", "부드러운 알파와 0·1 알파의 차이, 원본·픽셀 최적화 해상도를 비교합니다."],
      ["영상 팔레트", "전체 공통 팔레트와 프레임별 자동 팔레트가 속도·일관성에 미치는 차이를 설명합니다."],
    ],
    guideButton: "전체 사용 가이드", faqTitle: "자주 묻는 질문", faqs: [
      ["이미지가 서버에 올라가나요?", "아닙니다. 이미지와 영상 처리는 현재 브라우저 안에서 진행되며 원본 파일을 계정이나 서버에 저장하지 않습니다."],
      ["설정한 색상 수를 넘을 수 있나요?", "투명 픽셀을 제외한 실제 RGB 색상 수는 설정값을 넘지 않습니다."],
      ["고정한 색은 변환할 때 바뀌나요?", "바뀌지 않습니다. 자동 팔레트 생성과 다시 변환을 반복해도 지정한 RGB 값이 그대로 유지됩니다."],
      ["영상은 어떤 방식으로 변환하나요?", "영상 전체에 하나의 팔레트를 쓰거나 장면 변화에 맞춘 프레임별 팔레트를 선택할 수 있으며 오디오는 원본 트랙을 유지합니다."],
    ],
    footer: "색상 제한부터 픽셀·영상 팔레트까지 브라우저 안에서 설계합니다.", aiNote: "예시 이미지는 AI로 생성했으며, Palette Forge의 실제 설정을 적용한 사용 사례입니다.",
  },
  ja: {
    navFeatures: "機能", navExamples: "変換例", navWorkflow: "使い方", navGuide: "ガイド", editor: "エディターを開く",
    eyebrow: "LOCAL PALETTE STUDIO", title1: "好きな色で、", title2: "新しい表現へ。",
    lead: "Palette Forgeは、画像や動画の色を思いどおりのパレットで再構成するブラウザー編集ツールです。色補正・固定色・パレットの重み・面整理・ピクセル化といった変換要素を一つの流れで調整できます。",
    primary: "画像編集を始める", secondary: "変換例を見る", local: "サーバー送信なしのローカル処理", fixed: "固定色は正確なRGBを維持", video: "画像と動画に対応",
    featureEyebrow: "WHAT MAKES IT DIFFERENT", featureTitle: "パレットで広がる表現",
    features: [["画像スタイルの再構成", "パレットと色補正を変えて、同じ画像をヴィンテージポスター、レトロゲーム、モノトーンなど異なる雰囲気に再構成できます。"], ["使いたい色を主役に", "ブランドカラーやキャラクターの象徴色を固定し、重みを調整して、どの色を広く使うか設計できます。"], ["すっきりしたピクセルアート", "ブロックサイズと透明度を選び、細かな色むらを整理して、原画像を鮮明な減色ピクセルスタイルに変換できます。"], ["動画の色調を統一", "動画全体で一つのパレットを保つか、シーンごとに切り替え、フレーム間の色のちらつきを抑えられます。"]],
    exampleEyebrow: "REAL SETTINGS, EXPLAINED", exampleTitle: "実践的な変換事例", exampleLead: "各例にパレット、補正値、設定を選んだ理由を記録しています。", allExamples: "すべての例と設定", openCase: "詳しく見る",
    workflowEyebrow: "WORKFLOW", workflowTitle: "4ステップの変換フロー", workflow: [["01", "読み込む", "PNG・JPEG・WebPを選択・貼り付けし、編集する画像を選びます。"], ["02", "色を決める", "最終色数を決め、残したい色をHEX・RGB・スポイトで固定します。"], ["03", "変換スタイルを調整", "色補正、自動パレット傾向、面整理、ピクセルサイズを調整します。"], ["04", "変換・保存", "毎回原画像から計算した結果をPNG・JPEG・WebPで保存します。"]],
    guideEyebrow: "LEARN THE CONTROLS", guideTitle: "主要な調整ポイント", guides: [["固定色と自動色", "選んだ色を守り、残りだけを画像から計算する仕組み。"], ["重みと面整理", "色の使用範囲と細かな色むらを調整します。"], ["ピクセル化と透明度", "滑らかなアルファと0・1アルファ、出力解像度の違い。"], ["動画パレット", "共通パレットとフレーム別パレットの速度と一貫性を比較します。"]],
    guideButton: "使用ガイドを見る", faqTitle: "よくある質問", faqs: [["画像はサーバーへ送られますか？", "いいえ。画像と動画はブラウザー内で処理され、元ファイルは保存されません。"], ["設定色数を超えますか？", "透明ピクセルを除いたRGB色数は設定値を超えません。"], ["固定色は変わりますか？", "変わりません。再変換しても指定RGBを維持します。"], ["動画はどう変換しますか？", "全体共通またはフレーム別パレットを選べ、音声トラックは維持されます。"]],
    footer: "減色からピクセル・動画パレットまでブラウザー内で設計します。", aiNote: "サンプル画像はAI生成で、Palette Forgeの実設定を使った例です。",
  },
  en: {
    navFeatures: "Features", navExamples: "Examples", navWorkflow: "Workflow", navGuide: "Guide", editor: "Open editor",
    eyebrow: "LOCAL PALETTE STUDIO", title1: "Choose your colors.", title2: "Reimagine the result.",
    lead: "Palette Forge is a browser-based editor for reconstructing the colors of images and videos with the palette you choose. Adjust color correction, fixed colors, palette weights, surface cleanup, pixelation, and other conversion controls in a single workflow.",
    primary: "Start editing an image", secondary: "Explore examples", local: "Local processing, no uploads", fixed: "Exact RGB colors stay fixed", video: "Built for images and video",
    featureEyebrow: "WHAT MAKES IT DIFFERENT", featureTitle: "More ways to create with color",
    features: [["Reshape an image's style", "Change the palette and corrections to reshape the same image as a vintage poster, retro game graphic, monochrome artwork, and more."], ["Make a chosen color lead", "Lock a brand or character color, then tune its weight to control how strongly it appears across the result."], ["Build clean pixel art", "Set block size and alpha behavior, then clean small color noise to turn an original into crisp limited-color pixel art."], ["Give video a consistent look", "Keep one palette across a whole video or adapt it by scene while reducing distracting color flicker between frames."]],
    exampleEyebrow: "REAL SETTINGS, EXPLAINED", exampleTitle: "Real-world conversion studies", exampleLead: "Each study records its palette, corrections, and the reason those settings were chosen.", allExamples: "View every example and setting", openCase: "Read the case study",
    workflowEyebrow: "WORKFLOW", workflowTitle: "Four-step conversion flow", workflow: [["01", "Load", "Choose or paste PNG, JPEG, and WebP files, then select the image to edit."], ["02", "Choose colors", "Set the final count and lock essential colors with HEX, RGB, or the eyedropper."], ["03", "Tune the conversion style", "Tune corrections, automatic palette tendency, surface cleanup, and pixel size."], ["04", "Convert and export", "Recalculate from the original and save as PNG, JPEG, or WebP."]],
    guideEyebrow: "LEARN THE CONTROLS", guideTitle: "Core adjustment concepts", guides: [["Fixed and automatic colors", "Keep chosen colors while calculating only the remaining palette slots."], ["Weights and cleanup", "Balance fine detail against broader, cleaner color surfaces."], ["Pixelation and alpha", "Compare smooth alpha, binary alpha, and output resolution."], ["Video palettes", "Understand the speed and consistency tradeoffs of shared and per-frame palettes."]],
    guideButton: "Read the complete guide", faqTitle: "Frequently asked questions", faqs: [["Are files uploaded?", "No. Images and videos are processed in the current browser and source files are not stored on an account or server."], ["Can the result exceed the color limit?", "No. Excluding transparent pixels, the number of RGB colors does not exceed the selected limit."], ["Can a fixed color change?", "No. Its exact RGB value remains intact through palette generation and repeated conversions."], ["How is video converted?", "Use one palette for the full video or scene-aware per-frame palettes while retaining the original audio track."]],
    footer: "Design limited-color images, pixel art, and video palettes entirely in your browser.", aiNote: "Example images were AI-generated and use real Palette Forge settings.",
  },
  es: {
    navFeatures: "Funciones", navExamples: "Ejemplos", navWorkflow: "Proceso", navGuide: "Guía", editor: "Abrir editor",
    eyebrow: "LOCAL PALETTE STUDIO", title1: "Con los colores que quieras,", title2: "vuelve a crearlo.",
    lead: "Palette Forge es un editor en el navegador para reconstruir el color de imágenes y vídeos con la paleta que elijas. Ajusta la corrección de color, los colores fijos, los pesos de la paleta, la limpieza de superficies, el pixelado y otros elementos de conversión en un solo flujo.",
    primary: "Empezar a editar", secondary: "Ver ejemplos", local: "Proceso local, sin subidas", fixed: "Los RGB exactos permanecen fijos", video: "Para imágenes y vídeo",
    featureEyebrow: "WHAT MAKES IT DIFFERENT", featureTitle: "Más posibilidades a través del color",
    features: [["Reinventa el estilo de una imagen", "Modifica la paleta y la corrección para convertir una misma imagen en un póster vintage, un gráfico de videojuego retro, una obra monocroma y más."], ["Haz protagonista a un color", "Fija el color de una marca o personaje y ajusta su peso para decidir cuánto destaca en el resultado."], ["Crea pixel art limpio", "Define el tamaño de bloque y el comportamiento del alfa, y elimina pequeñas manchas de color para obtener un pixel art nítido y limitado."], ["Unifica el aspecto del vídeo", "Mantén una paleta en todo el vídeo o adáptala por escena mientras reduces los parpadeos de color entre fotogramas."]],
    exampleEyebrow: "REAL SETTINGS, EXPLAINED", exampleTitle: "Casos reales de conversión", exampleLead: "Cada caso muestra su paleta, correcciones y por qué se eligieron.", allExamples: "Ver todos los casos y ajustes", openCase: "Ver el caso",
    workflowEyebrow: "WORKFLOW", workflowTitle: "Flujo de conversión en cuatro pasos", workflow: [["01", "Cargar", "Selecciona o pega PNG, JPEG y WebP; después elige la imagen que editarás."], ["02", "Elegir colores", "Define el número final y fija colores con HEX, RGB o cuentagotas."], ["03", "Ajustar el estilo de conversión", "Ajusta corrección, tendencia automática, limpieza y tamaño de píxel."], ["04", "Convertir y exportar", "Recalcula desde el original y guarda en PNG, JPEG o WebP."]],
    guideEyebrow: "LEARN THE CONTROLS", guideTitle: "Conceptos clave de ajuste", guides: [["Colores fijos y automáticos", "Conserva los elegidos y calcula solo los huecos restantes."], ["Pesos y limpieza", "Equilibra el detalle fino con superficies de color limpias."], ["Pixelado y alfa", "Compara alfa suave, alfa binario y resolución de salida."], ["Paletas de vídeo", "Compara velocidad y estabilidad entre paleta común y paleta por fotograma."]],
    guideButton: "Leer la guía completa", faqTitle: "Preguntas frecuentes", faqs: [["¿Se suben los archivos?", "No. Imágenes y vídeos se procesan en el navegador y no se guardan en cuentas ni servidores."], ["¿Puede superar el límite?", "No. Sin contar píxeles transparentes, los colores RGB no superan el límite."], ["¿Puede cambiar un color fijo?", "No. Su RGB exacto se mantiene en generaciones y conversiones repetidas."], ["¿Cómo se convierte el vídeo?", "Puedes usar una paleta común o paletas por fotograma y conservar la pista de audio original."]],
    footer: "Diseña color limitado, píxel y paletas de vídeo por completo en tu navegador.", aiNote: "Las imágenes de ejemplo se generaron con IA y usan ajustes reales de Palette Forge.",
  },
} as const;

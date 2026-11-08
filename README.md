> # 🗄️ 보관 (2026-11-08)
>
> `plex-*` 와 같은 스택(Gemini 직결·sidePanel)이지만 하는 일이 **일정 관리**로 달라
> **통합 대상은 아니다**. 마지막 커밋 2026-04-15 · 2026-07 평가 「상품화 부적합」.
>
> **다시 켜는 법:** 브라우저에서 설치 해제.
>
> ⚠️ 저장소는 **지우지 않는다** — 읽기 전용 보관이고 되돌릴 수 있다.

# dAIly Planner — AI 일정 관리 Chrome 확장 프로그램

> Google Gemini AI로 할 일과 일정을 분석·배치하는 스마트 플래너. Linear/Arc/Raycast 스타일의 다크 글래스모피즘 UI를 제공하는 Chrome 사이드 패널 확장 프로그램입니다.

## 주요 기능

- **AI 일정 분석** — 할 일의 제목, 우선순위, 예상 시간, 기존 일정, 사용자 프로필을 기반으로 Gemini가 최적의 시간 슬롯 제안
- **다양한 뷰** — 일간 / 주간 / 월간 / 분기 / 요약 뷰
- **웹 텍스트 연동** — 웹 페이지에서 텍스트 선택 → 플로팅 버튼 → 바로 할 일로 추가
- **드래그 앤 드롭** — 일정 순서를 직관적으로 조정
- **프로필 기반 맞춤** — 이름, 직업, 성향 등 프로필 정보로 AI 추천 품질 향상
- **한국어/영어 지원** — UI 및 AI 프롬프트 현지화

## 기술 스택

| 구분 | 기술 |
|------|------|
| 플랫폼 | Chrome Extension Manifest V3 |
| 언어 | Vanilla JavaScript (ES Modules) |
| UI | Shadow DOM, CSS3 (글래스모피즘) |
| AI | Google Gemini API (기본 gemini-2.5-flash) |
| 저장소 | `chrome.storage.local` |
| i18n | `locales/ko.json`, `locales/en.json` |

## 프로젝트 구조

```
dAIlyplanner/
├── manifest.json          # MV3 매니페스트
├── side_panel.html        # 앱 엔트리포인트
├── ui.js                  # 메인 UI (ExtensionUI, Shadow DOM)
├── storage.js             # StorageManager (settings, schedules, tasks)
├── gemini.js              # GeminiAPI (프롬프트, 응답 파싱, 일정 분석)
├── i18n.js                # 다국어 로드·저장
├── content.js             # 텍스트 선택 → "할 일 추가" 플로팅 버튼
├── background.js          # 사이드 패널 열기, 메시지 라우팅
├── styles.css             # 글로벌 스타일
├── locales/               # ko.json, en.json
├── icons/                 # SVG 아이콘 (PNG 변환 필요)
├── generate-icons.html    # 브라우저에서 PNG 생성
└── docs/                  # GitHub Pages용 보안 가이드
```

## 설치

1. **아이콘 준비**: `generate-icons.html`을 브라우저에서 열어 `icons/icon16.png`, `icon48.png`, `icon128.png` 생성
2. Chrome `chrome://extensions/` → 개발자 모드 → **압축해제된 확장 프로그램을 로드합니다** → 이 폴더 선택
3. 툴바 확장 아이콘 클릭 → 사이드 패널 열림

> npm/Node 설치 불필요. 아이콘 생성 스크립트(`generate-icons.js`)만 선택적으로 Node 사용.

## 설정

| 항목 | 설명 |
|------|------|
| Gemini API 키 | [Google AI Studio](https://makersuite.google.com/app/apikey)에서 발급 후 설정에 입력 |
| 모델 | 기본 `gemini-2.5-flash`, 변경 가능 |
| 프로필 | 이름, 생년월일, 직업, 성향 등 입력 시 AI 추천 향상 |
| 언어 | 한국어 / 영어 |

## 라이선스

MIT

# dAIly Planner - Chrome Extension

AI 기반 일일 계획 관리 Chrome 확장 프로그램입니다. Linear/Arc/Raycast 스타일의 다크 글래스 모피즘 디자인을 적용했습니다.

## 주요 기능

- **일간/주간/월간/연간 계획 관리**: 다양한 시간 단위로 업무 계획을 관리할 수 있습니다.
- **AI 기반 지능형 일정 분석**: 
  - Google Gemini API를 활용하여 할 일을 분석하고 최적의 시간 배정을 제안합니다
  - 사용자의 나이, 직업, 성향을 종합적으로 고려하여 맞춤형 일정을 제안합니다
  - 기존 일정과의 충돌을 자동으로 감지하고 해결합니다
  - 직업별 특성에 맞는 최적의 업무 시간대를 제안합니다
- **스마트 충돌 해결**: 새 일정 추가 시 기존 일정을 분석하여 자동으로 최적의 시간대를 찾아 배정합니다
- **드래그 앤 드롭**: 일정 항목을 드래그하여 순서를 조정할 수 있습니다
- **텍스트 선택 기능**: 웹 페이지에서 텍스트를 선택하면 "할 일로 추가" 버튼이 나타나며, 클릭하면 일정에 추가할 수 있습니다
- **로컬 스토리지**: 모든 데이터는 로컬에 저장되어 프라이버시가 보호됩니다

## 설치 방법

### 필수 사항: 아이콘 파일 생성

Chrome 확장 프로그램을 로드하기 전에 아이콘 파일이 필요합니다:

**방법 1: HTML 생성기 사용 (권장)**
1. `generate-icons.html` 파일을 브라우저에서 엽니다
2. "아이콘 생성 및 다운로드" 버튼을 클릭합니다
3. 다운로드된 `icon16.png`, `icon48.png`, `icon128.png` 파일을 `icons/` 폴더에 저장합니다

**방법 2: SVG 변환**
1. `node generate-icons.js` 실행하여 SVG 파일 생성
2. 온라인 SVG to PNG 변환기 사용하거나 ImageMagick으로 변환

**방법 3: 임시 해결**
- `manifest.json`에서 `icons` 섹션을 제거 (확장 프로그램은 작동하지만 기본 아이콘이 표시됩니다)

### 확장 프로그램 설치

1. Chrome 브라우저에서 `chrome://extensions/` 접속
2. 우측 상단의 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 이 프로젝트 폴더 선택

## 설정 방법

1. 확장 프로그램 아이콘을 클릭하여 사이드 패널 열기
2. 우측 상단의 설정 버튼(⚙️) 클릭
3. 다음 정보 입력:
   - 이름
   - 생년월일
   - 성별
   - 직업
   - 성향 (업무 스타일, 성격 등)
   - **Gemini API Key** (필수 - AI 기능 사용 시)

### Gemini API Key 발급 방법

1. [Google AI Studio](https://makersuite.google.com/app/apikey) 접속
2. Google 계정으로 로그인
3. "Create API Key" 클릭
4. 생성된 API 키를 복사하여 확장 프로그램 설정에 입력

## 사용 방법

### 일정 추가

1. 사이드 패널에서 "일정 추가" 버튼 클릭
2. 할 일 정보 입력:
   - 제목 (필수)
   - 설명
   - 우선순위
   - 예상 소요 시간
3. "AI 분석 및 일정 추가" 클릭
4. AI가 다음을 종합적으로 분석합니다:
   - 사용자의 나이, 직업, 성향을 고려한 최적 시간대
   - 기존 일정과의 충돌 여부
   - 직업별 특성에 맞는 업무 시간대
   - 에너지 레벨과 업무 효율성
5. 분석 결과와 함께 일정이 자동으로 추가되며, 충돌이 있는 경우 자동으로 조정됩니다

### 웹 페이지에서 텍스트 선택

1. 웹 페이지에서 텍스트를 드래그하여 선택
2. "할 일로 추가" 버튼이 나타남
3. 버튼 클릭 시 사이드 패널이 열리고 선택한 텍스트가 자동으로 입력됨
4. 추가 정보 입력 후 일정에 추가

### 일정 조정

- 일정 항목을 드래그하여 순서 변경 가능
- 일정 항목의 삭제 버튼(✕)으로 제거 가능

## 파일 구조

```
dAIlyplanner/
├── manifest.json          # 확장 프로그램 설정
├── side_panel.html        # 사이드 패널 HTML
├── styles.css             # 디자인 시스템 (다크 글래스 모피즘)
├── ui.js                  # 메인 UI 컨트롤러 (ES6 클래스)
├── storage.js             # 로컬 스토리지 관리
├── gemini.js              # Gemini API 통합
├── content.js             # 콘텐츠 스크립트 (텍스트 선택 감지)
├── background.js          # 백그라운드 서비스 워커
└── README.md              # 이 파일
```

## 기술 스택

- **Pure Vanilla JavaScript (ES6+)**: 프레임워크 없이 순수 JavaScript 사용
- **Shadow DOM**: 스타일 격리를 위한 Shadow DOM 사용
- **CSS3**: 커스텀 디자인 시스템 (글래스 모피즘, 애니메이션)
- **Chrome Extension Manifest V3**: 최신 Chrome 확장 프로그램 API

## 디자인 특징

- **다크 글래스 모피즘**: `backdrop-filter: blur(16px) saturate(180%)`를 활용한 반투명 효과
- **애플 스프링 애니메이션**: `cubic-bezier(0.16, 1, 0.3, 1)` 커브를 사용한 자연스러운 애니메이션
- **4px 그리드 시스템**: 모든 간격이 4px의 배수로 구성
- **레이어드 섀도우**: 깊이감을 주는 다층 그림자 효과

## Chrome 웹스토어 등록 정보

### 제품 세부정보

#### 패키지 제목
**dAIly Planner**

#### 패키지 요약
**AI-powered daily planning with side panel interface**

#### 상세 설명 (영문)

**dAIly Planner** is an intelligent daily planning Chrome extension that leverages Google's Gemini AI to help you manage your schedule efficiently. With a beautiful dark glassmorphism design inspired by Linear, Arc, and Raycast, it provides a seamless planning experience directly in your browser.

**Key Features:**

**🤖 AI-Powered Schedule Analysis**
- Automatically analyzes your tasks and suggests optimal time slots based on your profile (age, job, personality)
- Considers existing schedules to prevent conflicts and automatically resolves scheduling issues
- Provides job-specific recommendations for optimal work hours
- Supports parallel task scheduling when your calendar is full

**📅 Multi-Timeframe Planning**
- Daily, weekly, monthly, and quarterly views for comprehensive schedule management
- Drag-and-drop interface for easy schedule reorganization
- Smart conflict detection and resolution

**🌐 Web Integration**
- Select text on any webpage and instantly add it as a task
- Floating "Add as Task" button appears when you select text
- Seamless integration with your browsing workflow

**🌍 Internationalization**
- Full support for Korean and English
- Automatically detects your browser language preferences
- All UI elements and AI prompts are localized

**🔒 Privacy-First**
- All data stored locally in your browser
- No data sent to third-party servers except Google Gemini API (for AI analysis)
- Your personal information remains private

**💼 Smart Task Management**
- Priority-based scheduling
- Duration estimation and time allocation
- Task completion tracking
- Visual progress indicators

**Perfect for:**
- Professionals managing busy schedules
- Students organizing study plans
- Anyone seeking intelligent time management
- Users who want AI-assisted planning without leaving their browser

**How It Works:**
1. Set up your profile (name, job, personality) in settings
2. Add your Gemini API key for AI features
3. Start adding tasks - AI will analyze and suggest optimal times
4. Select text on web pages to quickly add tasks
5. Manage your schedule across daily, weekly, monthly, and quarterly views

Transform your daily planning with AI-powered intelligence and a beautiful, modern interface.

#### 상세 설명 (한국어)

**dAIly Planner**는 Google의 Gemini AI를 활용하여 일정을 효율적으로 관리할 수 있도록 도와주는 지능형 일일 계획 Chrome 확장 프로그램입니다. Linear, Arc, Raycast에서 영감을 받은 아름다운 다크 글래스모피즘 디자인으로 브라우저에서 바로 원활한 계획 관리 경험을 제공합니다.

**주요 기능:**

**🤖 AI 기반 일정 분석**
- 사용자 프로필(나이, 직업, 성향)을 기반으로 작업을 자동 분석하고 최적의 시간대를 제안합니다
- 기존 일정을 고려하여 충돌을 방지하고 자동으로 해결합니다
- 직업별 특성에 맞는 최적의 업무 시간대를 제안합니다
- 일정이 가득 찬 경우 병렬 작업 스케줄링을 지원합니다

**📅 다중 시간대 계획 관리**
- 일간, 주간, 월간, 분기별 보기로 포괄적인 일정 관리
- 드래그 앤 드롭 인터페이스로 쉬운 일정 재구성
- 스마트 충돌 감지 및 해결

**🌐 웹 통합**
- 모든 웹페이지에서 텍스트를 선택하여 즉시 작업으로 추가
- 텍스트 선택 시 "할 일로 추가" 버튼이 자동으로 표시
- 브라우징 워크플로우와의 원활한 통합

**🌍 국제화 지원**
- 한국어와 영어 완전 지원
- 브라우저 언어 설정 자동 감지
- 모든 UI 요소와 AI 프롬프트 현지화

**🔒 프라이버시 우선**
- 모든 데이터는 브라우저에 로컬 저장
- Google Gemini API(AI 분석용)를 제외하고 타사 서버로 데이터 전송 없음
- 개인 정보는 비공개로 유지됩니다

**💼 스마트 작업 관리**
- 우선순위 기반 스케줄링
- 소요 시간 추정 및 시간 배정
- 작업 완료 추적
- 시각적 진행률 표시

**이 확장 프로그램이 적합한 분:**
- 바쁜 일정을 관리하는 전문가
- 학습 계획을 정리하는 학생
- 지능형 시간 관리가 필요한 모든 사용자
- 브라우저를 떠나지 않고 AI 지원 계획을 원하는 사용자

**작동 방식:**
1. 설정에서 프로필(이름, 직업, 성향) 설정
2. AI 기능을 위해 Gemini API 키 추가
3. 작업 추가 시작 - AI가 분석하여 최적의 시간을 제안합니다
4. 웹 페이지에서 텍스트를 선택하여 빠르게 작업 추가
5. 일간, 주간, 월간, 분기별 보기에서 일정 관리

AI 기반 지능과 아름답고 현대적인 인터페이스로 일일 계획을 혁신하세요.

#### 카테고리
**도구 (Tools)**

#### 언어
**한국어 (Korean)**

### 개인 정보 보호 관행 (Privacy Practices)

#### 단일 목적 설명
**dAIly Planner는 사용자의 일일 일정을 관리하고 AI 기반 일정 제안을 제공하는 단일 목적을 가진 확장 프로그램입니다. 이 확장 프로그램은 사용자의 개인 일정 데이터를 로컬에 저장하고, Google Gemini API를 통해 AI 기반 일정 분석 및 제안 기능을 제공합니다. 사용자의 브라우징 활동이나 다른 웹사이트 데이터를 수집하거나 추적하지 않습니다.**

#### 원격 코드 사용 이유
**이 확장 프로그램은 Google Gemini API를 통해 AI 기반 일정 분석 및 제안 기능을 제공하기 위해 원격 코드를 사용합니다. 사용자가 일정을 추가하거나 수정할 때, Gemini API를 호출하여 최적의 시간 배정을 분석하고 제안합니다. 이는 확장 프로그램의 핵심 기능이며, 사용자가 명시적으로 요청한 경우에만 실행됩니다. 모든 API 호출은 사용자가 제공한 Gemini API 키를 사용하며, 사용자의 데이터는 Google의 개인정보 보호 정책에 따라 처리됩니다.**

#### 호스트 권한 사용 이유
**이 확장 프로그램은 `https://generativelanguage.googleapis.com/*` 호스트 권한을 요청합니다. 이 권한은 Google Gemini API와 통신하여 AI 기반 일정 분석 및 제안 기능을 제공하기 위해 필요합니다. 사용자가 일정을 추가하거나 수정할 때, Gemini API를 호출하여 최적의 시간 배정을 분석하고 제안합니다. 이는 확장 프로그램의 핵심 기능이며, 다른 웹사이트나 서버와 통신하지 않습니다.**

#### activeTab 권한 사용 이유
**activeTab 권한은 사용자가 웹 페이지에서 텍스트를 선택하고 "할 일로 추가" 버튼을 통해 일정에 추가할 수 있도록 하는 기능을 제공하기 위해 필요합니다. 이 권한은 사용자가 명시적으로 텍스트를 선택하고 버튼을 클릭할 때만 활성화되며, 사용자의 브라우징 활동을 추적하거나 모니터링하지 않습니다. 선택된 텍스트는 사용자가 명시적으로 요청한 경우에만 일정에 추가됩니다.**

#### scripting 권한 사용 이유
**scripting 권한은 content script를 웹 페이지에 주입하여 텍스트 선택 감지 및 "할 일로 추가" 버튼 표시 기능을 제공하기 위해 필요합니다. 이 권한은 사용자가 웹 페이지에서 텍스트를 선택할 때만 사용되며, 웹 페이지의 다른 기능이나 데이터에 접근하지 않습니다. 선택된 텍스트는 사용자가 명시적으로 요청한 경우에만 일정에 추가됩니다.**

#### sidePanel 권한 사용 이유
**sidePanel 권한은 Chrome의 사이드 패널 기능을 사용하여 확장 프로그램의 메인 인터페이스를 표시하기 위해 필요합니다. 이 권한은 사용자가 확장 프로그램 아이콘을 클릭하거나 웹 페이지에서 텍스트를 선택하여 "할 일로 추가" 버튼을 클릭할 때 사이드 패널을 열기 위해 사용됩니다. 사이드 패널은 사용자의 일정 관리 인터페이스를 제공하며, 웹 페이지의 콘텐츠나 데이터에 접근하지 않습니다.**

#### storage 권한 사용 이유
**storage 권한은 사용자의 일정 데이터, 설정 정보, 사용자 프로필 정보를 로컬 스토리지에 저장하기 위해 필요합니다. 이 권한은 사용자의 개인 일정 데이터를 브라우저에 로컬로 저장하여 오프라인에서도 접근할 수 있도록 하며, 사용자의 데이터를 외부 서버로 전송하지 않습니다. 저장된 데이터는 사용자의 브라우저에만 존재하며, 사용자가 명시적으로 삭제하지 않는 한 유지됩니다.**

### 그래픽 저작물 요구사항

#### 스토어 아이콘
- **크기**: 128x128 픽셀
- **형식**: PNG (24비트, 알파 채널 없음)
- **위치**: `icons/icon128.png` (이미 포함됨)

#### 스크린샷
- **크기**: 1280x800 또는 640x400 픽셀
- **형식**: JPEG 또는 24비트 PNG (알파 채널 없음)
- **최소 개수**: 1개 이상 (최대 5개)
- **권장 스크린샷:**
  1. 메인 일간 일정 화면
  2. AI 일정 분석 진행 화면
  3. 웹 페이지에서 텍스트 선택 및 추가 기능
  4. 주간/월간/분기별 보기
  5. 설정 화면

#### 작은 프로모션 타일
- **크기**: 440x280 픽셀
- **형식**: JPEG 또는 24비트 PNG (알파 채널 없음)
- **내용**: 확장 프로그램의 주요 기능을 보여주는 프로모션 이미지

#### 마키 프로모션 타일
- **크기**: 1400x560 픽셀
- **형식**: JPEG 또는 24비트 PNG (알파 채널 없음)
- **내용**: 확장 프로그램의 브랜드 및 주요 기능을 강조하는 프로모션 이미지

### 추가 정보

#### 공식 URL
**없음** (또는 GitHub 저장소 URL)

#### 홈페이지 URL
**없음** (또는 프로젝트 홈페이지 URL)

#### 지원 URL
**없음** (또는 GitHub Issues 페이지 URL)

**참고**: Chrome 웹스토어 등록 시 다음 정보를 제공하는 것이 권장됩니다:
- GitHub 저장소 URL (있는 경우)
- 프로젝트 홈페이지 URL (있는 경우)
- 지원/문의 페이지 URL (GitHub Issues 등)

### 게시 전 체크리스트

- [x] manifest.json에 모든 필수 필드 포함
- [x] 아이콘 파일 (128x128) 준비 완료
- [ ] 스크린샷 1개 이상 준비 필요
- [ ] 작은 프로모션 타일 (440x280) 준비 필요
- [ ] 마키 프로모션 타일 (1400x560) 준비 필요
- [x] 개인 정보 보호 관행 설명 작성 완료
- [x] 모든 권한 사용 이유 설명 작성 완료
- [x] 단일 목적 설명 작성 완료
- [x] 상세 설명 작성 완료 (25자 이상)

## 라이선스

이 프로젝트는 개인 사용을 위한 것입니다.


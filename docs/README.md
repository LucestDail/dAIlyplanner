# Security Guide - GitHub Pages

이 폴더는 GitHub Pages를 통해 Security Guide를 배포하기 위한 파일들을 포함합니다.

## 배포 방법

1. GitHub 저장소에 코드를 푸시합니다
2. GitHub 저장소 설정으로 이동:
   - Settings → Pages
   - Source: "Deploy from a branch" 선택
   - Branch: `main` (또는 기본 브랜치) 선택
   - Folder: `/docs` 선택
   - Save 클릭
3. 몇 분 후 다음 URL에서 확인 가능:
   - `https://[사용자명].github.io/[저장소명]/`

## 파일 구조

- `index.html`: Security Guide 메인 페이지
- `.nojekyll`: Jekyll 처리를 비활성화 (정적 HTML 파일이 제대로 서빙되도록)

## 로컬에서 테스트

로컬에서 테스트하려면 간단한 HTTP 서버를 실행할 수 있습니다:

```bash
# Python 3
python3 -m http.server 8000

# Node.js (http-server)
npx http-server -p 8000
```

그리고 브라우저에서 `http://localhost:8000` 접속


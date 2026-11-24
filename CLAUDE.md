# 프로젝트 작업 규칙

이 프로젝트는 Vanilla JavaScript를 사용하는 Vite 프로젝트입니다.
GitHub에 업로드한 후 Netlify와 연동하여 배포합니다.
코드 작업 전에 반드시 아래 규칙을 확인하세요.

1. HTML, CSS, JavaScript 코드는 각각 분리된 파일로 작성합니다.
2. `index.html`은 프로젝트 루트에, 애플리케이션의 CSS와 JavaScript 파일은 `src` 폴더에 작성합니다. `vite.config.js` 등 설정 파일은 프로젝트 루트에 둡니다.
3. JavaScript는 모듈 방식(`<script type="module">`)으로 연결하고, CSS는 JavaScript 진입 파일(`src/main.js`)에서 import하여 Vite 빌드에 포함되도록 합니다.
4. 외부 JavaScript 라이브러리는 `npm install`로 설치하고 import하여 사용합니다. CDN 방식은 사용하지 않습니다.
5. 기존 파일과 설정이 있다면 먼저 확인하고 필요한 부분만 수정합니다.

## 빌드 및 배포

- 개발 서버: `npm run dev`
- 빌드: `npm run build` (출력 폴더: `dist`)
- Netlify 설정
  - Build command: `npm run build`
  - Publish directory: `dist`

## 페이지 구성 (멀티 페이지)

- `index.html` → `src/index.js` (메인, 로그인)
- `student.html` → `src/main.js` (학생 활동)
- `teacherMonitor.html` → `src/admin.js` (교사 모니터링)
- 공통 스타일: `src/styles.css` (각 JS 진입 파일에서 import)
- 새 HTML 페이지를 추가하면 `vite.config.js`의 `build.rollupOptions.input`에도 등록해야 빌드에 포함됩니다.

## 학생 페이지 모듈 (`src/`)

- `artworks.js`: 작품 목록 (이미지는 `public/images/`에 두고 `/images/파일명`으로 참조)
- `prompts.js`: Chatbot 프롬프트, 최소·최대 대화 횟수
- `chatbot.js`: OpenAI API 호출 (브라우저에서 학생이 입력한 키 사용, 모델명 `MODEL`)
- `submit.js`: 감상 결과 제출 (Firebase 연동 예정 자리)
- `student.css`: 학생 페이지 전용 스타일

## Firebase

- npm `firebase` 패키지 사용. 초기화는 `src/firebaseConfig.js`에서만 하고 `app`, `auth`, `db`, `googleProvider`를 import해서 사용
- 설정값은 `.env`의 `VITE_FIREBASE_*` 변수 (`.env`는 Git 제외, 형식은 `.env.example` 참고)
- Netlify 배포 시 같은 변수를 Netlify 환경 변수에도 등록해야 함

## Firestore 데이터

- 컬렉션 `reflections` (학생 제출 1건 = 문서 1개, `src/submit.js`)
- 필드: `uid`, `name`, `email`, `artwork{id, artist, title, year}`, `messages[{role, content}]`, `reflection`, `chatDurationSec`, `writingDurationSec`, `submittedAt`(serverTimestamp)

## 관리자(교사) 계정

- `.env`의 `VITE_ADMIN_UIDS`(쉼표 구분)에 적은 UID가 관리자. 판별은 `src/adminConfig.js`의 `isAdmin(user)`
- 메인의 '교사 모니터링' 버튼과 `teacherMonitor.html` 접근은 관리자만 허용 (그 외는 `index.html`로 이동)
- 화면 제어는 브라우저에서만 이뤄지므로, 실제 데이터 보호는 Firestore 보안 규칙에 같은 UID를 등록해서 처리
- 교사 페이지: `src/admin.js`(Firestore 실시간 구독, 날짜·작품 필터, 삭제), `src/teacher.css`

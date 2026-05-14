# Free Mentimeter

Firebase 기반 1회용 수업용 실시간 응답 서비스입니다.

## 기능

- 학생은 로그인 없이 현재 질문에 답변합니다.
- 관리자는 아이디와 비밀번호로 로그인한 뒤 질문을 열고 답변을 초기화합니다.
- 객관식은 보기별 막대 그래프로 표시됩니다.
- 주관식은 같은 답변을 합쳐 크게 보여줍니다.
- 타임어택 주관식은 닉네임을 받고 빠른 제출 순위를 보여줍니다.

## Firebase 설정

1. Firebase Console에서 웹 앱을 만들고 Firestore, Authentication, Hosting을 켭니다.
2. Authentication에서 이메일/비밀번호 로그인을 활성화합니다.
3. `public/app.js`의 `firebaseConfig` 값을 Firebase 웹 앱 설정값으로 바꿉니다.
4. Firebase Authentication에서 관리자 이메일/비밀번호 계정을 만들고 UID를 확인합니다.
5. `firestore.rules`의 `REPLACE_WITH_YOUR_ADMIN_UID`를 관리자 UID로 바꿉니다.

## 로컬 실행

정적 파일만으로 구성되어 있어 `public/index.html`을 브라우저로 열 수 있습니다.
Firebase Auth 팝업은 배포 도메인이나 허용된 로컬 도메인에서 가장 안정적으로 동작합니다.

간단한 로컬 서버:

```bash
npm run dev
```

## 배포

Firebase CLI가 설치되어 있다면 다음 순서로 배포합니다.

```bash
firebase login
firebase deploy
```

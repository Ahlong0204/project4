# CLAUDE.md

## 프로젝트

팀 동료 3~10명이 링크로 모여 점심 메뉴 후보를 추가하고 투표하고 룰렛으로 정하는 웹 앱.
요구사항은 [PRD.md](PRD.md)가 기준이다.

## 현재 상태

- React + Vite 세팅 완료. `src/App.jsx`는 아직 Supabase 연결 확인 화면이다.
- `public/roulette.html`: 혼자 쓰는 단일 파일 룰렛 (배포 시 `/roulette.html`). 새 앱의 룰렛 디자인과 회전 로직을 여기서 가져다 쓴다.
- `supabase/schema.sql`: 테이블(rooms, participants, menus, votes), RLS 정책, Realtime 설정. 바꾸면 Supabase SQL Editor에서 다시 실행해야 한다.
- 로그인 없이 쓰기 위해 Supabase 익명 로그인(`signInAnonymously`)을 쓴다. 방장 여부는 `rooms.host_id`로 판단한다.
- 방 링크는 `/?room=<방 id>` 형식으로 만들 예정이다.

## 기술 스택

- React + Vite (JavaScript)
- Supabase: DB, Realtime으로 투표와 룰렛 결과를 실시간 동기화
- 배포: Vercel, GitHub `Ahlong0204/project4`의 `main` 브랜치

## 명령어

`.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 있어야 한다 (`.env.example` 참고).


- `npm install`: 의존성 설치
- `npm run dev`: 개발 서버
- `npm run build`: 프로덕션 빌드

## 작업 규칙

- **PRD.md 기준으로 작업한다.** [필수] 기능부터 만들고, PRD에 없는 기능이나 제외 범위에 있는 기능은 만들기 전에 먼저 물어본다.
- PRD 7장(가정)이나 8장(미정 사항)에 걸리는 결정이 필요하면 임의로 정하지 말고 확인한다.

## 언어

- 답변, 코드 주석, 커밋 메시지는 모두 **한국어**로 쓴다.

## Git

- 커밋과 push는 **사용자가 요청할 때만** 한다.
- `main` 브랜치에 바로 커밋한다.

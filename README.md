# 공용물품 대여 장부

React와 Vite로 만든 부서 공용물품 대여 장부입니다. Supabase Auth 로그인을 거쳐 대여 중인 물품을 조회하고, 대여 등록 및 오늘 날짜 기준 반납 처리를 할 수 있습니다.

## Supabase 설정

1. Supabase SQL Editor에서 [`supabase/schema.sql`](./supabase/schema.sql)을 실행합니다.
2. Supabase Authentication 설정에서 공개 회원가입을 비활성화하고, 부서원 계정은 관리자 초대 또는 대시보드에서 생성합니다.
3. Supabase 프로젝트 URL과 공개 anon/publishable 키를 프로젝트 루트의 `.env` 파일에 설정합니다.

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

서비스 역할 키(`service_role`)는 브라우저 앱이나 Vercel 환경변수에 넣지 마세요. 클라이언트에서 사용하는 anon/publishable 키는 RLS와 함께 사용해야 합니다.

## 로컬 실행

```sh
npm install
npm run dev
```

## Vercel 배포

저장소를 Vercel 프로젝트에 연결하고 빌드 명령 `npm run build`, 출력 디렉터리 `dist`를 사용합니다. Vercel 프로젝트 설정의 Environment Variables에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 등록한 후 배포하세요. 환경변수를 변경하면 다시 배포해야 적용됩니다.

RLS는 로그인된 `authenticated` 사용자에게 조회·등록·미반납 행의 오늘 날짜 반납만 허용합니다. 반납 처리 외의 열 수정 및 삭제 권한은 제공하지 않습니다.

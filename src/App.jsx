import { useEffect, useState } from "react";
import { supabase, ensureAnonymousUser } from "./lib/supabase.js";

// 세팅 확인용 화면. 방/투표 화면을 만들면 이 내용을 교체한다.
export default function App() {
  const [status, setStatus] = useState({ state: "checking", message: "Supabase 연결 확인 중…" });

  useEffect(() => {
    if (!supabase) {
      setStatus({ state: "error", message: ".env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣어 주세요." });
      return;
    }
    (async () => {
      try {
        await ensureAnonymousUser();
      } catch (e) {
        setStatus({ state: "error", message: `익명 로그인 실패: ${e.message} (Supabase에서 Anonymous Sign-Ins를 켰는지 확인하세요)` });
        return;
      }
      const { error } = await supabase.from("rooms").select("id", { head: true, count: "exact" });
      if (error) {
        setStatus({ state: "error", message: `테이블 확인 실패: ${error.message} (supabase/schema.sql을 실행했는지 확인하세요)` });
        return;
      }
      setStatus({ state: "ok", message: "Supabase 연결 완료! 익명 로그인과 테이블 모두 정상이에요." });
    })();
  }, []);

  return (
    <main className="setup">
      <h1>🍽️ 점심 메뉴 같이 정하기</h1>
      <p className={`status ${status.state}`}>{status.message}</p>
      <a href="/roulette.html">혼자 쓰는 룰렛 열기</a>
    </main>
  );
}

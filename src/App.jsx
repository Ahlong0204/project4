import { useEffect, useState } from "react";
import { supabase, ensureAnonymousUser } from "./lib/supabase.js";
import Home from "./pages/Home.jsx";
import Room from "./pages/Room.jsx";

const roomFromUrl = () => new URLSearchParams(location.search).get("room");

// 방 링크는 /?room=<방 id> 형식. 서버 라우팅 설정 없이 Vercel에서 동작한다.
export default function App() {
  const [roomId, setRoomId] = useState(roomFromUrl);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(supabase ? "" : ".env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣어 주세요.");

  useEffect(() => {
    if (!supabase) return;
    ensureAnonymousUser()
      .then(setUser)
      .catch((e) => setError(`익명 로그인 실패: ${e.message}`));
  }, []);

  useEffect(() => {
    const onPop = () => setRoomId(roomFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function go(id) {
    history.pushState(null, "", id ? `/?room=${id}` : "/");
    setRoomId(id);
  }

  if (error) return <main className="page narrow"><p className="error center">{error}</p></main>;
  if (!user) return <main className="page narrow"><p className="muted center">준비 중…</p></main>;
  if (roomId) return <Room key={roomId} roomId={roomId} user={user} onHome={() => go(null)} />;
  return <Home onEnter={go} />;
}

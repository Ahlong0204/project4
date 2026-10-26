import { useState } from "react";
import { supabase, loadNickname, saveNickname } from "../lib/supabase.js";

// 시작 화면: 닉네임을 입력하고 방을 만든다. 만든 사람이 방장이 된다.
export default function Home({ onEnter }) {
  const [nickname, setNickname] = useState(loadNickname);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createRoom(e) {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return setError("닉네임을 입력해 주세요.");
    setBusy(true);
    setError("");

    const { data: room, error: roomErr } = await supabase.from("rooms").insert({}).select("id").single();
    if (roomErr) {
      setBusy(false);
      return setError(`방을 만들지 못했어요: ${roomErr.message}`);
    }
    const { error: joinErr } = await supabase.from("participants").insert({ room_id: room.id, nickname: name });
    if (joinErr) {
      setBusy(false);
      return setError(`방에 들어가지 못했어요: ${joinErr.message}`);
    }
    saveNickname(name);
    onEnter(room.id);
  }

  return (
    <main className="page narrow">
      <header className="hero">
        <div className="hero-emoji">🍱</div>
        <h1>점심 메뉴 같이 정하기</h1>
        <p>방을 만들고 링크를 팀 메신저에 공유하세요.<br />후보를 모아 투표하고, 룰렛으로 정해요.</p>
      </header>

      <form className="card stack" onSubmit={createRoom}>
        <label className="field">
          <span>내 닉네임</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} placeholder="예: 김대리" autoComplete="off" />
        </label>
        <button className="btn primary big" type="submit" disabled={busy}>
          {busy ? "만드는 중…" : "방 만들기"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <a className="sub-link" href="/roulette.html">혼자 쓰는 룰렛 열기</a>
    </main>
  );
}

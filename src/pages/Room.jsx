import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, loadNickname, saveNickname } from "../lib/supabase.js";
import { copyText } from "../lib/clipboard.js";
import { SPIN_MS, buildSegments, countVotes, pickWeighted, targetRotation } from "../lib/roulette.js";
import Wheel from "../components/Wheel.jsx";

export default function Room({ roomId, user, onHome }) {
  const [status, setStatus] = useState("loading"); // loading | missing | ready
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [menus, setMenus] = useState([]);
  const [votes, setVotes] = useState([]);
  const [error, setError] = useState("");

  const [rotation, setRotation] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // 방의 모든 데이터를 다시 불러온다. 데이터가 작아서 변경이 생길 때마다 통째로 새로 읽는다.
  const load = useCallback(async () => {
    const [r, p, m, v] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
      supabase.from("participants").select("*").eq("room_id", roomId).order("joined_at"),
      supabase.from("menus").select("*").eq("room_id", roomId).order("created_at"),
      supabase.from("votes").select("*").eq("room_id", roomId),
    ]);
    // 잘못된 id이거나 만료된 방은 조회되지 않는다
    if (r.error || !r.data) return setStatus("missing");
    setRoom(r.data);
    setParticipants(p.data ?? []);
    setMenus(m.data ?? []);
    setVotes(v.data ?? []);
    setStatus("ready");
  }, [roomId]);

  // 실시간 동기화: 이 방의 데이터가 바뀌면 다시 불러온다
  useEffect(() => {
    load();
    const byRoom = { schema: "public", filter: `room_id=eq.${roomId}` };
    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, load)
      .on("postgres_changes", { event: "*", table: "participants", ...byRoom }, load)
      .on("postgres_changes", { event: "*", table: "menus", ...byRoom }, load)
      .on("postgres_changes", { event: "*", table: "votes", ...byRoom }, load)
      .subscribe();
    // 휴대폰 화면이 꺼지면 실시간 연결이 끊길 수 있어서, 다시 화면에 돌아오면 새로 읽는다
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomId, load]);

  const segments = useMemo(() => buildSegments(menus, votes), [menus, votes]);
  const counts = useMemo(() => countVotes(votes), [votes]);
  const myVote = votes.find((v) => v.user_id === user.id)?.menu_id;
  const isHost = room?.host_id === user.id;
  const joined = participants.some((p) => p.user_id === user.id);
  const decided = Boolean(room?.spun_at);
  const resultMenu = menus.find((m) => m.id === room?.result_menu_id);

  // 방장이 룰렛을 돌리면(spun_at이 바뀌면) 모든 참여자 화면에서 같은 결과로 회전시킨다
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const lastSpun = useRef(undefined);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!room) return;
    const spunAt = room.spun_at;
    if (spunAt === lastSpun.current) return;
    const firstLoad = lastSpun.current === undefined;
    lastSpun.current = spunAt;
    if (!spunAt) return;

    const seg = segmentsRef.current.find((s) => s.id === room.result_menu_id);
    if (firstLoad) {
      // 이미 정해진 방에 들어오면 회전 없이 결과 위치로 바로 맞춘다
      setAnimate(false);
      if (seg) setRotation((r) => targetRotation(r, seg, room.spin_angle, 0));
      return;
    }
    setShowResult(false);
    setSpinning(true);
    setAnimate(true);
    if (seg) setRotation((r) => targetRotation(r, seg, room.spin_angle, 5 + Math.floor(Math.random() * 3)));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSpinning(false);
      setShowResult(true);
    }, SPIN_MS + 150);
  }, [room]);

  async function spin() {
    if (spinning || menus.length < 2) return;
    const seg = pickWeighted(segments);
    // 칸 경계에 걸리지 않도록 칸 안쪽 10~90% 위치에서 멈춘다
    const fraction = 0.1 + Math.random() * 0.8;
    const { data, error: err } = await supabase
      .from("rooms")
      .update({ result_menu_id: seg.id, spin_angle: fraction, spun_at: new Date().toISOString() })
      .eq("id", roomId)
      .select()
      .single();
    if (err) return setError(`룰렛을 돌리지 못했어요: ${err.message}`);
    setRoom(data);
  }

  async function vote(menuId) {
    setError("");
    const { error: err } = await supabase
      .from("votes")
      .upsert({ room_id: roomId, user_id: user.id, menu_id: menuId }, { onConflict: "room_id,user_id" });
    if (err) return setError(`투표하지 못했어요: ${err.message}`);
    load();
  }

  if (status === "loading") return <main className="page narrow"><p className="muted center">불러오는 중…</p></main>;

  if (status === "missing") {
    return (
      <main className="page narrow">
        <div className="card stack center">
          <div className="hero-emoji">🕛</div>
          <h2>방이 없거나 만료됐어요</h2>
          <p className="muted">방은 만든 날 자정에 사라져요.</p>
          <button className="btn primary" onClick={onHome}>새 방 만들기</button>
        </div>
      </main>
    );
  }

  if (!joined) return <JoinForm roomId={roomId} onJoined={load} />;

  return (
    <main className="page">
      <header className="room-head">
        <h1>🍽️ 오늘 점심 뭐 먹지?</h1>
        <ShareLink roomId={roomId} />
      </header>

      <div className="room-grid">
        <section className="card wheel-card">
          <Wheel segments={segments} rotation={rotation} animate={animate} />
          {decided && !spinning && resultMenu && (
            <p className="decided">오늘의 점심은 <strong>{resultMenu.name}</strong></p>
          )}
          {isHost ? (
            <button className="btn primary big" onClick={spin} disabled={spinning || menus.length < 2}>
              {spinning ? "돌아가는 중…" : decided ? "다시 돌리기" : "룰렛 돌리기"}
            </button>
          ) : (
            <p className="muted">{spinning ? "룰렛이 돌아가는 중…" : "방장이 룰렛을 돌려요"}</p>
          )}
          {menus.length < 2 && <p className="muted small">메뉴 후보가 2개 이상 있어야 돌릴 수 있어요.</p>}
          <p className="muted small">표를 많이 받은 메뉴일수록 칸이 넓어요.</p>
        </section>

        <section className="card stack">
          <div className="section-head">
            <h2>메뉴 후보</h2>
            <span className="muted small">{decided ? "결정 후에는 투표할 수 없어요" : "눌러서 투표 (1인 1표)"}</span>
          </div>
          {menus.length === 0 && <p className="muted">아직 후보가 없어요. 먹고 싶은 메뉴를 추가해 보세요.</p>}
          <ul className="menu-list">
            {menus.map((m) => {
              const n = counts.get(m.id) ?? 0;
              const color = segments.find((s) => s.id === m.id)?.color;
              return (
                <li key={m.id}>
                  <button
                    className={`menu-item ${myVote === m.id ? "voted" : ""}`}
                    onClick={() => vote(m.id)}
                    disabled={decided || spinning}
                    aria-pressed={myVote === m.id}
                  >
                    <span className="dot" style={{ background: color ?? "transparent" }} />
                    <span className="menu-name">{m.name}</span>
                    {myVote === m.id && <span className="mine">내 표</span>}
                    <span className="votes">{n}표</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!decided && <AddMenu roomId={roomId} onAdded={load} />}
        </section>

        <section className="card stack">
          <h2>참여자 {participants.length}명</h2>
          <ul className="people">
            {participants.map((p) => (
              <li key={p.user_id}>
                {p.nickname}
                {p.user_id === room.host_id && " 👑"}
                {p.user_id === user.id && <span className="muted"> (나)</span>}
                {votes.some((v) => v.user_id === p.user_id) && " ✅"}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {error && <p className="error center">{error}</p>}

      {showResult && resultMenu && (
        <ResultOverlay
          menu={resultMenu}
          votes={counts.get(resultMenu.id) ?? 0}
          total={votes.length}
          onClose={() => setShowResult(false)}
        />
      )}
    </main>
  );
}

function JoinForm({ roomId, onJoined }) {
  const [nickname, setNickname] = useState(loadNickname);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join(e) {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return setError("닉네임을 입력해 주세요.");
    setBusy(true);
    const { error: err } = await supabase.from("participants").insert({ room_id: roomId, nickname: name });
    setBusy(false);
    if (err) return setError(`입장하지 못했어요: ${err.message}`);
    saveNickname(name);
    onJoined();
  }

  return (
    <main className="page narrow">
      <header className="hero">
        <div className="hero-emoji">👋</div>
        <h1>점심 메뉴 정하는 방</h1>
        <p>닉네임을 입력하고 들어가세요.</p>
      </header>
      <form className="card stack" onSubmit={join}>
        <label className="field">
          <span>내 닉네임</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} placeholder="예: 김대리" autoComplete="off" autoFocus />
        </label>
        <button className="btn primary big" type="submit" disabled={busy}>{busy ? "들어가는 중…" : "입장하기"}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}

function AddMenu({ roomId, onAdded }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function add(e) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    const { error: err } = await supabase.from("menus").insert({ room_id: roomId, name: value });
    if (err) return setError(err.code === "23505" ? "이미 있는 메뉴예요." : `추가하지 못했어요: ${err.message}`);
    setName("");
    setError("");
    onAdded();
  }

  return (
    <form onSubmit={add}>
      <div className="add-row">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={10} placeholder="메뉴 추가 (예: 마라탕)" aria-label="추가할 메뉴 이름" autoComplete="off" />
        <button className="btn dark" type="submit">추가</button>
      </div>
      {error && <p className="error small">{error}</p>}
    </form>
  );
}

function ShareLink({ roomId }) {
  const [msg, setMsg] = useState("");
  const link = `${location.origin}/?room=${roomId}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "점심 메뉴 같이 정해요", url: link });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    setMsg((await copyText(link)) ? "링크를 복사했어요! 메신저에 붙여넣으세요." : "복사하지 못했어요. 주소창의 링크를 공유해 주세요.");
  }

  return (
    <div className="share">
      <button className="btn outline" onClick={share}>🔗 링크 공유</button>
      {msg && <p className="muted small" role="status">{msg}</p>}
    </div>
  );
}

function ResultOverlay({ menu, votes, total, onClose }) {
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    const voteText = total > 0 ? ` (${total}표 중 ${votes}표)` : "";
    const text = `🍱 오늘 점심은 ${menu.name}!${voteText}\n점심 메뉴 룰렛으로 정했어요`;
    setMsg((await copyText(text)) ? "복사됐어요! 메신저에 붙여넣으세요." : "복사하지 못했어요.");
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="result-name" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="result">
        <div className="label">오늘의 점심은</div>
        <div className="emoji">🍽️</div>
        <div className="name" id="result-name">{menu.name}</div>
        {total > 0 && <p className="muted">{total}표 중 {votes}표</p>}
        <div className="result-actions">
          <button className="btn primary" onClick={copy} autoFocus>결과 복사</button>
          <button className="btn outline" onClick={onClose}>닫기</button>
        </div>
        <p className="muted small" role="status">{msg}</p>
      </div>
    </div>
  );
}

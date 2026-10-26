export const SPIN_MS = 3000;

export const COLORS = [
  "#ffb4a2", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff", "#a0c4ff",
  "#bdb2ff", "#ffc6ff", "#ffadad", "#d0f4de", "#fbe0c3", "#c8e7ff",
];

// 메뉴별 득표수
export function countVotes(votes) {
  const counts = new Map();
  votes.forEach((v) => counts.set(v.menu_id, (counts.get(v.menu_id) ?? 0) + 1));
  return counts;
}

// 득표수만큼 칸 크기를 정한다. 0표 메뉴는 빠지고, 아무도 투표하지 않았으면 모두 같은 크기.
// 각도는 12시 방향에서 시계 방향으로 측정한다.
export function buildSegments(menus, votes) {
  const counts = countVotes(votes);
  const anyVotes = menus.some((m) => counts.has(m.id));
  const items = menus
    .map((m, i) => ({
      id: m.id,
      name: m.name,
      color: COLORS[i % COLORS.length],
      weight: anyVotes ? counts.get(m.id) ?? 0 : 1,
    }))
    .filter((s) => s.weight > 0);

  const sum = items.reduce((acc, s) => acc + s.weight, 0);
  let start = 0;
  return items.map((s) => {
    const size = (s.weight / sum) * 360;
    const seg = { ...s, start, size };
    start += size;
    return seg;
  });
}

// 칸 크기(확률)에 비례해서 하나를 뽑는다
export function pickWeighted(segments) {
  const r = Math.random() * 360;
  return segments.find((s) => r < s.start + s.size) ?? segments[segments.length - 1];
}

// 결과 칸의 fraction(0~1) 위치가 12시 방향 화살표에 오도록 하는 회전값.
// fraction을 공유하므로 참여자마다 칸 배치가 조금 달라도 같은 메뉴에서 멈춘다.
export function targetRotation(current, segment, fraction, extraTurns) {
  const target = segment.start + segment.size * fraction;
  const finalMod = (360 - target) % 360;
  const currentMod = ((current % 360) + 360) % 360;
  return current + 360 * extraTurns + ((finalMod - currentMod + 360) % 360);
}

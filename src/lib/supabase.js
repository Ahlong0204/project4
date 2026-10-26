import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// .env가 비어 있으면 앱 화면에서 안내할 수 있도록 null로 둔다
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

// 로그인 없이 쓰기 위해 익명 사용자로 로그인한다. 같은 브라우저면 같은 사용자로 유지된다.
// 동시에 여러 번 불려도 익명 사용자가 하나만 만들어지도록 진행 중인 요청을 재사용한다.
let pending = null;
export function ensureAnonymousUser() {
  pending ??= (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session.user;
    const { data: signIn, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return signIn.user;
  })().catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
}

const NICKNAME_KEY = "lunch-nickname";

export function loadNickname() {
  try { return localStorage.getItem(NICKNAME_KEY) ?? ""; } catch { return ""; }
}
export function saveNickname(name) {
  try { localStorage.setItem(NICKNAME_KEY, name); } catch {}
}

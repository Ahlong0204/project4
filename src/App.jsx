import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

function getLocalDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatDate(date) {
  if (!date) return '-'
  const [year, month, day] = date.split('-')
  return `${year}.${month}.${day}`
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) setError(signInError.message)
    setSubmitting(false)
  }

  return (
    <main className="login-layout">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">DEPARTMENT EQUIPMENT</p>
        <h1>공용물품 대여 장부</h1>
        <p className="login-description">
          부서 계정으로 로그인해 대여 현황을 확인하세요.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">이메일</label>
          <input
            autoComplete="username"
            id="login-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
            type="email"
            value={email}
          />
          <label htmlFor="login-password">비밀번호</label>
          <input
            autoComplete="current-password"
            id="login-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호 입력"
            required
            type="password"
            value={password}
          />
          {error && (
            <p className="alert alert-error" role="alert">
              로그인에 실패했습니다: {error}
            </p>
          )}
          <button className="button button-primary login-button" disabled={submitting}>
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <p className="login-footnote">
          계정 발급은 Supabase 관리자에게 문의해 주세요.
        </p>
      </section>
    </main>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [rentals, setRentals] = useState([])
  const [loadingRentals, setLoadingRentals] = useState(false)
  const [itemName, setItemName] = useState('')
  const [borrower, setBorrower] = useState('')
  const [rentedOn, setRentedOn] = useState(getLocalDate)
  const [saving, setSaving] = useState(false)
  const [returningId, setReturningId] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!supabase) return undefined

    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setNotice({ type: 'error', text: `세션 확인 실패: ${error.message}` })
      setSession(data?.session ?? null)
      setAuthReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setRentals([])
      return undefined
    }

    let active = true
    setLoadingRentals(true)
    supabase
      .from('rentals')
      .select('id, item_name, borrower, rented_on')
      .is('returned_on', null)
      .order('rented_on', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setNotice({ type: 'error', text: `대여 목록을 불러오지 못했습니다: ${error.message}` })
        } else {
          setRentals(data ?? [])
        }
        setLoadingRentals(false)
      })

    return () => {
      active = false
    }
  }, [session])

  async function handleRegister(event) {
    event.preventDefault()
    if (!supabase || !session) return

    setSaving(true)
    setNotice(null)
    const { data, error } = await supabase
      .from('rentals')
      .insert({
        item_name: itemName.trim(),
        borrower: borrower.trim(),
        rented_on: rentedOn,
      })
      .select('id, item_name, borrower, rented_on')
      .single()

    if (error) {
      setNotice({ type: 'error', text: `대여 등록에 실패했습니다: ${error.message}` })
    } else {
      setRentals((current) =>
        [data, ...current].sort((a, b) => b.rented_on.localeCompare(a.rented_on)),
      )
      setItemName('')
      setBorrower('')
      setRentedOn(getLocalDate())
      setNotice({ type: 'success', text: '대여 내역을 등록했습니다.' })
    }
    setSaving(false)
  }

  async function handleReturn(rental) {
    if (!supabase || !session) return

    setReturningId(rental.id)
    setNotice(null)
    const { error } = await supabase
      .from('rentals')
      .update({ returned_on: getLocalDate() })
      .eq('id', rental.id)
      .is('returned_on', null)

    if (error) {
      setNotice({ type: 'error', text: `반납 처리에 실패했습니다: ${error.message}` })
    } else {
      setRentals((current) => current.filter((item) => item.id !== rental.id))
      setNotice({ type: 'success', text: `${rental.item_name} 반납을 처리했습니다.` })
    }
    setReturningId(null)
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) setNotice({ type: 'error', text: `로그아웃에 실패했습니다: ${error.message}` })
  }

  if (!supabase) {
    return (
      <main className="setup-layout">
        <section className="setup-card">
          <p className="eyebrow">SETUP REQUIRED</p>
          <h1>Supabase 환경변수를 확인해 주세요</h1>
          <p>
            프로젝트 루트의 <code>.env</code> 파일에
            <code> VITE_SUPABASE_URL</code>과
            <code> VITE_SUPABASE_ANON_KEY</code>를 설정한 뒤 개발 서버를
            다시 시작하세요.
          </p>
        </section>
      </main>
    )
  }

  if (!authReady) {
    return (
      <main className="setup-layout">
        <p className="loading-message">로그인 정보를 확인하고 있습니다...</p>
      </main>
    )
  }

  if (!session) return <LoginForm />

  return (
    <div className="app-shell">
      <header className="topbar">
        <a aria-label="공용물품 대여 장부 홈" className="topbar-brand" href="/">
          <span className="brand-mark brand-mark-small" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>공용물품 대여 장부</span>
        </a>
        <div className="account-area">
          <span className="account-email">{session.user.email}</span>
          <button className="button button-quiet" onClick={handleSignOut} type="button">
            로그아웃
          </button>
        </div>
      </header>

      <main className="main-content">
        <section className="page-heading">
          <div>
            <p className="eyebrow">SHARED EQUIPMENT</p>
            <h1>대여 현황</h1>
            <p>부서 공용물품의 대여와 반납을 한곳에서 관리하세요.</p>
          </div>
          <div className="summary-card">
            <span className="summary-icon" aria-hidden="true">↗</span>
            <span className="summary-number">{rentals.length}</span>
            <span className="summary-label">대여 중</span>
          </div>
        </section>

        {notice && (
          <div className={`alert alert-${notice.type}`} role="status">
            <span>{notice.text}</span>
            <button
              aria-label="알림 닫기"
              className="alert-close"
              onClick={() => setNotice(null)}
              type="button"
            >
              ×
            </button>
          </div>
        )}

        <section aria-labelledby="register-heading" className="panel register-panel">
          <div className="panel-heading">
            <div className="section-icon" aria-hidden="true">＋</div>
            <div>
              <h2 id="register-heading">새 대여 등록</h2>
              <p>대여 정보를 입력해 장부에 추가하세요.</p>
            </div>
          </div>
          <form className="register-form" onSubmit={handleRegister}>
            <div className="field">
              <label htmlFor="item-name">물품명</label>
              <input
                id="item-name"
                maxLength={120}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="예: 회의실 프로젝터"
                required
                value={itemName}
              />
            </div>
            <div className="field">
              <label htmlFor="borrower">대여자</label>
              <input
                id="borrower"
                maxLength={120}
                onChange={(event) => setBorrower(event.target.value)}
                placeholder="이름 입력"
                required
                value={borrower}
              />
            </div>
            <div className="field date-field">
              <label htmlFor="rented-on">대여일</label>
              <input
                id="rented-on"
                max={getLocalDate()}
                onChange={(event) => setRentedOn(event.target.value)}
                required
                type="date"
                value={rentedOn}
              />
            </div>
            <button className="button button-primary register-button" disabled={saving}>
              <span aria-hidden="true">＋</span>
              {saving ? '등록 중...' : '대여 등록'}
            </button>
          </form>
        </section>

        <section aria-labelledby="rentals-heading" className="panel rentals-panel">
          <div className="list-heading">
            <div>
              <h2 id="rentals-heading">현재 대여 중인 물품</h2>
              <p>반납이 완료되면 목록에서 자동으로 사라집니다.</p>
            </div>
            <span className="count-badge">{rentals.length}건</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">물품명</th>
                  <th scope="col">대여자</th>
                  <th scope="col">대여일</th>
                  <th scope="col">상태</th>
                  <th scope="col"><span className="visually-hidden">반납 처리</span></th>
                </tr>
              </thead>
              <tbody>
                {loadingRentals ? (
                  <tr>
                    <td className="table-message" colSpan="5">대여 목록을 불러오는 중입니다...</td>
                  </tr>
                ) : rentals.length === 0 ? (
                  <tr>
                    <td className="table-message empty-state" colSpan="5">
                      <span className="empty-icon" aria-hidden="true">✓</span>
                      <strong>대여 중인 물품이 없습니다</strong>
                      <span>새 대여를 등록하면 여기에 표시됩니다.</span>
                    </td>
                  </tr>
                ) : (
                  rentals.map((rental) => (
                    <tr key={rental.id}>
                      <td className="item-cell">{rental.item_name}</td>
                      <td>{rental.borrower}</td>
                      <td>{formatDate(rental.rented_on)}</td>
                      <td><span className="status-pill"><span />대여 중</span></td>
                      <td className="action-cell">
                        <button
                          className="button button-return"
                          disabled={returningId === rental.id}
                          onClick={() => handleReturn(rental)}
                          type="button"
                        >
                          {returningId === rental.id ? '처리 중...' : '반납'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        <footer className="page-footer">함께 사용하는 물품, 반납까지 꼼꼼하게 기록해요.</footer>
      </main>
    </div>
  )
}

export default App

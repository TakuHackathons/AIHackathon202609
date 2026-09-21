import { useState, type FormEvent } from 'react';
import { useAdmin } from './AdminContext';

export function AdminAuth() {
  const { me, error, passwordLoginVisible, setPasswordLoginVisible, loginWithPasskey, loginWithPassword, registerPasskey, run } =
    useAdmin();
  const [login, setLogin] = useState({ username: '', password: '' });
  const [passkeyName, setPasskeyName] = useState('この端末のPasskey');

  if (!me) {
    const submit = (event: FormEvent) => {
      event.preventDefault();
      void run(() => loginWithPassword(login.username, login.password));
    };
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <p className="admin-kicker">EMPATHY AI COMPANION</p>
          <h1>教員管理画面</h1>
          {error && <p className="admin-error">{error}</p>}
          {passwordLoginVisible ? (
            <>
              <h2>パスワードでログイン</h2>
              <p>Passkeyを登録していない教員は、ユーザー名とパスワードでログインします。</p>
              <form onSubmit={submit}>
                <input
                  required
                  placeholder="ユーザー名"
                  value={login.username}
                  onChange={(event) => setLogin({ ...login, username: event.target.value })}
                />
                <input
                  required
                  type="password"
                  placeholder="パスワード"
                  value={login.password}
                  onChange={(event) => setLogin({ ...login, password: event.target.value })}
                />
                <button>ログインしてPasskeyを登録</button>
                <button type="button" onClick={() => setPasswordLoginVisible(false)}>
                  戻る
                </button>
              </form>
            </>
          ) : (
            <>
              <p>Passkeyで安全にログインします。</p>
              <button className="admin-primary" onClick={() => void run(loginWithPasskey)}>
                Passkeyでログイン
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-login">
        <p className="admin-kicker">PASSKEY REGISTRATION</p>
        <h1>Passkeyを登録してください</h1>
        <p>登録が完了すると、パスワードではログインできなくなります。</p>
        {error && <p className="admin-error">{error}</p>}
        <input value={passkeyName} onChange={(event) => setPasskeyName(event.target.value)} aria-label="Passkey名" />
        <button className="admin-primary" onClick={() => void run(() => registerPasskey(passkeyName))}>
          Passkeyを登録
        </button>
      </section>
    </main>
  );
}

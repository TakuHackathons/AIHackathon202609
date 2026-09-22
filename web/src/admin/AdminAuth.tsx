import { useEffect, useState, type FormEvent } from 'react';
import { useAdmin } from './AdminContext';
import { AdminLocaleSwitch, useAdminI18n } from './i18n';

export function AdminAuth() {
  const { me, error, passwordLoginVisible, setPasswordLoginVisible, loginWithPasskey, loginWithPassword, registerPasskey, run } =
    useAdmin();
  const { t, locale } = useAdminI18n();
  const [login, setLogin] = useState({ username: '', password: '' });
  const [passkeyName, setPasskeyName] = useState(t('auth.defaultPasskeyName'));
  useEffect(() => setPasskeyName(t('auth.defaultPasskeyName')), [locale, t]);

  if (!me) {
    const submit = (event: FormEvent) => {
      event.preventDefault();
      void run(() => loginWithPassword(login.username, login.password));
    };
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <AdminLocaleSwitch />
          <p className="admin-kicker">EMPATHY AI COMPANION</p>
          <h1>{t('auth.title')}</h1>
          {error && <p className="admin-error">{error}</p>}
          {passwordLoginVisible ? (
            <>
              <h2>{t('auth.passwordTitle')}</h2>
              <p>{t('auth.passwordHelp')}</p>
              <form onSubmit={submit}>
                <input
                  required
                  placeholder={t('auth.username')}
                  value={login.username}
                  onChange={(event) => setLogin({ ...login, username: event.target.value })}
                />
                <input
                  required
                  type="password"
                  placeholder={t('auth.password')}
                  value={login.password}
                  onChange={(event) => setLogin({ ...login, password: event.target.value })}
                />
                <button>{t('auth.loginAndRegister')}</button>
                <button type="button" onClick={() => setPasswordLoginVisible(false)}>
                  {t('common.back')}
                </button>
              </form>
            </>
          ) : (
            <>
              <p>{t('auth.passkeyHelp')}</p>
              <button className="admin-primary" onClick={() => void run(loginWithPasskey)}>
                {t('auth.passkeyLogin')}
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
        <AdminLocaleSwitch />
        <p className="admin-kicker">{t('kicker.passkeyRegistration')}</p>
        <h1>{t('auth.registrationTitle')}</h1>
        <p>{t('auth.registrationHelp')}</p>
        {error && <p className="admin-error">{error}</p>}
        <input value={passkeyName} onChange={(event) => setPasskeyName(event.target.value)} aria-label={t('auth.passkeyName')} />
        <button className="admin-primary" onClick={() => void run(() => registerPasskey(passkeyName))}>
          {t('auth.registerPasskey')}
        </button>
      </section>
    </main>
  );
}

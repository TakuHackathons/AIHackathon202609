import { useEffect, useState, type FormEvent } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import IssuedPasswordPanel, { type IssuedPassword } from '../IssuedPasswordPanel';
import { useAdminI18n } from '../i18n';

export default function SettingsPage() {
  const { me, passkeys, refresh, registerPasskey, run, setNotice } = useAdmin();
  const { t, locale } = useAdminI18n();
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [passkeyName, setPasskeyName] = useState(t('auth.defaultPasskeyName'));
  const [issuedPassword, setIssuedPassword] = useState<IssuedPassword | null>(null);

  useEffect(() => {
    if (me) setProfile({ name: me.user.name, email: me.user.email });
  }, [me]);
  useEffect(() => setPasskeyName(t('auth.defaultPasskeyName')), [locale, t]);

  const formatDate = (value: number | null) =>
    value
      ? new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
      : t('settings.neverUsed');

  const save = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await adminApi('teachers/' + me!.user.id, { method: 'PATCH', body: JSON.stringify(profile) });
      await refresh();
      setNotice(t('settings.profileUpdated'));
    });
  };

  const addPasskey = (event: FormEvent) => {
    event.preventDefault();
    void run(() => registerPasskey(passkeyName));
  };

  const issuePassword = () =>
    run(async () => {
      const result = await adminApi('auth/password/issue', { method: 'POST', body: '{}' });
      setIssuedPassword({ username: result.username, password: result.password, expiresAt: result.expiresAt });
      setNotice(t('settings.passwordIssued'));
    });

  return (
    <section id="settings">
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">{t('kicker.account')}</p>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.description')}</p>
        </div>
      </div>
      <form className="admin-card admin-form" onSubmit={save}>
        <h2>{t('settings.profile')}</h2>
        <div className="admin-grid">
          <input
            required
            placeholder={t('teachers.name')}
            value={profile.name}
            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
          />
          <input
            type="email"
            placeholder={t('teachers.email')}
            value={profile.email}
            onChange={(event) => setProfile({ ...profile, email: event.target.value })}
          />
        </div>
        <button className="admin-primary">{t('settings.saveProfile')}</button>
      </form>
      <div className="admin-card passkey-settings">
        <h2>{t('settings.passkey')}</h2>
        <form className="passkey-add-form" onSubmit={addPasskey}>
          <strong>{t('settings.addPasskeyTitle')}</strong>
          <p>{t('settings.addPasskeyHelp')}</p>
          <div>
            <input
              required
              maxLength={80}
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              aria-label={t('auth.passkeyName')}
            />
            <button className="admin-primary">{t('settings.addPasskey')}</button>
          </div>
        </form>
        <div className="other-device-registration">
          <strong>{t('settings.otherDevice')}</strong>
          <p>{t('settings.otherDeviceHelp')}</p>
          <span>
            {t('auth.username')}: {me?.user.username}
          </span>
          <button className="admin-secondary" onClick={() => void issuePassword()}>
            {t('settings.issuePassword')}
          </button>
          {issuedPassword && <IssuedPasswordPanel issued={issuedPassword} onClose={() => setIssuedPassword(null)} />}
        </div>
        <div className="passkey-list">
          {passkeys.map((passkey) => (
            <div className="key-row" key={passkey.id}>
              <span>
                <strong>{passkey.name}</strong>
                <small>
                  {t('settings.registeredAt')}: {formatDate(passkey.createdAt)} / {t('settings.lastUsedAt')}:{' '}
                  {formatDate(passkey.lastUsedAt)}
                </small>
              </span>
              <button
                onClick={() =>
                  void run(async () => {
                    await adminApi('auth/passkeys/' + passkey.id, { method: 'DELETE' });
                    window.location.assign('/admin');
                  })
                }
              >
                {t('common.delete')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

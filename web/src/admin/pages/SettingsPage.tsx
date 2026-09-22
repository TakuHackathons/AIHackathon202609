import { useEffect, useState, type FormEvent } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { useAdminI18n } from '../i18n';
export default function SettingsPage() {
  const { me, passkeys, refresh, run, setNotice } = useAdmin();
  const { t, locale } = useAdminI18n();
  const [profile, setProfile] = useState({ name: '', email: '' });
  useEffect(() => {
    if (me) setProfile({ name: me.user.name, email: me.user.email });
  }, [me]);
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
  const issuePassword = () =>
    run(async () => {
      const result = await adminApi('auth/password/issue', { method: 'POST', body: '{}' });
      setNotice(t('settings.usernamePassword', { username: result.username, password: result.password }));
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
      <div className="admin-card">
        <h2>{t('settings.passkey')}</h2>
        <div className="key-add">
          <span>
            {t('auth.username')}: {me?.user.username}
          </span>
          <button className="admin-primary" onClick={() => void issuePassword()}>
            {t('settings.issuePassword')}
          </button>
        </div>
        {passkeys.map((passkey) => (
          <div className="key-row" key={passkey.id}>
            <span>
              <strong>{passkey.name}</strong>
              <small>
                {t('settings.registeredAt')}: {formatDate(passkey.createdAt)} / {t('settings.lastUsedAt')}: {formatDate(passkey.lastUsedAt)}
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
    </section>
  );
}

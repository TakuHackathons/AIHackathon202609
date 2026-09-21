import { useEffect, useState, type FormEvent } from 'react';
import { adminApi, formatDate } from '../api';
import { useAdmin } from '../AdminContext';

export default function SettingsPage() {
  const { me, passkeys, refresh, run, setNotice } = useAdmin();
  const [profile, setProfile] = useState({ name: '', email: '' });

  useEffect(() => {
    if (me) setProfile({ name: me.user.name, email: me.user.email });
  }, [me]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await adminApi('teachers/' + me!.user.id, { method: 'PATCH', body: JSON.stringify(profile) });
      await refresh();
      setNotice('プロフィールを更新しました。');
    });
  };
  const issuePassword = () =>
    run(async () => {
      const result = await adminApi('auth/password/issue', { method: 'POST', body: '{}' });
      setNotice(`ユーザー名: ${result.username} / パスワード: ${result.password}`);
    });

  return (
    <section id="settings">
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">ACCOUNT</p>
          <h1>アカウント設定</h1>
          <p>プロフィールとログイン方法を管理します。</p>
        </div>
      </div>
      <form className="admin-card admin-form" onSubmit={save}>
        <h2>プロフィール</h2>
        <div className="admin-grid">
          <input
            required
            placeholder="氏名"
            value={profile.name}
            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
          />
          <input
            type="email"
            placeholder="メールアドレス"
            value={profile.email}
            onChange={(event) => setProfile({ ...profile, email: event.target.value })}
          />
        </div>
        <button className="admin-primary">プロフィールを保存</button>
      </form>
      <div className="admin-card">
        <h2>Passkey</h2>
        <div className="key-add">
          <span>ユーザー名: {me?.user.username}</span>
          <button className="admin-primary" onClick={() => void issuePassword()}>
            パスワードを発行
          </button>
        </div>
        {passkeys.map((passkey) => (
          <div className="key-row" key={passkey.id}>
            <span>
              <strong>{passkey.name}</strong>
              <small>
                登録: {formatDate(passkey.createdAt)} / 最終使用: {formatDate(passkey.lastUsedAt)}
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
              削除
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

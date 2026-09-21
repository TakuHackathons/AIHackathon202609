import { useEffect, useState, type FormEvent } from 'react';
import { adminApi, formatDate } from '../api';
import { useAdmin } from '../AdminContext';

export default function SettingsPage() {
  const { me, passkeys, refresh, run, setNotice } = useAdmin();
  const [profile, setProfile] = useState({ name: '', email: '', department: '', subjects: '', responsibilities: '' });

  useEffect(() => {
    if (!me) return;
    setProfile({
      name: me.user.name,
      email: me.user.email,
      department: me.user.department,
      subjects: me.user.subjects,
      responsibilities: me.user.responsibilities,
    });
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
            value={profile.name}
            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
            placeholder="氏名"
          />
          <input
            value={profile.email}
            onChange={(event) => setProfile({ ...profile, email: event.target.value })}
            placeholder="メールアドレス"
          />
          <input
            value={profile.department}
            onChange={(event) => setProfile({ ...profile, department: event.target.value })}
            placeholder="部署・学年"
          />
          <input
            value={profile.subjects}
            onChange={(event) => setProfile({ ...profile, subjects: event.target.value })}
            placeholder="担当教科"
          />
          <input
            value={profile.responsibilities}
            onChange={(event) => setProfile({ ...profile, responsibilities: event.target.value })}
            placeholder="担当・役割"
          />
        </div>
        <button className="admin-primary">プロフィールを保存</button>
      </form>
      <div className="admin-card">
        <h2>Passkey</h2>
        <p>Passkeyは複数の端末で登録できます。最後の1件は削除できません。</p>
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
                  setNotice('Passkeyを削除しました。もう一度ログインしてください。');
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

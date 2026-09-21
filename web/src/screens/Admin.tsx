import { FormEvent, useEffect, useMemo, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

type Role = 'super_admin' | 'admin' | 'general';
type Teacher = {
  id: string;
  schoolId: string | null;
  username: string;
  name: string;
  email: string;
  department: string;
  subjects: string;
  responsibilities: string;
  role: Role;
  createdAt: number;
};
type School = { id: string; name: string; code: string; address: string; phone: string; createdAt: number; updatedAt: number };
type Key = { id: string; name: string; createdAt: number; lastUsedAt: number | null };
type Me = { user: Teacher; enrollmentRequired: boolean };
const initialTeacher = {
  name: '',
  username: '',
  email: '',
  department: '',
  subjects: '',
  responsibilities: '',
  role: 'general' as Role,
  schoolId: '',
};
const initialSchool = { name: '', code: '', address: '', phone: '', adminName: '', username: '' };

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch('/api/admin/' + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '操作に失敗しました。');
  return data;
}
function date(value: number | null) {
  return value ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(value) : '未使用';
}
const roleLabel: Record<Role, string> = { super_admin: 'super admin', admin: '管理者', general: '一般' };

export default function Admin() {
  const [me, setMe] = useState<Me | null>(null),
    [schools, setSchools] = useState<School[]>([]),
    [teachers, setTeachers] = useState<Teacher[]>([]),
    [keys, setKeys] = useState<Key[]>([]);
  const [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const [login, setLogin] = useState({ username: '', password: '' }),
    [keyName, setKeyName] = useState('この端末のPasskey');
  const [schoolForm, setSchoolForm] = useState(initialSchool),
    [teacherForm, setTeacherForm] = useState(initialTeacher),
    [editing, setEditing] = useState<string | null>(null),
    [schoolEditing, setSchoolEditing] = useState<School | null>(null);
  const [profile, setProfile] = useState({ name: '', email: '', department: '', subjects: '', responsibilities: '' });
  const manager = me?.user.role === 'super_admin' || me?.user.role === 'admin';
  const superAdmin = me?.user.role === 'super_admin';

  const refresh = async () => {
    const current = await api('auth/me');
    setMe(current);
    if (current.enrollmentRequired) {
      setLoading(false);
      return;
    }
    const [schoolData, teacherData, keyData] = await Promise.all([api('schools'), api('teachers'), api('auth/passkeys')]);
    setSchools(schoolData.schools);
    setTeachers(teacherData.teachers);
    setKeys(keyData.passkeys);
    setLoading(false);
  };
  useEffect(() => {
    refresh().catch((e) => {
      if (!String(e.message).includes('ログイン')) setError(e.message);
      setLoading(false);
    });
  }, []);
  const run = async (action: () => Promise<void>) => {
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作に失敗しました。');
    }
  };
  useEffect(() => {
    if (me)
      setProfile({
        name: me.user.name,
        email: me.user.email,
        department: me.user.department,
        subjects: me.user.subjects,
        responsibilities: me.user.responsibilities,
      });
  }, [me]);
  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api('teachers/' + me!.user.id, { method: 'PATCH', body: JSON.stringify(profile) });
      setNotice('Profile updated.');
      await refresh();
    });
  };
  const passkeyLogin = () =>
    run(async () => {
      const options = await api('auth/authentication/options', { method: 'POST', body: '{}' });
      const response = await startAuthentication({ optionsJSON: options });
      await api('auth/authentication/verify', { method: 'POST', body: JSON.stringify({ response }) });
      await refresh();
    });
  const passwordLogin = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api('auth/password', { method: 'POST', body: JSON.stringify(login) });
      await refresh();
    });
  };
  const registerKey = () =>
    run(async () => {
      const options = await api('auth/registration/options', { method: 'POST', body: JSON.stringify({ name: keyName }) });
      const response = await startRegistration({ optionsJSON: options });
      await api('auth/registration/verify', { method: 'POST', body: JSON.stringify({ response }) });
      setNotice('Passkeyを登録しました。');
      await refresh();
    });
  const logout = () =>
    run(async () => {
      await api('auth/logout', { method: 'POST', body: '{}' });
      setMe(null);
      setSchools([]);
      setTeachers([]);
      setKeys([]);
    });
  const createSchool = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await api('schools', { method: 'POST', body: JSON.stringify(schoolForm) });
      setNotice('学校と管理者を登録しました。初回パスワード: ' + result.temporaryPassword);
      setSchoolForm(initialSchool);
      await refresh();
    });
  };
  const saveSchool = (event: FormEvent) => {
    event.preventDefault();
    if (!schoolEditing) return;
    void run(async () => {
      await api('schools/' + schoolEditing.id, {
        method: 'PATCH',
        body: JSON.stringify({
          name: schoolEditing.name,
          code: schoolEditing.code,
          address: schoolEditing.address,
          phone: schoolEditing.phone,
        }),
      });
      setSchoolEditing(null);
      setNotice('School updated.');
      await refresh();
    });
  };
  const saveTeacher = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      let result;
      if (editing) {
        result = await api('teachers/' + editing, { method: 'PATCH', body: JSON.stringify(teacherForm) });
        setNotice('教員情報を更新しました。');
      } else {
        result = await api('teachers', {
          method: 'POST',
          body: JSON.stringify({ ...teacherForm, schoolId: superAdmin ? teacherForm.schoolId : me?.user.schoolId }),
        });
        setNotice('招待を作成しました。初回パスワード: ' + result.temporaryPassword);
      }
      setEditing(null);
      setTeacherForm(initialTeacher);
      await refresh();
    });
  };
  const selectedSchools = useMemo(() => schools.filter((s) => superAdmin || s.id === me?.user.schoolId), [schools, superAdmin, me]);
  if (loading)
    return (
      <main className="admin-shell">
        <p>管理画面を準備しています…</p>
      </main>
    );
  if (!me)
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <p className="admin-kicker">YORISOI AI COUNSELING</p>
          <h1>教員管理画面</h1>
          <p>Passkeyで安全にログインします。</p>
          {error && <p className="admin-error">{error}</p>}
          <button className="admin-primary" onClick={passkeyLogin}>
            Passkeyでログイン
          </button>
          <details>
            <summary>初回ログインはこちら</summary>
            <form onSubmit={passwordLogin}>
              <input placeholder="ユーザー名" value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
              <input
                type="password"
                placeholder="初回パスワード"
                value={login.password}
                onChange={(e) => setLogin({ ...login, password: e.target.value })}
              />
              <button>ログインしてPasskeyを登録</button>
            </form>
          </details>
        </section>
      </main>
    );
  if (me.enrollmentRequired)
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <p className="admin-kicker">FIRST SIGN IN</p>
          <h1>Passkeyを登録してください</h1>
          <p>初回パスワードは、この登録が完了すると使えなくなります。</p>
          {error && <p className="admin-error">{error}</p>}
          <input value={keyName} onChange={(e) => setKeyName(e.target.value)} aria-label="Passkey名" />
          <button className="admin-primary" onClick={registerKey}>
            Passkeyを登録
          </button>
        </section>
      </main>
    );
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a href="/">
          <span>よりそいAI相談室</span>
          <small>教員管理</small>
        </a>
        <div>
          <span>
            {me.user.name} · {roleLabel[me.user.role]}
          </span>
          <button onClick={logout}>ログアウト</button>
        </div>
      </header>
      <div className="admin-layout">
        <nav>
          <strong>管理メニュー</strong>
          <a href="#schools">学校</a>
          <a href="#teachers">教員</a>
          <a href="#settings">自分の設定</a>
          <p>3Dキャラクターの設定は、今後ここへ追加できます。</p>
        </nav>
        <div className="admin-content">
          {(error || notice) && <p className={error ? 'admin-error' : 'admin-notice'}>{error || notice}</p>}
          <section id="schools">
            <p className="admin-kicker">SCHOOLS</p>
            <h1>学校</h1>
            {superAdmin && (
              <form className="admin-card admin-form" onSubmit={createSchool}>
                <h2>学校と最初の管理者を登録</h2>
                <div className="admin-grid">
                  <input
                    required
                    placeholder="学校名"
                    value={schoolForm.name}
                    onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                  />
                  <input
                    required
                    placeholder="学校コード"
                    value={schoolForm.code}
                    onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value })}
                  />
                  <input
                    placeholder="住所"
                    value={schoolForm.address}
                    onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                  />
                  <input
                    placeholder="電話番号"
                    value={schoolForm.phone}
                    onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                  />
                  <input
                    required
                    placeholder="最初の管理者名"
                    value={schoolForm.adminName}
                    onChange={(e) => setSchoolForm({ ...schoolForm, adminName: e.target.value })}
                  />
                  <input
                    required
                    placeholder="管理者のユーザー名"
                    value={schoolForm.username}
                    onChange={(e) => setSchoolForm({ ...schoolForm, username: e.target.value })}
                  />
                </div>
                <button className="admin-primary">登録する</button>
              </form>
            )}
            <div className="admin-list">
              {schoolEditing && (
                <form className="admin-card admin-form" onSubmit={saveSchool}>
                  <h2>{'\u5b66\u6821\u60c5\u5831\u3092\u7de8\u96c6'}</h2>
                  <div className="admin-grid">
                    <input
                      required
                      placeholder={'\u5b66\u6821\u540d'}
                      value={schoolEditing.name}
                      onChange={(e) => setSchoolEditing({ ...schoolEditing, name: e.target.value })}
                    />
                    <input
                      required
                      placeholder={'\u5b66\u6821\u30b3\u30fc\u30c9'}
                      value={schoolEditing.code}
                      onChange={(e) => setSchoolEditing({ ...schoolEditing, code: e.target.value })}
                    />
                    <input
                      placeholder={'\u4f4f\u6240'}
                      value={schoolEditing.address}
                      onChange={(e) => setSchoolEditing({ ...schoolEditing, address: e.target.value })}
                    />
                    <input
                      placeholder={'\u96fb\u8a71\u756a\u53f7'}
                      value={schoolEditing.phone}
                      onChange={(e) => setSchoolEditing({ ...schoolEditing, phone: e.target.value })}
                    />
                  </div>
                  <button className="admin-primary">{'\u4fdd\u5b58'}</button>
                  <button type="button" onClick={() => setSchoolEditing(null)}>
                    {'\u30ad\u30e3\u30f3\u30bb\u30eb'}
                  </button>
                </form>
              )}{' '}
              {selectedSchools.map((s) => (
                <article className="admin-card" key={s.id}>
                  <h2>{s.name}</h2>
                  <p>
                    {s.code} · {s.address || '住所未登録'} · {s.phone || '電話未登録'}
                  </p>
                  <small>学校の削除は運用スクリプトのみで行えます。</small>
                  {manager && (
                    <button type="button" onClick={() => setSchoolEditing({ ...s })}>
                      {'\u5b66\u6821\u60c5\u5831\u3092\u7de8\u96c6'}
                    </button>
                  )}{' '}
                </article>
              ))}
            </div>
          </section>
          <section id="teachers">
            <p className="admin-kicker">TEACHERS</p>
            <h1>教員</h1>
            {manager && (
              <form className="admin-card admin-form" onSubmit={saveTeacher}>
                <h2>{editing ? '教員情報を編集' : '教員を招待'}</h2>
                <div className="admin-grid">
                  <input
                    required
                    placeholder="氏名"
                    value={teacherForm.name}
                    onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                  />
                  {!editing && (
                    <input
                      required
                      placeholder="ユーザー名"
                      value={teacherForm.username}
                      onChange={(e) => setTeacherForm({ ...teacherForm, username: e.target.value })}
                    />
                  )}
                  <input
                    placeholder="メールアドレス"
                    value={teacherForm.email}
                    onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                  />
                  <input
                    placeholder="部署・学年"
                    value={teacherForm.department}
                    onChange={(e) => setTeacherForm({ ...teacherForm, department: e.target.value })}
                  />
                  <input
                    placeholder="担当教科"
                    value={teacherForm.subjects}
                    onChange={(e) => setTeacherForm({ ...teacherForm, subjects: e.target.value })}
                  />
                  <input
                    placeholder="担当・役割"
                    value={teacherForm.responsibilities}
                    onChange={(e) => setTeacherForm({ ...teacherForm, responsibilities: e.target.value })}
                  />
                  {superAdmin && !editing && (
                    <select
                      value={teacherForm.schoolId || ''}
                      required
                      onChange={(e) => setTeacherForm({ ...teacherForm, schoolId: e.target.value })}
                    >
                      <option value="">所属する学校</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <select value={teacherForm.role} onChange={(e) => setTeacherForm({ ...teacherForm, role: e.target.value as Role })}>
                    <option value="general">一般</option>
                    <option value="admin">管理者</option>
                  </select>
                </div>
                <button className="admin-primary">{editing ? '保存' : '招待を作成'}</button>
                {editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setTeacherForm(initialTeacher);
                    }}
                  >
                    キャンセル
                  </button>
                )}
              </form>
            )}
            <div className="admin-list">
              {teachers.map((t) => (
                <article className="admin-card teacher" key={t.id}>
                  <div>
                    <h2>
                      {t.name} <small>{roleLabel[t.role]}</small>
                    </h2>
                    <p>
                      @{t.username} · {t.department || '部署未登録'} · {t.subjects || '担当未登録'}
                    </p>
                  </div>
                  {manager && t.role !== 'super_admin' && (
                    <div className="admin-actions">
                      <button
                        onClick={() => {
                          setEditing(t.id);
                          setTeacherForm({ ...t, schoolId: t.schoolId || '' });
                        }}
                      >
                        編集
                      </button>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const result = await api('teachers/' + t.id + '/reset-passkeys', { method: 'POST', body: '{}' });
                            setNotice(t.name + 'さんのPasskeyをリセットしました。初回パスワード: ' + result.temporaryPassword);
                          })
                        }
                      >
                        Passkeyをリセット
                      </button>
                      <button
                        className="danger"
                        onClick={() =>
                          void run(async () => {
                            if (!confirm(t.name + 'さんを削除しますか？')) return;
                            await api('teachers/' + t.id, { method: 'DELETE' });
                            await refresh();
                          })
                        }
                      >
                        削除
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
          <section id="settings">
            <form className="admin-card admin-form" onSubmit={saveProfile}>
              <h2>Profile</h2>
              <div className="admin-grid">
                <input
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Name"
                />
                <input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="Email" />
                <input
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  placeholder="Department"
                />
                <input
                  value={profile.subjects}
                  onChange={(e) => setProfile({ ...profile, subjects: e.target.value })}
                  placeholder="Subjects"
                />
                <input
                  value={profile.responsibilities}
                  onChange={(e) => setProfile({ ...profile, responsibilities: e.target.value })}
                  placeholder="Responsibilities"
                />
              </div>
              <button className="admin-primary">Save profile</button>
            </form>
            <p className="admin-kicker">SETTINGS</p>
            <h1>自分のPasskey</h1>
            <div className="admin-card">
              <p>Passkeyは複数の端末で登録できます。最後の1件は削除できません。</p>
              <div className="key-add">
                <input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Passkey名" />
                <button className="admin-primary" onClick={registerKey}>
                  この端末を追加
                </button>
              </div>
              {keys.map((k) => (
                <div className="key-row" key={k.id}>
                  <span>
                    <strong>{k.name}</strong>
                    <small>
                      登録: {date(k.createdAt)} / 最終使用: {date(k.lastUsedAt)}
                    </small>
                  </span>
                  <button
                    onClick={() =>
                      void run(async () => {
                        await api('auth/passkeys/' + k.id, { method: 'DELETE' });
                        setNotice('Passkeyを削除しました。もう一度ログインしてください。');
                        setMe(null);
                      })
                    }
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

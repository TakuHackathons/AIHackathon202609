import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';

const initialValue = { name: '', code: '', address: '', phone: '', adminName: '', username: '' };

export default function SchoolNewPage() {
  const { refresh, run, setNotice, superAdmin } = useAdmin();
  const navigate = useNavigate();
  const [value, setValue] = useState(initialValue);

  if (!superAdmin) return <p className="admin-error">この操作を行う権限がありません。</p>;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await adminApi('schools', { method: 'POST', body: JSON.stringify(value) });
      await refresh();
      setNotice('学校と管理者を登録しました。パスワード: ' + result.temporaryPassword);
      await navigate({ to: '/admin/schools' });
    });
  };

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">SCHOOLS</p>
          <h1>学校を登録</h1>
          <p>学校と、その学校を管理する教員を登録します。</p>
        </div>
      </div>
      <form className="admin-card admin-form" onSubmit={submit}>
        <div className="admin-grid">
          <input required placeholder="学校名" value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} />
          <input
            required
            placeholder="学校コード"
            value={value.code}
            onChange={(event) => setValue({ ...value, code: event.target.value })}
          />
          <input placeholder="住所" value={value.address} onChange={(event) => setValue({ ...value, address: event.target.value })} />
          <input placeholder="電話番号" value={value.phone} onChange={(event) => setValue({ ...value, phone: event.target.value })} />
          <input
            required
            placeholder="管理者名"
            value={value.adminName}
            onChange={(event) => setValue({ ...value, adminName: event.target.value })}
          />
          <input
            required
            placeholder="管理者のユーザー名"
            value={value.username}
            onChange={(event) => setValue({ ...value, username: event.target.value })}
          />
        </div>
        <button className="admin-primary">登録する</button>
        <Link className="admin-secondary" to="/admin/schools">
          キャンセル
        </Link>
      </form>
    </section>
  );
}

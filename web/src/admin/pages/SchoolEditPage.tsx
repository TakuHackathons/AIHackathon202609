import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import type { School } from '../types';

export default function SchoolEditPage({ schoolId }: { schoolId: number }) {
  const { schools, manager, refresh, run, setNotice } = useAdmin();
  const navigate = useNavigate();
  const school = schools.find((item) => item.id === schoolId);
  const [value, setValue] = useState<School | null>(school ?? null);

  useEffect(() => {
    setValue(school ?? null);
  }, [school]);

  if (!manager) return <p className="admin-error">この操作を行う権限がありません。</p>;
  if (!value) return <p className="admin-error">学校が見つかりません。</p>;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await adminApi('schools/' + value.id, {
        method: 'PATCH',
        body: JSON.stringify({ name: value.name, code: value.code, address: value.address, phone: value.phone }),
      });
      await refresh();
      setNotice('学校情報を更新しました。');
      await navigate({ to: '/admin/schools' });
    });
  };

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">SCHOOLS</p>
          <h1>学校情報を編集</h1>
          <p>{school?.name}</p>
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
        </div>
        <button className="admin-primary">保存</button>
        <Link className="admin-secondary" to="/admin/schools">
          キャンセル
        </Link>
      </form>
    </section>
  );
}

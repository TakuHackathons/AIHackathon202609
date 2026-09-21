export async function adminApi(path: string, init: RequestInit = {}) {
  const response = await fetch('/api/admin/' + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '操作に失敗しました。');
  return data;
}

export function formatDate(value: number | null) {
  return value ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(value) : '未使用';
}

export function redirectToPasskeyOrigin() {
  if (window.location.hostname !== '127.0.0.1') return false;
  const url = new URL(window.location.href);
  url.hostname = 'localhost';
  window.location.replace(url);
  return true;
}

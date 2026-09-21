import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { adminApi, redirectToPasskeyOrigin } from './api';
import type { CurrentUser, Passkey, School, Teacher } from './types';

type AdminContextValue = {
  me: CurrentUser | null;
  schools: School[];
  teachers: Teacher[];
  passkeys: Passkey[];
  loading: boolean;
  error: string;
  notice: string;
  passwordLoginVisible: boolean;
  manager: boolean;
  superAdmin: boolean;
  refresh: () => Promise<void>;
  run: (action: () => Promise<void>) => Promise<void>;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
  setPasswordLoginVisible: (visible: boolean) => void;
  loginWithPasskey: () => Promise<void>;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  registerPasskey: (name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [passwordLoginVisible, setPasswordLoginVisible] = useState(false);

  const refresh = useCallback(async () => {
    const current = (await adminApi('auth/me')) as CurrentUser;
    setMe(current);
    if (current.enrollmentRequired) {
      setLoading(false);
      return;
    }
    const [schoolData, teacherData, passkeyData] = await Promise.all([
      adminApi('schools'),
      adminApi('teachers'),
      adminApi('auth/passkeys'),
    ]);
    setSchools(schoolData.schools);
    setTeachers(teacherData.teachers);
    setPasskeys(passkeyData.passkeys);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (redirectToPasskeyOrigin()) return;
    refresh().catch((cause) => {
      if (!String(cause.message).includes('ログイン')) setError(cause.message);
      setLoading(false);
    });
  }, [refresh]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作に失敗しました。');
    }
  }, []);

  const loginWithPasskey = async () => {
    if (redirectToPasskeyOrigin()) return;
    const result = await adminApi('auth/authentication/options', { method: 'POST', body: '{}' });
    const { passwordLoginAvailable, ...options } = result;
    if (passwordLoginAvailable) {
      setPasswordLoginVisible(true);
      return;
    }
    try {
      const response = await startAuthentication({ optionsJSON: options });
      await adminApi('auth/authentication/verify', { method: 'POST', body: JSON.stringify({ response }) });
      await refresh();
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'NotAllowedError') {
        setPasswordLoginVisible(true);
        return;
      }
      throw cause;
    }
  };

  const loginWithPassword = async (username: string, password: string) => {
    await adminApi('auth/password', { method: 'POST', body: JSON.stringify({ username, password }) });
    await refresh();
  };

  const registerPasskey = async (name: string) => {
    if (redirectToPasskeyOrigin()) return;
    const options = await adminApi('auth/registration/options', { method: 'POST', body: JSON.stringify({ name }) });
    const response = await startRegistration({ optionsJSON: options });
    await adminApi('auth/registration/verify', { method: 'POST', body: JSON.stringify({ response }) });
    setNotice('Passkeyを登録しました。');
    await refresh();
  };

  const logout = async () => {
    await adminApi('auth/logout', { method: 'POST', body: '{}' });
    setMe(null);
    setSchools([]);
    setTeachers([]);
    setPasskeys([]);
  };

  const value = useMemo<AdminContextValue>(
    () => ({
      me,
      schools,
      teachers,
      passkeys,
      loading,
      error,
      notice,
      passwordLoginVisible,
      manager: me?.user.role === 'super_admin' || me?.user.role === 'admin',
      superAdmin: me?.user.role === 'super_admin',
      refresh,
      run,
      setError,
      setNotice,
      setPasswordLoginVisible,
      loginWithPasskey,
      loginWithPassword,
      registerPasskey,
      logout,
    }),
    [me, schools, teachers, passkeys, loading, error, notice, passwordLoginVisible, refresh, run],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error('AdminProvider is required.');
  return value;
}

import { useAdmin } from './AdminContext';
import { useAdminI18n } from './i18n';

export type IssuedPassword = {
  username: string;
  password: string;
  expiresAt: number;
};

type Props = {
  issued: IssuedPassword;
  onClose: () => void;
};

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Clipboard is unavailable.');
}

export default function IssuedPasswordPanel({ issued, onClose }: Props) {
  const { run, setNotice } = useAdmin();
  const { t, locale } = useAdminI18n();
  const expiresAt = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(issued.expiresAt);

  const copyPassword = () =>
    run(async () => {
      await copyToClipboard(issued.password);
      setNotice(t('registrationPassword.copied'));
    });

  return (
    <section className="issued-password" aria-label={t('registrationPassword.title')}>
      <div className="issued-password-heading">
        <strong>{t('registrationPassword.title')}</strong>
        <button type="button" onClick={onClose}>
          {t('registrationPassword.close')}
        </button>
      </div>
      <dl>
        <div>
          <dt>{t('registrationPassword.username')}</dt>
          <dd>
            <code>{issued.username}</code>
          </dd>
        </div>
        <div>
          <dt>{t('registrationPassword.password')}</dt>
          <dd className="issued-password-value">
            <code>{issued.password}</code>
            <button type="button" onClick={() => void copyPassword()}>
              {t('registrationPassword.copy')}
            </button>
          </dd>
        </div>
        <div>
          <dt>{t('registrationPassword.expiresAt')}</dt>
          <dd>{expiresAt}</dd>
        </div>
      </dl>
    </section>
  );
}

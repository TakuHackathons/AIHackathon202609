import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { Provider } from 'jotai';
import styles from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Live AI Supporter' },
      { name: 'description', content: 'YouTube LiveのコメントをVTuberが読み上げる配信サポートツール' },
    ],
    links: [
      { rel: 'stylesheet', href: styles },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  component: Root,
  notFoundComponent: () => (
    <main>
      <h1>ページが見つかりません</h1>
      <a href="/">スタジオへ戻る</a>
    </main>
  ),
});

function Root() {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <Provider>
          <Outlet />
        </Provider>
        <Scripts />
      </body>
    </html>
  );
}

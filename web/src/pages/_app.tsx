import './globals.css';
import '@charcoal-ui/icons';
import type { AppProps } from 'next/app';
import { Provider } from 'jotai';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Provider>
      <Component {...pageProps} />
    </Provider>
  );
}

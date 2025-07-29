// pages/_app.tsx
import  '../styles/globals.css';
import type { AppProps } from "next/app";
import { MeshProvider } from "@meshsdk/react";
import Link from 'next/link';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <nav style={{
          display: 'flex',
          gap: '1rem',
          padding: '1rem',
          borderBottom: '1px solid #eee'
        }}>
        <Link href="/auction-seller">Seller</Link>
        <Link href="/auction-bidder">Bidder</Link>
        <Link href="/bet">Bet</Link>
      </nav>
      <MeshProvider>
        <Component {...pageProps} />
      </MeshProvider>
    </>
  );
}

export default MyApp;

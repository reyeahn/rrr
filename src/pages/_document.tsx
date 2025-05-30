import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/images/default-album.svg" type="image/svg+xml" sizes="any" />
        <meta name="theme-color" content="#667eea" />
        <meta name="description" content="MusicConnect - Share your daily songs and discover new music with friends" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
} 
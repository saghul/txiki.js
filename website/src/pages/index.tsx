import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import ThemedImage from '@theme/ThemedImage';

import styles from './index.module.css';

export default function Home(): ReactNode {
  return (
    <Layout
      title="The tiny JavaScript runtime"
      description="txiki.js is a small and powerful JavaScript runtime built on QuickJS-ng and libuv.">
      <main className={styles.main}>
        <ThemedImage
          alt="txiki.js"
          className={styles.logo}
          sources={{
            light: 'img/logo-light.png',
            dark: 'img/logo-dark.png',
          }}
        />
        <p className={styles.subtitle}>A small and powerful JavaScript runtime.</p>
        <Link
          className={styles.cta}
          to="/docs/getting-started">
          Get Started
        </Link>
      </main>
    </Layout>
  );
}

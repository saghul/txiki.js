import type {ReactNode} from 'react';

import styles from './styles.module.css';

export default function ForkNotice(): ReactNode {
  return (
    <aside className={styles.banner} aria-label="Fork-only documentation">
      <span className={styles.badge}>only on this fork</span>
      <p className={styles.text}>
        This page documents <strong>txiki.js with slim builds</strong> — a fork that adds
        size-reduced build profiles and publishes prebuilt binaries. It is not part of
        upstream txiki.js: see{' '}
        <a href="https://txikijs.org" target="_blank" rel="noopener noreferrer">
          txikijs.org
        </a>{' '}
        and{' '}
        <a href="https://github.com/saghul/txiki.js" target="_blank" rel="noopener noreferrer">
          saghul/txiki.js
        </a>{' '}
        for the original project and its documentation.
      </p>
    </aside>
  );
}

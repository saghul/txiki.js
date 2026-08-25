import type {ReactNode} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './styles.module.css';

export default function ForkBanner(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  if (!siteConfig.customFields?.forkDocs) {
    return null;
  }

  return (
    <aside className={styles.banner} aria-label="Fork documentation disclaimer">
      <p className={styles.text}>
        You are viewing documentation for an unofficial txiki.js fork. Visit{' '}
        <a href="https://txikijs.org" target="_blank" rel="noopener noreferrer">
          official txiki.js documentation
        </a>
        .
      </p>
    </aside>
  );
}

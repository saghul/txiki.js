import type {ReactNode} from 'react';
import type {Props} from '@theme/Navbar/Layout';
import NavbarLayout from '@theme-original/Navbar/Layout';

import ForkBanner from '@site/src/components/ForkBanner';

export default function NavbarLayoutWrapper(props: Props): ReactNode {
  return (
    <>
      <NavbarLayout {...props} />
      <ForkBanner />
    </>
  );
}

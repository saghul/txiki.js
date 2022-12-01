import { assert } from '@tjs/std';
import { foo } from './helpers/a/b/c/d/e/foo.js';


assert.eq(foo(), 42, 'deep folder import works');

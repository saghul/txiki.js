import assert from './assert.js';
import 'https://cdn.jsdelivr.net/npm/lodash@4.17.15/lodash.js';


const words = ['sky', 'wood', 'forest', 'falcon', 'pear', 'ocean', 'universe'];
assert.eq(_.first(words), 'sky', '_.first works');
assert.eq(_.last(words), 'universe', '_.last works');

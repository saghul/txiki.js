import assert from 'tjs:assert';

// navigator.userAgentData exists and is a NavigatorUAData instance
const uad = navigator.userAgentData;
assert.ok(uad, 'navigator.userAgentData exists');
assert.ok(uad instanceof NavigatorUAData, 'is instance of NavigatorUAData');
assert.eq(Object.prototype.toString.call(uad), '[object NavigatorUAData]', 'toStringTag is NavigatorUAData');

// brands
assert.ok(Array.isArray(uad.brands), 'brands is an array');
assert.ok(uad.brands.length > 0, 'brands is not empty');
const brand = uad.brands[0];
assert.eq(typeof brand.brand, 'string', 'brand.brand is a string');
assert.eq(typeof brand.version, 'string', 'brand.version is a string');
assert.eq(brand.brand, 'txiki.js', 'brand is txiki.js');
assert.ok(Object.isFrozen(uad.brands), 'brands array is frozen');
assert.ok(Object.isFrozen(brand), 'brand entry is frozen');

// mobile
assert.eq(typeof uad.mobile, 'boolean', 'mobile is a boolean');
assert.eq(uad.mobile, false, 'mobile is false');

// platform
assert.eq(typeof uad.platform, 'string', 'platform is a string');
assert.ok(uad.platform.length > 0, 'platform is not empty');

// toJSON
const json = uad.toJSON();
assert.ok(Array.isArray(json.brands), 'toJSON has brands');
assert.eq(typeof json.mobile, 'boolean', 'toJSON has mobile');
assert.eq(typeof json.platform, 'string', 'toJSON has platform');
assert.eq(json.mobile, uad.mobile, 'toJSON mobile matches');
assert.eq(json.platform, uad.platform, 'toJSON platform matches');

// getHighEntropyValues
const hev = await uad.getHighEntropyValues([
    'architecture',
    'bitness',
    'fullVersionList',
    'model',
    'platformVersion',
    'wow64',
    'formFactors',
]);

// Always includes low-entropy values
assert.ok(Array.isArray(hev.brands), 'HEV has brands');
assert.eq(typeof hev.mobile, 'boolean', 'HEV has mobile');
assert.eq(typeof hev.platform, 'string', 'HEV has platform');

// High-entropy values
assert.eq(typeof hev.architecture, 'string', 'HEV has architecture');
assert.eq(typeof hev.bitness, 'string', 'HEV has bitness');
assert.ok(Array.isArray(hev.fullVersionList), 'HEV has fullVersionList');
assert.eq(hev.fullVersionList[0].brand, 'txiki.js', 'fullVersionList brand is txiki.js');
assert.ok(hev.fullVersionList[0].version.includes('.'), 'fullVersionList has full version');
assert.eq(typeof hev.model, 'string', 'HEV has model');
assert.eq(typeof hev.platformVersion, 'string', 'HEV has platformVersion');
assert.ok(hev.platformVersion.split('.').length >= 3, 'platformVersion has at least 3 parts');
assert.eq(typeof hev.wow64, 'boolean', 'HEV has wow64');
assert.ok(Array.isArray(hev.formFactors), 'HEV has formFactors');

// Requesting no hints still returns low-entropy values
const empty = await uad.getHighEntropyValues([]);
assert.ok(Array.isArray(empty.brands), 'empty hints still has brands');
assert.eq(typeof empty.mobile, 'boolean', 'empty hints still has mobile');
assert.eq(typeof empty.platform, 'string', 'empty hints still has platform');
assert.eq(empty.architecture, undefined, 'empty hints has no architecture');

// Invalid hints argument
try {
    await uad.getHighEntropyValues('not an array');
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof TypeError, 'throws TypeError for non-array hints');
}

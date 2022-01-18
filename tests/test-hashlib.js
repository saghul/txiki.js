import assert from './assert.js';
import { createHash } from '@tjs/std';


const text = 'The quick brown fox jumps over the lazy dog';
// The results here are for the above sentence plus a period.
const hashTests = {
    md5: 'e4d909c290d0fb1ca068ffaddf22cbd0',
    sha1: '408d94384216f890ff7a0c3528e8bed1e0b01621',
    sha256: 'ef537f25c895bfa782526529a9b63d97aa631564d5d789c2b765448c8635fb6c',
    sha224: '619cba8e8e05826e9b8c519c0a5c68f4fb653e8a3d8aa04bb2c8cd4c',
    sha512: '91ea1245f20d46ae9a037a989f54f1f790f0a47607eeb8a14d12890cea77a1bbc6c7ed9cf205e67b7f2b8fd4c7dfd3a7a8617e45f3c463d481c7e586c39ac1ed',
    sha384: 'ed892481d8272ca6df370bf706e4d7bc1b5739fa2177aae6c50e946678718fc67a7af2819a021c2fc34e91bdb63409d7',
    sha512_256: '1546741840f8a492b959d9b8b2344b9b0eb51b004bba35c0aebaac86d45264c3',
    sha512_224: '6d6a9279495ec4061769752e7ff9c68b6b0b3c5a281b7917ce0572de',
    sha3_512: '18f4f4bd419603f95538837003d9d254c26c23765565162247483f65c50303597bc9ce4d289f21d1c2f1f458828e33dc442100331b35e7eb031b5d38ba6460f8',
    sha3_384: '1a34d81695b622df178bc74df7124fe12fac0f64ba5250b78b99c1273d4b080168e10652894ecad5f1f4d5b965437fb9',
    sha3_256: 'a80f839cd4f83f6c3dafc87feae470045e4eb0d366397d5c6ce34ba1739f734d',
    sha3_224: '2d0708903833afabdd232a20201176e8b58c5be8a6fe74265ac54db0'
};

for (const [type, result] of Object.entries(hashTests)) {
    const obj = createHash(type).update(text).update('.');
    assert.eq(obj.digest(), result, `${type} hash matches`);
}

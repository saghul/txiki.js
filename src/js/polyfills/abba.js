import { atob, btoa } from 'abab';

globalThis.atob = data => {
    const r = atob(data);

    if (r === null) {
        throw new DOMException(
            'Failed to decode base64: invalid character',
            'InvalidCharacterError'
        );
    }

    return r;
};

globalThis.btoa = data => {
    const r = btoa(data);

    if (r === null) {
        throw new DOMException(
            'The string to be encoded contains characters outside of the Latin1 range.',
            'InvalidCharacterError'
        );
    }

    return r;
};

const Fragment = Symbol.for('tjs.jsx.fragment');

function jsx(tag, props, key) {
    if (props === null) {
        props = {};
    }

    if (key !== null) {
        props.key = key;
    }

    return { tag, props, children: props.children ?? [] };
}

function jsxs(tag, props, key) {
    return jsx(tag, props, key);
}

export { Fragment, jsx, jsxs };

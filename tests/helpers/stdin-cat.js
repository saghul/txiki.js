// Echo stdin to stdout, like cat(1), but portable.
await tjs.stdin.pipeTo(tjs.stdout);

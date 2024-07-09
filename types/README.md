# @txikijs/types

To use the typings in your TS project, install it via `npm i @txikijs/types --save-dev`

Then either add `node_modules/@txikijs/types` to the `typeRoots` in your `tsconfig.json`:
```json
"typeRoots": [
	"node_modules/@txikijs/types",
	"node_modules/@types"
]
```

Or alternatively add `import type from '@txikijs/types';` somewhere in your code.

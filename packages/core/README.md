# @unifeather/core

Shared types, event normalization, UA parsing and the storage `Adapter`
contract for [unifeather](https://github.com/dennishendricks/unifeather) — a
lightweight, privacy-friendly, tree-shakeable website-analytics toolkit.

This package is the common foundation the other `@unifeather/*` packages build
on. You usually depend on it transitively; install it directly only when
implementing a custom storage adapter or reusing the event schema.

```sh
bun add @unifeather/core   # or: npm i @unifeather/core
```

```ts
import { normalizeEvent, type Adapter, type TrackingEvent } from "@unifeather/core";
```

See the [main README](https://github.com/dennishendricks/unifeather#readme) for the
full picture and [AGENTS.md](https://github.com/dennishendricks/unifeather/blob/main/AGENTS.md)
for the adapter contract.

MIT © Dennis Hendricks

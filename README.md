# SolidStart TodoMVC

A development-only port of [remix-todomvc](https://github.com/kentcdodds/remix-todomvc) ([license](https://github.com/kentcdodds/remix-todomvc/blob/main/LICENSE.md)) utilizing primitives and techniques supported directly by [SolidStart](https://start.solidjs.com/) and [SolidJS](https://www.solidjs.com/).

## Background

Despite the SolidStart repository already having its [own implementation](https://github.com/solidjs/solid-start/tree/main/examples/todomvc) of an optimistic UI [TodoMVC](https://todomvc.com/), in [Learning Angular w/ Minko Gechev](https://youtu.be/tfxxeknwsi8?t=12032) [remix-todomvc](https://github.com/kentcdodds/remix-todomvc) was presented as a sort of new gold standard.

Curiosity piqued this sparked a journey of:
- [Scratch refactoring](https://xp123.com/articles/scratch-refactoring/) SolidStart's own TodoMVC [example](https://github.com/solidjs/solid-start/tree/main/examples/todomvc) to identify the primitives and techniques employed.
- Some familiarizaton with Remix via the [Jokes App Tutorial](https://remix.run/docs/en/v1/tutorials/jokes).
- Scratch refactoring [remix-todomvc](https://github.com/kentcdodds/remix-todomvc) to identify its approaches (leading to [remix-todomvc-kcd-v2](https://github.com/peerreynders/remix-todomvc-kcd-v2))

in preparation for implementing this (development-only) SolidStart variation.

---
```shell
$ cd solid-start-todomvc-kcd-v2
$ npm i

added 341 packages, and audited 342 packages in 3s

27 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
$ cp .env.example .env
$ npm run dev

> solid-start-todomvc-kcd-v2@0.0.0 dev
> solid-start dev

 solid-start dev 
 version  0.2.20
 adapter  node

  VITE v3.2.5  ready in 537 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
  ➜  Inspect: http:/localhost:3000/__inspect/

  ➜  Page Routes:
     ┌─ http://localhost:3000/*todos
     ├─ http://localhost:3000/
     └─ http://localhost:3000/login

  ➜  API Routes:
     None! 👻

  > Server modules: 
   http://localhost:3000/_m/*
```

**Note**: The in-memory server side store re-seeds itself whenever the `todos-persisted.json` file cannot be found.

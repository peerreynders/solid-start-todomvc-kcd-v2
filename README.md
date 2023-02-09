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

added 461 packages, and audited 462 packages in 3s

58 packages are looking for funding
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

**Note**: The in-memory server side store re-seeds itself (johnsmith@outlook.com J0hn5M1th) whenever the `todos-persisted.json` file cannot be found.

---

- [Optimistic UI](#optimistic-ui)
  - [NewTodo Support](#new-todo-support)
  - [Todo Support](#todo-support)
  - [Todo Item Support](#todo-item-support)

## Optimistic UI
<a name="optimistic-ui"></a>

The [derived signal](https://www.solidjs.com/tutorial/introduction_derived) `renderTodos` is responsible for the highest level coordination of the optimistic UI.
```TypeScript
// file: src/routes/[...todos].tsx
const renderTodos = () => {
  const todos = refine(compose(data, toBeTodos), filtername);
  setTodoItems(reconcile(todos, { key: 'id', merge: false }));
  return todoItems;
};
```
A derived signal has the advantage of delaying any reactive subscriptions to the very last moment, i.e. the first time the function (a [thunk](https://en.wikipedia.org/wiki/Thunk)) is invoked.

In this case it delays the first invocation of the [resource's](https://www.solidjs.com/docs/latest#createresource) `data` signal until it is actually needed inside the effect boundary of the rendering JSX.
This way [suspense leaks](https://github.com/peerreynders/solid-start-notes-basic#suspense-leaks) to the container component are avoided.

```JSX
<ul class="c-todo-list">
  <For each={renderTodos()}>
    {(todo: TodoView) => (
      <li
        class="c-todo-list__item"
        hidden={todoItemHidden(todo)}
      >
        { /* … more TodoItem JSX … */ } 
      </li>
    )}
  </For>
</ul>
```

- `data` is the resource signal exposed by [`useRoute()`](https://start.solidjs.com/api/useRouteData) carrying the todos originating from the server via the `routeData` function.
- `toBeTodos` is a signal exposed by [NewTodo Support](#new-todo-support) which carries any todos who's creation is currently *pending*, i.e. a `createTodo` server action is `pending` but is not yet `complete` (or `failed`).
- `compose` (provided by [Todo Support](#todo-support)) combines `data` and `toBeTodos` and transforms them according to any *pending* or *failed* todo actions.
- `refine` (provided by [Todo Item Support](#todo-item-support)) then derives some todo counts before finally filtering and sorting the list for display.
- The `TodoView` items actually rendered to the [DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model) are managed by a [store](https://www.solidjs.com/docs/latest#createstore). 
To minimize modifications to the DOM the optimistic `todos` are [reconciled](https://www.solidjs.com/docs/latest#reconcile) rather than just directly *set* with `setTodoItems`.

### NewTodo Support
<a name="new-todo-support"></a>
NewTodo support is responsible for tracking *pending* and *failed* `createTodo` server actions and exposing any optimistic (`toBe`) todos for display.  

### Todo Support
<a name="todo-support"></a>
Todo support is responsible for tracking *pending* and *failed* server actions that apply to individual existing todos or the todo list as a whole. This allows it to compose the `toBe` and server todos and transforming them to their optimistic state.

### Todo Item Support
<a name="todo-item-support"></a>
Todo Item Support takes the optimistic todos supplied by *Todo Support* and derives essential counts before it filters and sorts the todos for display.

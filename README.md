# SolidStart TodoMVC

A development-only port of [remix-todomvc](https://github.com/kentcdodds/remix-todomvc) ([license](https://github.com/kentcdodds/remix-todomvc/blob/main/LICENSE.md)) utilizing primitives and techniques supported directly by [SolidStart](https://start.solidjs.com/) and [SolidJS](https://www.solidjs.com/).

## Background

Despite the SolidStart repository already having its [own implementation](https://github.com/solidjs/solid-start/tree/main/examples/todomvc) of an optimistic UI [TodoMVC](https://todomvc.com/), in [Learning Angular w/ Minko Gechev](https://youtu.be/tfxxeknwsi8?t=12032) [remix-todomvc](https://github.com/kentcdodds/remix-todomvc) was presented as a sort of new gold standard.

Curiosity piqued, this sparked a journey of:
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

To observe the effects of store reconciliation, inject the Todo DOM monitor ([todo-monitor.ts](src/todo-monitor.ts)):
```TypeScript
// file: src/routes/[...todos].tsx

// ADD this …
import { scheduleCompare } from '~/todo-monitor';

/* … a lot more code … */

const renderTodos = () => {
  const todos = refine(compose(data, toBeTodos), filtername);
  setTodoItems(reconcile(todos, { key: 'id', merge: false }));
  scheduleCompare(); // … and ADD this 
  return todoItems;
};
```

Assuming we are logged in as the pre-seeded user with the two item todo list, loading http://localhost:3000/todos will display something like the following in the developer console:
```
todo-monitor initialzed: 505.10 ms
```
Adding a single new todo will trigger the following activity:
```
Size: 2 ⮕  3
0 moved ⮕  1
1 moved ⮕  2
New items at: 0
Compared 5179.70 ms

0 has been ❌
New items at: 0
Compared 5253.80 ms
```

The optimistic UI inserts a new `li` at the top pushing the existing `li` elements down one position. 
Then the server based todo arrives and the optimistic `li` is replaced with a new `li` element with the server assigned todo ID (optimistic todos only have a temporary ID). 

Deleting the recent todo triggers the following:

```
Compared 8696.80 ms

Size: 3 ⮕  2
0 has been ❌
1 moved ⮕  0
2 moved ⮕  1
Compared 8755.50 ms
```

First the optimistic UI only hides the `li` element of the todo about to be deleted. Once the todo has been deleted on the server the corresponding `li` element is removed and the remaining `li` elements slide back up the list.

Lets compare that to an implemention without a store:

```TypeScript
const renderTodos = () => {
  const todos = refine(compose(data, toBeTodos), filtername);
  // setTodoItems(reconcile(todos, { key: 'id', merge: false }));
  scheduleCompare();
  return todos;
};
```

Adding a new todo:

```
Size: 2 ⮕  3
0 has been ❌
1 has been ❌
New items at: 0, 1, 2
Compared 4184.30 ms

0 has been ❌
1 has been ❌
2 has been ❌
New items at: 0, 1, 2
Compared 4258.60 ms
```

Even the `li` elements of the todos that haven't changed are replaced. Deleting the recently added todo:

```
0 has been ❌
1 has been ❌
2 has been ❌
New items at: 0, 1, 2
Compared 5750.10 ms

Size: 3 ⮕  2
0 has been ❌
1 has been ❌
2 has been ❌
New items at: 0, 1
Compared 5802.10 ms
```

The optimistic UI only hides the "to be deleted todo" however **all** the `li` elements in the todo list are replaced.Once the todo has been deleted on the server all the `li` elements are deleted once again while new ones are inserted to represent the todos that haven't changed.  

Just using a store doesn't help either:

```TypeScript
const renderTodos = () => {
  const todos = refine(compose(data, toBeTodos), filtername);
  // setTodoItems(reconcile(todos, { key: 'id', merge: false }));
  setTodoItems(todos);
  scheduleCompare();
  return todoItems;
};
```

```
todo-monitor initialzed: 474.70 ms

Size: 2 ⮕  3
0 has been ❌
1 has been ❌
New items at: 0, 1, 2
Compared 3577.50 ms

0 has been ❌
1 has been ❌
2 has been ❌
New items at: 0, 1, 2
Compared 3653.10 ms

0 has been ❌
1 has been ❌
2 has been ❌
New items at: 0, 1, 2
Compared 5061.00 ms

Size: 3 ⮕  2
0 has been ❌
1 has been ❌
2 has been ❌
New items at: 0, 1
Compared 5109.80 ms
```

So in order to minimize DOM manipulations it is critical to use a view [store](https://www.solidjs.com/docs/latest/api#using-stores) for list style data and use [reconcile](https://www.solidjs.com/docs/latest/api#reconcile) to synchronize it with the source information.

### NewTodo Support
<a name="new-todo-support"></a>
NewTodo support is responsible for tracking *pending* and *failed* `createTodo` server actions and exposing any optimistic (`toBe`) todos for display.  

### Todo Support
<a name="todo-support"></a>
Todo support is responsible for tracking *pending* and *failed* server actions that apply to individual existing todos or the todo list as a whole. This allows it to compose the `toBe` and server todos and transforming them to their optimistic state.

### Todo Item Support
<a name="todo-item-support"></a>
Todo Item Support takes the optimistic todos supplied by *Todo Support* and derives essential counts before it filters and sorts the todos for display.

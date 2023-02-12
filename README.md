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

> Everyone needs a framework; what everyone doesn't need is a general purpose framework. Nobody has a general problem, everyone has a very specific problem they're trying to solve. 

[Rasmus Lerdorf (2013)](https://youtu.be/anr7DQnMMs0?t=1917)

> Primitives not frameworks 

[Werner Vogels (2016)](https://www.allthingsdistributed.com/2016/03/10-lessons-from-10-years-of-aws.html#:~:text=Primitives%20not%20frameworks)

---

- [Optimistic UI](#optimistic-ui)
  - [NewTodo Support](#new-todo-support)
	  - [`makeNewTodoSupport`](#make-new-todo-support)
	  - [`makeNewTodoState`](#make-new-todo-state)
	  - [NewTodo function (server side)](#new-todo-fn)
  - [Todo Support](#todo-support)
  - [Todo Item Support](#todo-item-support)
	- [Error Types](#error-types)


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
NewTodo support is responsible for tracking *pending* and *failed* `newTodo` server actions while exposing any optimistic new todos for later (Todo, TodoItem) stages. It handles multiple `NewTodo`s composed of the following information:

```TypeScript
const makeNewTodo = (id: string) => ({
	id,
	title: '',
	message: undefined as string | undefined,
});

type NewTodo = ReturnType<typeof makeNewTodo>;
```
The `id` is temporary (assigned client side) and replaced server side with a permanent one when the `todo` is persisted. `title` is the proposed title pending server side approval. `message` holds the error message when a `NewTodo` fails server side validation. `NewTodos` submitted but not yet persisted (`pending`, not `completed`) are also represented as a `TodoView`:

```TypeScript
const view = {
  id: info.id,
  title,
  complete: false,
  createdAt,
  toBe: TO_BE.created,
  message: undefined,
};
```

These `pending` `TodoView`s are exposed via the `toBe()` signal to be mixed-in with the server provided todos in [Todo Support](#todo-support). 

The `newTodo` action phases are captured in the `ActionPhase` [union type](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types):

```TypeScript
type ActionPhase = 'pending' | 'completed' | 'failed';
```

Only one single `NewTodo` is displayed at a time. Typically that is the next todo to be created. However the optimistic UI makes it possible to quickly create many todos in succession before any of them have been accepted by the server, so it is conceivable to have multiple `NewTodo`s in the `failed` state. In that case one failed todo is shown at a time before another entirely new todo can be created. The `NewTodo` to be shown on the UI is exposed via the `showNewTodo()` signal: 

```JSX
// file: src/routes/[...todos].tsx

<createTodo.Form
  class="c-new-todo"
  onsubmit={newTodos.onSubmit}
>
  <input type="hidden" name="kind" value="newTodo" />
  <input type="hidden" name="id" value={showNewTodo().id} />
  <input
    ref={newTodos.ref.createdAt}
    type="hidden"
    name="created-at"
	/>
  <input
    ref={newTodos.ref.title}
    class="c-new-todo__title"
    placeholder="What needs to be done?"
    name="title"
    value={showNewTodo().title}
    autofocus
    aria-invalid={newTodoInvalid(newTodos)}
    aria-errormessage={newTodoErrorId(newTodos)}
	/>
  <Show when={newTodoHasError(newTodos)}>
    <div
      id={newTodoErrorId(newTodos)}
      class="c-new-todo__error c-todos--error"
    >
      {newTodoErrorMessage(newTodos)}
    </div>
  </Show>
</createTodo.Form>
```

The [Show](https://www.solidjs.com/docs/latest/api#show) fragment only appears for a `failed` `NewTodo`. 

Auxiliary functions for the JSX:
```TypeScript
const newTodoInvalid = ({ showNewTodo }: NewTodoSupport) =>
  showNewTodo().message ? true : undefined;

const newTodoHasError = ({ showNewTodo }: NewTodoSupport) =>
  typeof showNewTodo().message !== 'undefined';

const newTodoErrorId = ({ showNewTodo }: NewTodoSupport) =>
  showNewTodo().message ? `new-todo-error-${showNewTodo().id}` : undefined;

const newTodoErrorMessage = ({
  showNewTodo,
}: NewTodoSupport): string | undefined => showNewTodo().message;
```

#### `makeNewTodoSupport`
<a name="make-new-todo-support"></a>
`makeNewTodoSupport` uses a [`createServerMultiAction$()`](https://start.solidjs.com/api/createServerMultiAction). This makes it possible to support multiple concurrent `NewTodo` submissions. With [`createServerAction$()`](https://start.solidjs.com/api/createServerAction) only the latest submission is processed while any `pending` submissions are discarded.

```TypeScript
function makeNewTodoSupport() {
  const [creatingTodo, createTodo] = createServerMultiAction$(newTodoFn);

  const state = makeNewTodoState();

  const ref = {
    createdAt: undefined as HTMLInputElement | undefined,
    title: undefined as HTMLInputElement | undefined,
  };
  const syncTitle = (info: NewTodo) => {
    if (!ref.title) return;

    info.title = ref.title.value;
  };

  const current = createMemo(
    (prev: NewTodosCurrent) => {
      for (const submission of creatingTodo) {
        // Note: order matters
        if (typeof submission.result !== 'undefined') {
          state.applyUpdate('completed', submission.input);
          submission.clear();
          continue;

        } else if (typeof submission.error !== 'undefined') {
          const handled = state.applyUpdate(
            'failed',
            submission.input,
            submission.error
          );
          submission.clear();
          if (!handled) throw submission.error;
          continue;

        } else if (typeof submission.input !== 'undefined') {
          state.applyUpdate('pending', submission.input);
          continue;
        }
      }

      // Is the showNewTodo about to be swapped out?
      const next = state.current();
      if (next.showNewTodo !== prev.showNewTodo) syncTitle(prev.showNewTodo);

      return next;
    },
    state.current(),
    { equals: newTodosCurrentEquals }
	);

  // Split `current` for independent `showNewTodo`
  // and `toBeTodos` change propagation
  const showNewTodo = createMemo(() => current().showNewTodo, {
    equals: showNewTodoEquals,
	});

  const toBeTodos = createMemo(() => current().toBeTodos, {
    equals: toBeTodosEquals,
  });

  return {
    createTodo,
    showNewTodo,
    toBeTodos,
    ref,
    onSubmit(_e: unknown) {
      const createdAt = ref.createdAt;

      if (!(createdAt instanceof HTMLInputElement))
        throw new Error('Cannot find created-at input');

      // This value is only used
      // for the optimistic todo (for sorting).
      //
      // The server will assign the
      // final `id` and `createdAt` when
      // the todo is persisted.
      createdAt.value = Date.now().toString();
    },
  };
}
```

[`NewTodoState`](#make-new-todo-state) manages the one single "new" `NewTodo` and those that are either `pending` (with their `TodoView`) or have `failed`. `completed` `NewTodo`s are discarded as those now have a `TodoView` coming from the server. 

The `createdAt` [`ref`](https://www.solidjs.com/docs/latest/api#ref) is used during `createTodo` form submission to set the hidden `created-at` `HTMLInputElement` to a preliminary value needed for the appropriate sorting of the resulting optimistic `TodoView` in the todo list.

The `title` `ref` is used to synchronize the title from the `title` `HTMLInputElement` into the current `NewTodo` just before the information from another `NewTodo` is swapped into the `createTodo` form. 

The `current` [memo](https://www.solidjs.com/docs/latest/api#creatememo) aggregates the `creatingTodo` submissions to `toBeTodos` `TodoView[]` based on all the `pending` submissions and `showNewTodo` as the `NewTodo` to be placed in the `createTodo` form. 
The submission aggregation is handled by [`NewTodoState`](#make-new-todo-state) while `NewTodoSupport` directs the mapping of submission state:

- A submission `result` indicates that the submission has `completed`. Note that the submission is `clear`ed once it has been processed by `NewTodoState` resetting it to [idle](https://start.solidjs.com/api/createRouteMultiAction#createroutemultiactionaction-options).
- A submission `error` indicates that the submission has `failed`. Note that the submission is `clear`ed once it has been processed by `NewTodoState` resetting it to [idle](https://start.solidjs.com/api/createRouteMultiAction#createroutemultiactionaction-options). Also note that when `failed` isn't handled (i.e. the return value isn't `true`) the submission `error` is re-thrown.
- Otherwise if there is a submission `input` (while `result` and `error` are absent) the submission is `pending` (not cleared as the submission has yet to reach `completed` or `failed`).

Finally both `toBeTodos` and `showNewTodo` are separated into their own memos to decouple their dependecies from the change propagation of the `current()` aggregated value.

#### `makeNewTodoState`
<a name="make-new-todo-state"></a>

`NewTodoState` tracks `pending` and `failed` `creatingTodo` submissions in order to expose the `toBeTodos` for the todo list and select the `showNewTodo` to be placed in the `createTodo` form.

`map` contains all `pending` and `failed` `NewTodo`s and one single "new" `NewTodo`:
- By convention the last one added to `map` (i.e. last in terms of insertion order) is the "new", "fresh" `NewTodo` (`lastNew`).
- `failed` `NewTodo`s have a `message`. They are tracked with `failedSet`.
- Any remaining `NewTodo`s are `pending`. These are tracked in `pendingMap` which cross references the `TodoView` counterpart in `toBeTodos`. 

`addNewTodo` adds a "fresh" `NewTodo` to `map` while also keeping track of it with `lastNew`.
`removeNewTodo` deletes a `NewTodo` entirely from `map` which only happens when the associated submission has `completed`.

`addFailedTodo` sets the `NewTodo` `message` and adds it to the `failedSet`. 
`firstFailed` tracks the oldest of the `NewTodo` errors; it will be used as the `showNewTodo`.
`removeFailedTodo` removes the `NewTodo` from `failedSet` and clears the `message`.
If necessary, `firstFailed` is set to the next `failed` `NewTodo` (utilizing the [`next()` iterator method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_iterator_protocol) which will return the oldest `NewTodo` in terms of insertion order).

`addPendingTodo` creates an equivalent `TodoView` which is cross referenced with `pendingMap` and placed in `toBeTodos` ([`concat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/concat) is used to make it easy to detect a change of `toBeTodos`).
`removePendingTodo` removes the `NewTodo` from both `pendingMap` and `toBeTodos` (again [`filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter) makes it easier to detect that `toBeTodos` has changed).

These functions are used to implement the `ActionPhaseFn` functions on the `update` [Record](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type).

```TypeScript
type ActionPhaseFn = (form: FormData, error?: Error) => true | undefined;

function makeNewTodoState() {
  // Keep track of active `NewTodo`s
  let lastNew = makeNewTodo(nextId());
  const map = new Map<string, NewTodo>([[lastNew.id, lastNew]]);

  const addNewTodo = () => {
    const newId = nextId();
    const newTodo = makeNewTodo(newId);
    map.set(newId, newTodo);
    lastNew = newTodo;
  };

  const removeNewTodo = (info: NewTodo) => map.delete(info.id);

  // Keep track of any failed `NewTodo` submissions
  let firstFailed: NewTodo | undefined = undefined;
  const failedSet = new Set<NewTodo>();

  const addFailedTodo = (info: NewTodo, message: string) => {
    info.message = message;
    failedSet.add(info);
    if (!firstFailed) firstFailed = info;
  };

  const removeFailedTodo = (info: NewTodo) => {
    if (!failedSet.delete(info)) return;
    info.message = undefined;

    if (info !== firstFailed) return;

    const value = failedSet.values().next().value;
    firstFailed = value && 'id' in value ? (value as NewTodo) : undefined;
  };

  // Keep track of in progress `NewTodo` actions
  // and base optimistic `toBe` `TodoView`s on them
  const pendingMap = new WeakMap<NewTodo, TodoView>();
  let toBeTodos: TodoView[] = [];

  const addPendingTodo = (info: NewTodo, title: string, createdAt: number) => {
    const view = {
      id: info.id,
      title,
      complete: false,
      createdAt,
      toBe: TO_BE.created,
      message: undefined,
    };

    pendingMap.set(info, view);
    toBeTodos = toBeTodos.concat(view);
  };

  const removePendingTodo = (info: NewTodo) => {
    const view = pendingMap.get(info);
    if (!view) return;

    toBeTodos = toBeTodos.filter((v) => v !== view);
    pendingMap.delete(info);
  };

  const update: Record<ActionPhase, ActionPhaseFn> = {
    pending(form: FormData) {
      const id = form.get('id');
      if (typeof id !== 'string') return;

      const info = map.get(id);
      if (!info || pendingMap.has(info)) return;

      removeFailedTodo(info);
      if (info === lastNew) addNewTodo();

      const title = form.get('title');
      const createdAt = Number(form.get('created-at'));
      if (typeof title !== 'string' || Number.isNaN(createdAt)) return;

      addPendingTodo(info, title, createdAt);
      return true;
    },

    completed(form: FormData) {
      const id = form.get('id');
      if (typeof id !== 'string') return;

      const info = map.get(id);
      if (!info) return;

      removePendingTodo(info);
      removeFailedTodo(info);
      removeNewTodo(info);
      return true;
    },

    failed(form: FormData, error?: Error) {
      const id = form.get('id');
      if (!(error instanceof FormError) || typeof id !== 'string') return;

      const info = map.get(id);
      if (!info) return;

      if (failedSet.has(info)) {
        info.message = error?.message || 'Todo title error';
        return true;
      }

      removePendingTodo(info);
      addFailedTodo(info, error?.message || 'Todo title error');
      return true;
    },
  };

  return {
    applyUpdate(phase: ActionPhase, form: FormData, error?: Error) {
      return update[phase](form, error);
    },

    current() {
      return {
        showNewTodo: firstFailed ? firstFailed : lastNew,
        toBeTodos,
      };
    },
  };
}
```
- For a `pending` submission `id`, `title`, and `createdAt` are obtained from the form data.
  - The corresponding `NewTodo` is looked up.
	- If the `NewTodo` isn't already `pending` it's removed from `failedSet`
	- If the `NewTodo` is the "fresh" (`lastNew`) `NewTodo`, the next "fresh" `NewTodo` is added.
	- Finally the `NewTodo` is recorded as `pending`.
- For a `completed` submission the `id` is obtained from the form data and the corresponding `NewTodo` is purged from all `NewTodoState`.
- `failed` submissions are only handled when they are a [`FormError`](#error-types).
  - If the `NewTodo` is already `failed` its `message` is updated.
	- Otherwise the `NewTodo` is purged from `pending` and added to `failed`.

`NewTodoState` only exposes two functions (to [NewTodo Support](#new-todo-support)): `applyUpdate` toapply a submission's state to `NewTodoState` and `current` which returns the current `showNewTodo` and `toBeTodos` value.

#### NewTodo function (server side)
<a name="new-todo-fn"></a>

The submissions from the `createTodo` form of [`NewTodoSupport`](#make-new-todo-support) are processed by the `newTodoFn` server side function. The `requireUser` function ensures that a user session is embedded in the request before obtaining the todo (temporary) `id` and the `title` for the form data. For demonstration purposes:
- The format of the temporary `id` is validated.
- The `title` is guarded against containing 'error' (thereby demonstrating the `NewTodo` `failed` state).

The actual title validation only ensures the presence of a title. 

After successful validation the todo is inserted into the user's todo list.

```TypeScript
/* file: src/routes/[...todos].tsx (SERVER SIDE) */

async function newTodoFn(form: FormData, event: ServerFunctionEvent) {
  const user = requireUser(event);
  const id = form.get('id');
  const title = form.get('title');

  if (typeof id !== 'string' || typeof title !== 'string')
    throw new ServerError('Invalid form data');

  const newIdError = validateNewId(id);
  if (newIdError) throw new ServerError(newIdError);

  const demoError = demoTitleError(title);
  if (demoError)
    throw new FormError(demoError, {
      fieldErrors: {
        title: demoError,
      },
      fields: {
        kind: 'newTodo',
        id,
        title,
      },
    });

  const titleError = validateTitle(title);
  if (titleError)
    throw new FormError(titleError, {
      fieldErrors: {
        title: titleError,
      },
      fields: {
        kind: 'newTodo',
        id,
        title,
      },
    });

  const count = await insertTodo(user.id, title);
  if (count < 0) throw new ServerError('Invalid user ID', { status: 401 });

  return json({ kind: 'newTodo', id });
}
```

### Todo Support
<a name="todo-support"></a>
Todo support is responsible for tracking *pending* and *failed* server actions that apply to individual existing todos or the todo list as a whole. This allows it to compose the `toBe()` (from [NewTodo Support](#new-todo-support)) and server todos and to transform them to their optimistic state. 

Todo Support doesn't have any direct visual representation on the UI other than the `todoAction` form that is used as part of `TodoItem` but acts as a preparatory stage for [TodoItem Support](#todo-item-support) while also handling all of `TodoItem`'s interactivity. 

### Todo Item Support
<a name="todo-item-support"></a>
Todo Item Support takes the optimistic todos supplied by *Todo Support* and derives essential counts before it filters and sorts the todos for display.

### Error Types


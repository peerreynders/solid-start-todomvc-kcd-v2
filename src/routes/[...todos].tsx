// import { scheduleCompare } from '~/todo-monitor';
import {
	createMemo,
	ErrorBoundary,
	For,
	Show,
	type Accessor,
	type Resource,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { A, json, Navigate, useLocation, useRouteData } from 'solid-start';
import { FormError, ServerError } from 'solid-start/data';
import { useUser } from '~/components/user-context';

import { TO_BE, type TodoView, type User } from '~/types';
import { toCompleteValue } from '~/helpers';
import { nextId, validateNewId } from '~/lib/new-ids';

// --- BEGIN server side ---
import {
	createServerData$,
	createServerMultiAction$,
	redirect,
	type ServerFunctionEvent,
} from 'solid-start/server';
import { userFromFetchEvent } from '~/server/helpers';
import { requireUser } from '~/server/session';
import {
	deleteTodoById,
	deleteTodosCompleteByUserId,
	insertTodo,
	selectTodosByUserId,
	updateAllTodosCompleteByUserId,
	updateTodoCompleteById,
	updateTodoTitleById,
} from '~/server/repo';
import {
	loginHref,
	todosFilter,
	todosActiveHref,
	todosAllHref,
	todosCompleteHref,
	todosHref,
} from '~/route-path';
import type { Todo } from '~/server/types';

const toTodoView = ({ id, title, complete, createdAt }: Todo): TodoView => ({
	id,
	title,
	complete,
	createdAt,
	toBe: TO_BE.unchanged,
	message: undefined,
});

const cloneTodoView = ({
	id,
	title,
	complete,
	createdAt,
	toBe,
	message,
}: TodoView): TodoView => ({
	id,
	title,
	complete,
	createdAt,
	toBe,
	message,
});

const validateTitle = (title: string): string | undefined =>
	title.trim() ? undefined : 'Title required';

const demoTitleError = (title: string): string | undefined =>
	title.includes('error') ? 'Todos cannot include the word "error"' : undefined;

async function selectTodosFn(_: unknown, event: ServerFunctionEvent) {
	const user = userFromFetchEvent(event);
	if (!user) throw redirect(loginHref(new URL(event.request.url).pathname));

	const todos = ((await selectTodosByUserId(user.id)) || []).map(toTodoView);
	return todos;
}

//const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function newTodoFn(form: FormData, event: ServerFunctionEvent) {
	// await delay(2000);
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

type TodoActionKind =
	| 'clearTodos'
	| 'deleteTodo'
	| 'toggleAllTodos'
	| 'toggleTodo'
	| 'updateTodo';

type TodoActionResult = {
	kind: TodoActionKind;
	id: string;
};

type TodoActionFn = (
	user: User,
	form: FormData
) => Promise<ReturnType<typeof json<TodoActionResult>>>;

const todoActions: Record<string, TodoActionFn> = {
	async clearTodos(user: User, _form: FormData) {
		const count = await deleteTodosCompleteByUserId(user.id);
		if (count < 0)
			throw new ServerError('Todo list not found', { status: 404 });

		return json({ kind: 'clearTodos', id: 'clearTodos' });
	},

	async deleteTodo(user: User, form: FormData) {
		const id = form.get('id');
		if (typeof id !== 'string') throw new ServerError('Invalid Form Data');

		const count = await deleteTodoById(user.id, id);
		if (count < 0) throw new ServerError('Todo not found', { status: 404 });

		return json({ kind: 'deleteTodo', id });
	},

	async toggleAllTodos(user: User, form: FormData) {
		const complete = toCompleteValue(form);

		if (typeof complete !== 'boolean') throw new Error('Invalid Form Data');

		const count = await updateAllTodosCompleteByUserId(user.id, complete);
		if (count < 0)
			throw new ServerError('Todo list not found', { status: 404 });

		return json({ kind: 'toggleAllTodos', id: 'toggleAllTodos' });
	},

	async toggleTodo(user: User, form: FormData) {
		const id = form.get('id');
		const complete = toCompleteValue(form);

		if (typeof id !== 'string' || typeof complete !== 'boolean')
			throw new Error('Invalid Form Data');

		const count = await updateTodoCompleteById(user.id, id, complete);
		if (count < 0) throw new ServerError('Todo not found', { status: 404 });

		return json({ kind: 'toggleTodo', id });
	},

	async updateTodo(user: User, form: FormData) {
		const id = form.get('id');
		const title = form.get('title');

		if (typeof id !== 'string' || typeof title !== 'string')
			throw new ServerError('Invalid form data');

		const demoError = demoTitleError(title);
		if (demoError)
			throw new FormError(demoError, {
				fieldErrors: {
					title: demoError,
				},
				fields: {
					kind: 'updateTodo',
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
					kind: 'updateTodo',
					id,
					title,
				},
			});

		const count = await updateTodoTitleById(user.id, id, title);
		if (count < 0) throw new ServerError('Todo not found', { status: 404 });

		return json({ kind: 'updateTodo', id });
	},
};

async function todoActionFn(
	form: FormData,
	event: ServerFunctionEvent
): Promise<ReturnType<typeof json<TodoActionResult>>> {
	// await delay(2000);
	const kind = form.get('kind');
	if (typeof kind !== 'string') throw new Error('Invalid Form Data');

	const actionFn = todoActions[kind];
	if (!actionFn) throw Error(`Unsupported action kind: ${kind}`);

	const user = requireUser(event);
	return actionFn(user, form);
}

// --- END server side

export function routeData() {
	return createServerData$(selectTodosFn);
}

// --- BEGIN NewTodo support ---

const makeNewTodo = (id: string) => ({
	id,
	title: '',
	message: undefined as string | undefined,
});

type NewTodo = ReturnType<typeof makeNewTodo>;

type ActionPhase = 'pending' | 'completed' | 'failed';
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

type NewTodosCurrent = ReturnType<
	ReturnType<typeof makeNewTodoState>['current']
>;

const showNewTodoEquals = (prev: NewTodo, next: NewTodo): boolean =>
	prev === next;

const toBeTodosEquals = (prev: TodoView[], next: TodoView[]): boolean =>
	prev === next;

const newTodosCurrentEquals = (
	prev: NewTodosCurrent,
	next: NewTodosCurrent
): boolean =>
	showNewTodoEquals(prev.showNewTodo, next.showNewTodo) &&
	toBeTodosEquals(prev.toBeTodos, next.toBeTodos);

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

type NewTodoSupport = ReturnType<typeof makeNewTodoSupport>;

const newTodoInvalid = ({ showNewTodo }: NewTodoSupport) =>
	showNewTodo().message ? true : undefined;

const newTodoHasError = ({ showNewTodo }: NewTodoSupport) =>
	typeof showNewTodo().message !== 'undefined';

const newTodoErrorId = ({ showNewTodo }: NewTodoSupport) =>
	showNewTodo().message ? `new-todo-error-${showNewTodo().id}` : undefined;

const newTodoErrorMessage = ({
	showNewTodo,
}: NewTodoSupport): string | undefined => showNewTodo().message;

// --- END NewTodo support ---

// --- BEGIN Todo support ---

function makeTodoComposer() {
	const updateErrors = new Map<string, { title: string; message: string }>();
	const index = new Map<string, TodoView>();

	const compose: Record<string, Partial<Record<ActionPhase, ActionPhaseFn>>> = {
		clearTodos: {
			pending(_form: FormData) {
				for (const todo of index.values()) {
					if (!todo.complete || todo.toBe !== TO_BE.unchanged) continue;

					todo.toBe = TO_BE.deleted;
				}
				return true;
			},
		},

		deleteTodo: {
			pending(form: FormData) {
				const id = form.get('id');
				if (typeof id !== 'string') return;

				const todo = index.get(id);
				if (todo) todo.toBe = TO_BE.deleted;

				return true;
			},
			failed(_form: FormData, error?: Error) {
				// Don't care if toBe deleted todo doesn't exist anymore
				if (error instanceof ServerError && error.status === 404) return true;

				// Error not handled
				return undefined;
			},
		},

		toggleAllTodos: {
			pending(form: FormData) {
				const complete = toCompleteValue(form);
				if (typeof complete !== 'boolean') return;

				for (const todo of index.values()) {
					if (todo.complete === complete || todo.toBe == TO_BE.deleted)
						continue;

					todo.complete = complete;
				}
				return true;
			},
		},

		toggleTodo: {
			pending(form: FormData) {
				const id = form.get('id');
				const complete = toCompleteValue(form);
				if (typeof id !== 'string' || typeof complete !== 'boolean') return;

				const todo = index.get(id);
				if (todo) todo.complete = complete;
				return true;
			},
		},

		updateTodo: {
			pending(form: FormData) {
				const id = form.get('id');
				const title = form.get('title');
				if (typeof id !== 'string' || typeof title !== 'string') return;

				updateErrors.delete(id);
				const todo = index.get(id);
				if (!todo) return;

				todo.title = title;
				todo.toBe = TO_BE.updated;
				return true;
			},

			completed(form: FormData) {
				const id = form.get('id');
				if (typeof id !== 'string') return;

				updateErrors.delete(id);
				return true;
			},

			failed(form: FormData, error?: Error) {
				const id = form.get('id');
				const title = form.get('title');
				if (
					!(error instanceof FormError) ||
					typeof id !== 'string' ||
					typeof title !== 'string'
				)
					return;

				const todo = index.get(id);
				if (!todo) return;

				// Messages are applied to TodoViews
				// during `applyErrors`
				updateErrors.set(id, {
					title,
					message: error?.message || 'Todo title error',
				});
				return true;
			},
		},
	};

	return {
		loadTodos(nextTodos: TodoView[]) {
			index.clear();
			for (const todo of nextTodos) index.set(todo.id, cloneTodoView(todo));
		},

		get result() {
			return Array.from(index.values());
		},

		apply(phase: ActionPhase, form: FormData, error?: Error) {
			const kind = form.get('kind');
			if (!kind || typeof kind !== 'string') return;

			const fn = compose[kind]?.[phase];
			if (typeof fn !== 'function') return;

			return fn(form, error);
		},

		applyErrors() {
			for (const [id, data] of updateErrors) {
				const todo = index.get(id);
				if (todo) {
					todo.title = data.title;
					todo.message = data.message;
					continue;
				}

				updateErrors.delete(id);
			}
		},
	};
}

function makeTodoSupport(
	serverTodos: Resource<TodoView[] | undefined>,
	toBeTodos: Accessor<TodoView[]>
) {
	const [takingAction, todoAction] = createServerMultiAction$(todoActionFn);
	const composer = makeTodoComposer();

	const composed = createMemo(() => {
		const todos = serverTodos();
		composer.loadTodos(todos ? toBeTodos().concat(todos) : toBeTodos());

		for (const submission of takingAction) {
			// Note: order matters
			if (typeof submission.result !== 'undefined') {
				composer.apply('completed', submission.input);
				submission.clear();
				continue;
			} else if (typeof submission.error !== 'undefined') {
				const handled = composer.apply(
					'failed',
					submission.input,
					submission.error
				);
				submission.clear();
				if (!handled) throw submission.error;
				continue;
			} else if (typeof submission.input !== 'undefined') {
				composer.apply('pending', submission.input);
				continue;
			}
		}

		composer.applyErrors();
		return composer.result;
	});

	return {
		todoAction,
		composed,
	};
}
// --- END Todo support ---

// --- BEGIN TodoItem support ---

const TODOS_FILTER = {
	all: undefined,
	active: (todo: TodoView) => !todo.complete,
	complete: (todo: TodoView) => todo.complete,
} as const;

type Filtername = keyof typeof TODOS_FILTER;
type MaybeFiltername = Filtername | undefined;

const isFiltername = (name: string): name is Filtername =>
	Object.hasOwn(TODOS_FILTER, name);

function pathToFiltername(pathname: string) {
	const name = todosFilter(pathname);
	return name && isFiltername(name) ? name : undefined;
}

function byCreatedAtDesc(a: TodoView, b: TodoView) {
	// newer first
	// cmp > 0  `a` after `b`
	// cmp < 0  `a` before `b`

	const aIsNew = a.toBe === TO_BE.created;
	const bIsNew = b.toBe === TO_BE.created;
	if (aIsNew === bIsNew) return b.createdAt - a.createdAt;

	// Always show optimistic
	// created todos before others
	return aIsNew ? -1 : 1;
}

type TodoItemCounts = {
	total: number;
	active: number;
	complete: number;
	visible: number;
};

function makeTodoItemSupport(
	maybeFiltername: Accessor<MaybeFiltername>,
	todos: Accessor<TodoView[]>
) {
	const [todoItems, setTodoItems] = createStore<TodoView[]>([]);

	const counts = createMemo(() => {
		let total = 0;
		let complete = 0;
		let visible = 0;
		const filtered: TodoView[] = [];
		const keepFn = TODOS_FILTER[maybeFiltername() ?? 'all'];
		for (const todo of todos()) {
			if (!keepFn || keepFn(todo)) {
				filtered.push(todo);

				// Will be hidden but want to preserve
				// existing DOM elements in case of error
				if (todo.toBe === TO_BE.deleted) continue;

				// i.e. will be visible
				visible += 1;
			}

			// unfiltered counts
			total += 1;
			complete = todo.complete ? complete + 1 : complete;
		}

		filtered.sort(byCreatedAtDesc);
		setTodoItems(reconcile(filtered, { key: 'id', merge: false }));

		return {
			total,
			active: total - complete,
			complete,
			visible,
		};
	});

	return {
		counts,
		todoItems,
	};
}

const todoItemActionsDisabled = ({ toBe }: TodoView) =>
	toBe === TO_BE.created || toBe === TO_BE.deleted ? true : undefined;

const todoItemHidden = ({ toBe }: TodoView) =>
	toBe === TO_BE.deleted ? true : undefined;

const todoItemModifier = ({ complete }: TodoView) =>
	complete ? 'js-c-todo-item--complete ' : 'js-c-todo-item--active ';

const todoItemToggleModifier = ({ complete }: TodoView) =>
	complete
		? 'js-c-todo-item__toggle--complete '
		: 'js-c-todo-item__toggle--active ';

const todoItemToggleTitle = ({ complete }: TodoView) =>
	complete ? 'Mark as active' : 'Mark as complete';

const todoItemToggleTo = ({ complete }: TodoView): string =>
	complete ? 'false' : 'true';

const todoItemInvalid = ({ message }: TodoView) => (message ? true : undefined);

const todoItemHasError = ({ message }: TodoView) =>
	typeof message !== 'undefined';

const todoItemErrorId = ({ id, message }: TodoView) =>
	message ? `todo-item-error-${id}` : undefined;

const todoItemErrorMessage = ({ message }: TodoView): string | undefined =>
	message;

const todosMainModifier = (counts: Accessor<TodoItemCounts>) =>
	counts().visible > 0 ? '' : 'js-c-todos__main--no-todos-visible ';

const todoListHidden = (counts: Accessor<TodoItemCounts>) => {
	return counts().visible > 0 ? undefined : true;
};
const toggleAllModifier = (counts: Accessor<TodoItemCounts>) =>
	counts().active > 0
		? ''
		: counts().complete > 0
		? 'js-c-todos__toggle-all--checked '
		: 'js-c-todos__toggle-all--no-todos ';

const toggleAllTitle = (counts: Accessor<TodoItemCounts>) =>
	counts().active > 0
		? 'Mark all as complete '
		: counts().complete > 0
		? 'Mark all as active '
		: '';

const toggleAllTo = (counts: Accessor<TodoItemCounts>): string =>
	counts().active === 0 && counts().complete > 0 ? 'false' : 'true';

const filterAnchorActiveModifier = (filtername: () => MaybeFiltername) =>
	filtername() === 'active' ? 'js-c-todos__filter-anchor--selected' : '';

const filterAnchorAllModifier = (filtername: () => MaybeFiltername) =>
	filtername() === 'all' ? 'js-c-todos__filter-anchor--selected' : '';

const filterAnchorCompleteModifier = (
	filtername: () => Filtername | undefined
) => (filtername() === 'complete' ? 'js-c-todos__filter-anchor--selected' : '');

function submitTodoItemTitle(
	event: FocusEvent & { currentTarget: HTMLInputElement; target: Element }
) {
	const titleInput = event.currentTarget;
	if (!(titleInput instanceof HTMLInputElement)) return;

	const title = titleInput.dataset?.title;
	if (title === titleInput.value) return;

	titleInput.form?.requestSubmit();
}
// --- END TodoItem support ---

function Todos(props: {
	maybeFiltername: Accessor<MaybeFiltername>;
	email: string;
}) {
	const newTodos = makeNewTodoSupport();
	const { createTodo, showNewTodo, toBeTodos } = newTodos;

	const data = useRouteData<typeof routeData>();
	const { todoAction, composed } = makeTodoSupport(data, toBeTodos);

	const { counts, todoItems } = makeTodoItemSupport(
		props.maybeFiltername,
		composed
	);

	return (
		<>
			<section class="c-todos">
				<div>
					<header>
						<h1 class="c-todos__header">todos</h1>
						<createTodo.Form class="c-new-todo" onsubmit={newTodos.onSubmit}>
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
					</header>
					<section class={'c-todos__main ' + todosMainModifier(counts)}>
						<todoAction.Form>
							<input
								type="hidden"
								name="complete"
								value={toggleAllTo(counts)}
							/>
							<button
								class={'c-todos__toggle-all ' + toggleAllModifier(counts)}
								name="kind"
								title={toggleAllTitle(counts)}
								type="submit"
								value="toggleAllTodos"
							/>
						</todoAction.Form>
						<ul class="c-todo-list" hidden={todoListHidden(counts)}>
							<For each={todoItems}>
								{(todo: TodoView) => (
									<li class="c-todo-list__item" hidden={todoItemHidden(todo)}>
										<div class={'c-todo-item ' + todoItemModifier(todo)}>
											<todoAction.Form>
												<input type="hidden" name="id" value={todo.id} />
												<input
													type="hidden"
													name="complete"
													value={todoItemToggleTo(todo)}
												/>
												<button
													class={
														'c-todo-item__toggle ' +
														todoItemToggleModifier(todo)
													}
													disabled={todoItemActionsDisabled(todo)}
													name="kind"
													title={todoItemToggleTitle(todo)}
													type="submit"
													value="toggleTodo"
												/>
											</todoAction.Form>
											<todoAction.Form class="c-todo-item__update">
												<input type="hidden" name="kind" value="updateTodo" />
												<input type="hidden" name="id" value={todo.id} />
												<input
													class="c-todo-item__title"
													data-title={todo.title}
													disabled={todoItemActionsDisabled(todo)}
													name="title"
													onblur={submitTodoItemTitle}
													value={todo.title}
													aria-invalid={todoItemInvalid(todo)}
													aria-errormessage={todoItemErrorId(todo)}
												/>
												<Show when={todoItemHasError(todo)}>
													<div
														id={todoItemErrorId(todo)}
														class="c-todo-item__error c-todos--error"
													>
														{todoItemErrorMessage(todo)}
													</div>
												</Show>
											</todoAction.Form>
											<todoAction.Form>
												<input type="hidden" name="id" value={todo.id} />
												<button
													class="c-todo-item__delete"
													disabled={todoItemActionsDisabled(todo)}
													name="kind"
													title="Delete todo"
													type="submit"
													value="deleteTodo"
												/>
											</todoAction.Form>
										</div>
									</li>
								)}
							</For>
						</ul>
					</section>
					<footer class="c-todos__footer">
						<span class="c-todos__count">
							<strong>{counts().active}</strong>
							<span> {counts().active === 1 ? 'item' : 'items'} left</span>
						</span>
						<ul class="c-todos__filters">
							<li class="c-todos__filter-item">
								<A
									href={todosAllHref}
									class={
										'c-todos__filter-anchor ' +
										filterAnchorAllModifier(props.maybeFiltername)
									}
								>
									All
								</A>
							</li>{' '}
							<li class="c-todos__filter-item">
								<A
									href={todosActiveHref}
									class={
										'c-todos__filter-anchor ' +
										filterAnchorActiveModifier(props.maybeFiltername)
									}
								>
									Active
								</A>
							</li>{' '}
							<li class="c-todos__filter-item">
								<A
									href={todosCompleteHref}
									class={
										'c-todos__filter-anchor ' +
										filterAnchorCompleteModifier(props.maybeFiltername)
									}
								>
									Completed
								</A>
							</li>{' '}
						</ul>
						<Show when={counts().complete > 0}>
							<todoAction.Form>
								<button
									class="c-todos__clear-completed"
									name="kind"
									type="submit"
									value="clearTodos"
								>
									Clear Completed
								</button>
							</todoAction.Form>
						</Show>
					</footer>
				</div>
			</section>
			<footer class="c-info">
				<p class="c-info__line">
					Ported by{' '}
					<a href="http://github.com/peerreynders" class="c-info__pointer">
						Peer Reynders
					</a>
				</p>
				<p class="c-info__line">
					Source on{' '}
					<a
						href="http://github.com/peerreynders/solid-start-todomvc-kcd-v2"
						class="c-info__pointer"
					>
						Github
					</a>
				</p>
				<p class="c-info__line">
					Based on{' '}
					<a
						href="http://github.com/kentcdodds/remix-todomvc"
						class="c-info__pointer"
					>
						remix-todomvc
					</a>
				</p>
				<div>
					{props.email}{' '}
					<form method="post" action="/logout" class="c-info__logout">
						<button type="submit" class="c-info__pointer">
							Logout
						</button>
					</form>
				</div>
			</footer>
		</>
	);
}

export default function TodosPage() {
	const location = useLocation();
	const filtername = createMemo(() => pathToFiltername(location.pathname));
	const user = useUser();

	return (
		<ErrorBoundary
			fallback={(error) => {
				if (error instanceof FormError) {
					return <div>Unhandled (action) FormError: {error.message}</div>;
				}

				if (error instanceof ServerError) {
					if (error.status === 400) {
						return <div>You did something wrong: {error.message}</div>;
					}

					if (error.status === 404) {
						return <div>Not found</div>;
					}

					return (
						<div>
							Unexpected server error with status: {error.status} (
							{error.message})
						</div>
					);
				}

				if (error instanceof Error) {
					return <div>An unexpected error occurred: {error.message}</div>;
				}

				return <div>An unexpected caught value: {error.toString()}</div>;
			}}
		>
			<Show when={filtername()} fallback={<Navigate href={todosHref} />}>
				<Show
					when={user()}
					fallback={<Navigate href={loginHref(location.pathname)} />}
				>
					<Todos maybeFiltername={filtername} email={user()?.email ?? ''} />
				</Show>
			</Show>
		</ErrorBoundary>
	);
}

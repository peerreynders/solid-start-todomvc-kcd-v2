import {
	createHandler,
	renderAsync,
	StartServer,
	type MiddlewareInput,
	type MiddlewareFn,
} from 'solid-start/entry-server';
import { redirect } from 'solid-start/server';
import { getUser, logout } from './server/session';
import {
	isValidTodosHref,
	loginHref,
	logoutHref,
	todosHref,
} from './route-path';

// --- BEGIN dev dependency
import { start as startRepo } from '~/server/repo';

startRepo();
// --- END dev dependency

function todosMiddleware({ forward }: MiddlewareInput): MiddlewareFn {
	return async (event) => {
		const route = new URL(event.request.url).pathname;
		if (route === logoutHref)
			return logout(event.request, loginHref(todosHref));

		// Attach user to FetchEvent if available
		const user = await getUser(event.request);
		if (user) event.locals['user'] = user;

		// Protect the `/todos[/{filter}]` URL
		// undefined ➔  unrelated URL 
    //   (should be `...todos` at this point)
		// true ➔  valid "todos" URL
		// false ➔  starts with `/todos` but otherwise wrong
		//
		const toTodos = isValidTodosHref(route);
		if (!toTodos) {
			if (user) return redirect(todosHref);

			return redirect(loginHref(todosHref));
		}

		return forward(event);
	};
}

export default createHandler(
	todosMiddleware,
	renderAsync((event) => <StartServer event={event} />)
);

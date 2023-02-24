const homeHref = '/';

function loginHref(redirectTo?: string) {
	const href = '/login';
	if (!redirectTo || redirectTo === homeHref) return href;

	const searchParams = new URLSearchParams([['redirect-to', redirectTo]]);
	return `${href}?${searchParams.toString()}`;
}

const logoutHref = '/logout';

const todosHref = '/todos';
const todosActiveHref = `${todosHref}/active`;
const todosAllHref = `${todosHref}/all`;
const todosCompleteHref = `${todosHref}/complete`;

const todosPathSegments = new Set(['/', '/active', '/all', '/complete']);

function isValidTodosHref(pathname: string) {
	if (!pathname.startsWith(todosHref)) return undefined;

	if (pathname.length === todosHref.length) return true;

	return todosPathSegments.has(pathname.slice(todosHref.length));
}

export {
	homeHref,
	isValidTodosHref,
	loginHref,
	logoutHref,
	todosActiveHref,
	todosAllHref,
	todosCompleteHref,
	todosHref,
};

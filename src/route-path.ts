const homeHref = '/';

function loginHref(redirectTo?: string) {
	const href = '/login';
	if (!redirectTo || redirectTo === homeHref) return href;

	const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
	return `${href}?${searchParams.toString()}`;
}

const logoutHref = '/logout';

const todosHref = '/todos';
const todosActiveHref = `${todosHref}/active`;
const todosAllHref = `${todosHref}/all`;
const todosCompleteHref = `${todosHref}/complete`;

const todosPathSegments = new Set(['/', '/active', '/all', '/complete']);

function isValidTodosHref(pathname: string) {
	const todosAt = pathname.indexOf(todosHref);
	if (todosAt !== 0) return undefined;

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

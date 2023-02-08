const homeHref = '/';

function loginHref(redirectTo?: string) {
	const href = '/login';
	if (!redirectTo || redirectTo === homeHref) return href;

	const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
	return `${href}?${searchParams.toString()}`;
}

const logoutHref = '/logout';

const todosHref = '/todos';

function todosFilter(pathname: string) {
	const todosAt = pathname.indexOf(todosHref);
	if (todosAt !== 0) return undefined;

	if (pathname.length === todosHref.length) return 'all';

	const lastAt = pathname.lastIndexOf('/');
	if (lastAt !== todosHref.length) return undefined;

	return pathname.slice(lastAt + 1);
}

const todosActiveHref = `${todosHref}/active`;
const todosAllHref = `${todosHref}/all`;
const todosCompleteHref = `${todosHref}/complete`;

export {
	homeHref,
	loginHref,
	logoutHref,
	todosFilter,
	todosActiveHref,
	todosAllHref,
	todosCompleteHref,
	todosHref,
};

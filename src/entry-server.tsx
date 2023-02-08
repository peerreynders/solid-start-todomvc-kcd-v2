import {
  createHandler,
  renderAsync,
  StartServer,
  type MiddlewareInput,
  type MiddlewareFn,
} from 'solid-start/entry-server';

import { getUser, logout } from './server/session';
import {  loginHref, logoutHref, todosHref } from './route-path';

// --- BEGIN dev dependency
import { start as startRepo } from '~/server/repo';

startRepo();
// --- END dev dependency

function userMiddleware({ forward }: MiddlewareInput): MiddlewareFn {
  return async (event) => {
    const route = new URL(event.request.url).pathname;
    if (route === logoutHref) return logout(event.request, loginHref(todosHref));

    // Attach user to FetchEvent if available
    const user = await getUser(event.request);
    if (user) event.locals['user'] = user;

    return forward(event);
  };
}

export default createHandler(
  userMiddleware,
  renderAsync((event) => <StartServer event={event} />)
);


import {
	createContext,
	createResource,
	useContext,
	type ParentProps,
	type Resource,
} from 'solid-js';
import { isServer } from 'solid-js/web';
import { useServerContext } from 'solid-start';
import server$, { type ServerFunctionEvent } from 'solid-start/server';

import { userFromFetchEvent } from '~/server/helpers';
import type { User } from '~/types';

// --- START server side ---

function userFromSession(this: ServerFunctionEvent): User | undefined {
	return userFromFetchEvent(this);
}

// --- END server side ---

const clientSideSessionUser = server$(userFromSession);

function makeSessionUser(isRouting: () => boolean) {
	let routing = false;
	let toggle = 0;

	const refreshUser = () => {
		const last = routing;
		routing = isRouting();
		if (last || !routing) return toggle;

		// isRouting: false ➔  true transition
		// Toggle source value to trigger user fetch
		toggle = 1 - toggle;
		return toggle;
	};

	const fetchUser = (_toggle: number) =>
		isServer ? userFromFetchEvent(useServerContext()) : clientSideSessionUser();
	const [userResource] = createResource(refreshUser, fetchUser);

	return userResource;
}

const UserContext = createContext<Resource<User | undefined> | undefined>();

export type Props = ParentProps & {
	isRouting: () => boolean;
};

function UserProvider(props: Props) {
	return (
		<UserContext.Provider value={makeSessionUser(props.isRouting)}>
			{props.children}
		</UserContext.Provider>
	);
}

const useUser = () => useContext(UserContext);

export { UserProvider, useUser };

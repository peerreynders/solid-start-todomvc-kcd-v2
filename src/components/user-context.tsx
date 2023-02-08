import {
	createContext,
	createEffect,
	createSignal,
	useContext,
	type ParentProps,
} from 'solid-js';

import { isServer } from 'solid-js/web';

import type { User } from '~/types';

type UserRefresh = Promise<User | undefined> | User | undefined | null;

export type Props = ParentProps & {
	userRefresh: () => UserRefresh;
};

const options = {
	equals(prev: User | undefined, next: User | undefined): boolean {
		if (next === undefined) {
			return prev === undefined;
		}

		return (
			prev !== undefined && next.id === prev.id && next.email === prev.email
		);
	},
};

const [user, setUser] = createSignal<User | undefined>(undefined, options);

function synchronizeUser(data: UserRefresh) {
	if (data && typeof data === 'object') {
		if ('id' in data) {
			setUser(data);
		} else if ('then' in data) {
			data.then(setUser);
		}
	} else {
		setUser(undefined);
	}
}

const UserContext = createContext(user);

function UserProvider(props: Props) {
	if (isServer) synchronizeUser(props.userRefresh());

	createEffect(() => synchronizeUser(props.userRefresh()));

	return (
		<UserContext.Provider value={user}>{props.children}</UserContext.Provider>
	);
}

const useUser = () => useContext(UserContext);

export { UserProvider, useUser };

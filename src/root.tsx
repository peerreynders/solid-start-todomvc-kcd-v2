// @refresh reload
import { Suspense } from 'solid-js';

import {
	Body,
	ErrorBoundary,
	FileRoutes,
	Head,
	Html,
	Meta,
	Routes,
	Scripts,
	Title,
	useIsRouting,
} from 'solid-start';

import { UserProvider } from './components/user-context';

export default function Root() {
	const isRouting = useIsRouting();

	return (
		<Html lang="en">
			<Head>
				<Title>SolidStart TodoMVC</Title>
				<Meta charset="utf-8" />
				<Meta name="viewport" content="width=device-width, initial-scale=1" />
				<link href="/styles.css" rel="stylesheet" />
			</Head>
			<Body>
				<Suspense>
					<ErrorBoundary>
						<UserProvider isRouting={isRouting}>
							<Routes>
								<FileRoutes />
							</Routes>
						</UserProvider>
					</ErrorBoundary>
				</Suspense>
				<Scripts />
			</Body>
		</Html>
	);
}

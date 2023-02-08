// @refresh reload
import { createResource, Suspense } from 'solid-js';
import { isServer } from 'solid-js/web';

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
  useServerContext,
} from 'solid-start';

import { UserProvider } from './components/user-context';

import server$, { type ServerFunctionEvent } from 'solid-start/server';

import { userFromFetchEvent } from '~/server/helpers';
import type { User } from './types';

// Workaround
// Issue: `routeData` Is Not Called from the `root.tsx`
// https://github.com/solidjs/solid-start/issues/647

export default function Root() {
  const sessionUser = server$(function (
    this: ServerFunctionEvent
  ): User | undefined {
    return userFromFetchEvent(this);
  });
  const fetchUser = () =>
    isServer ? userFromFetchEvent(useServerContext()) : sessionUser();
  const [userResource, { refetch: refetchUser }] = createResource(fetchUser);

  const isRouting = useIsRouting();
  const userRefresh = () => (isRouting() ? refetchUser() : userResource());

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
            <UserProvider userRefresh={userRefresh}>
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


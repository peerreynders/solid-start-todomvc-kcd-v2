import { createEffect, Show } from 'solid-js';
import { Title, useSearchParams } from 'solid-start';

import { todosHref } from '~/route-path';

// --- BEGIN server side ---
import {
  createServerAction$,
  type ServerFunctionEvent,
} from 'solid-start/server';
import { FormError } from 'solid-start/data';

import { createUserSession } from '~/server/session';
import {
  insertUser,
  selectUserByEmail,
  verifyLogin
} from '~/server/repo';

import { validateEmail } from '~/helpers';

type FieldError =
  | 'email-invalid'
  | 'email-exists'
  | 'password-missing'
  | 'password-short'
  | 'user-invalid'
  | 'intent-unknown';

function makeError(data?: {
  error: FieldError;
  fields: {
    email: string;
    password: string;
    intent: string;
  };
}) {
  let message = 'Form not submitted correctly.';
  if (!data) return new FormError(message);

  let { error, fields } = data;
  const fieldErrors: {
    email?: string;
    password?: string;
  } = {};

  switch (error) {
    case 'email-invalid':
      message = fieldErrors.email = 'Email is invalid';
      break;

    case 'email-exists':
      message = fieldErrors.email = 'A user already exists with this email';
      break;

    case 'user-invalid':
      message = fieldErrors.email = 'Invalid email or password';
      break;

    case 'password-missing':
      message = fieldErrors.password = 'Password is required';
      break;

    case 'password-short':
      message = fieldErrors.password = 'Password is too short';
      break;

    case 'intent-unknown':
      return new Error(`Unknown intent: ${fields.intent}`);

    default:
      const _exhaustiveCheck: never = error;
      error = _exhaustiveCheck;
  }

  return new FormError(message, { fields, fieldErrors });
}

const forceToString = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value : '';

async function loginFn(
  form: FormData,
  event: ServerFunctionEvent
): Promise<Response> {
  const email = forceToString(form.get('email'));
  const password = forceToString(form.get('password'));
  const intent = forceToString(form.get('intent'));

  const fields = {
    email,
    password,
    intent,
  };

  if (!validateEmail(email))
    throw makeError({ error: 'email-invalid', fields });

  if (password.length < 1)
    throw makeError({ error: 'password-missing', fields });
  if (password.length < 8) throw makeError({ error: 'password-short', fields });

  if (intent === 'signup') {
    const found = await selectUserByEmail(email);
    if (found) throw makeError({ error: 'email-exists', fields });

  } else if (intent !== 'login')
    throw makeError({ error: 'intent-unknown', fields });

  const user = await (intent === 'login'
    ? verifyLogin(email, password)
    : insertUser(email, password));

  if (!user) throw makeError({ error: 'user-invalid', fields });

  const redirectTo = form.get('redirectTo');
  const remember = form.get('remember');
  return createUserSession({
    request: event.request,
    userId: user.id,
    remember: remember === 'on',
    redirectTo: typeof redirectTo === 'string' ? redirectTo : todosHref,
  });
}
// --- END server side ---

export default function LoginPage() {
  let emailInput: HTMLInputElement | undefined;
  let passwordInput: HTMLInputElement | undefined;

  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.redirectTo || todosHref;

  const [loggingIn, login] = createServerAction$(loginFn);
  const emailError = (): string | undefined =>
    loggingIn.error?.fieldErrors?.email;
  const passwordError = (): string | undefined =>
    loggingIn.error?.fieldErrors?.password;

  const focusId = () => (passwordError() ? 'password' : 'email');
  createEffect(() => {
    if (focusId() === 'password') {
      passwordInput?.focus();
    } else {
      emailInput?.focus();
    }
  });

  return (
    <div class="c-login">
      <Title>Login</Title>
      <h1 class="c-login__header">TodoMVC Login</h1>
      <div>
        <login.Form class="c-login__form">
          <div>
            <label for="email">Email address</label>
            <input
              ref={emailInput}
              id="email"
              class="c-login__email"
              required
              autofocus={focusId() === 'email'}
              name="email"
              type="email"
              autocomplete="email"
              aria-invalid={Boolean(emailError()) || undefined}
              aria-errormessage={emailError() ? 'email-error' : undefined}
            />
            <Show when={emailError()}>
              <div id="email-error">{emailError()}</div>
            </Show>
          </div>

          <div>
            <label for="password">
	      Password
	    </label>
            <input
              ref={passwordInput}
              id="password"
              class="c-login__password"
              autofocus={focusId() === 'password'}
              name="password"
              type="password"
              autocomplete="current-password"
              aria-invalid={Boolean(passwordError()) || undefined}
              aria-errormessage={passwordError() ? 'password-error' : undefined}
            />
            <Show when={passwordError()}>
              <div id="password-error">{passwordError()}</div>
            </Show>
          </div>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit" name="intent" value="login">
            Log in
          </button>
          <button type="submit" name="intent" value="signup">
            Sign Up
          </button>
          <div>
            <label for="remember">
              <input
                id="remember"
                class="c-login__remember"
                name="remember"
                type="checkbox"
              />{' '}
              Remember me
            </label>
          </div>
        </login.Form>
      </div>
    </div>
  );
}


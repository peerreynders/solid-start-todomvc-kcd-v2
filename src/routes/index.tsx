import { Show } from 'solid-js';
import { Navigate } from 'solid-start';
import { loginHref, todosHref } from '~/route-path';
import { useUser } from '~/components/user-context';

export default function RedirectPage() {
  return (
    <Show when={(useUser())()} fallback={<Navigate href={loginHref(todosHref)} />} >
      <Navigate href={todosHref} />
    </Show>
  ); 
}

import type { Todo, User } from '~/server/types';

const TO_BE = {
  created: 0,
  unchanged: 1,
  updated: 2,
  deleted: 3,
} as const;

type ToBeStatus = (typeof TO_BE)[keyof typeof TO_BE]

type TodoView = Pick<Todo, 'id' | 'title' |'complete' | 'createdAt'> & {
  toBe: ToBeStatus;
  message: string | undefined;
};

export type {
  ToBeStatus,
  TodoView,
  User
};

export {
  TO_BE
};

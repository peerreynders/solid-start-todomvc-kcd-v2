// Generates (client side)
// temporary ids for
// new Todos (`CreateTodo`)
const NEW_PREFIX = 'NEW-';
const isNewId = (id: string) => id.startsWith(NEW_PREFIX);

const toNewId = (id: number) => NEW_PREFIX + id.toString();

const nextId = (() => {
  const START = Number.MAX_SAFE_INTEGER;
  let next = START;

  return () => {
    const id = toNewId(next--);
    if (next < 1) next = START;
    return id;
  };
})();

function validateNewId(id: string): string | undefined {
  const message ='Invalid New ID';

  if (!isNewId(id)) 
    return message;

  return ( 
    Number.isInteger(Number(id.slice(NEW_PREFIX.length)))
    ? undefined
    : message 
  );
}

export {
  isNewId,
  nextId,
  validateNewId,
};

// Generates (client side)
// temporary ids for
// newTodo  action
const NEW_PREFIX = 'NEW-';
const isNewId = (id: string) => id.startsWith(NEW_PREFIX);
const toNewId = (id: number) => NEW_PREFIX + id.toString();

const START = Number.MAX_SAFE_INTEGER - 1;
const toNext = (value: number) => value > 1 ? value - 1 : START;   

function parseId(id: string) {
  if (!isNewId(id)) return; 

  const num = Number(id.slice(NEW_PREFIX.length));
  return Number.isInteger(num) && num <= START ? num : undefined;
}

function makeNewId(firstId?: string) {
    const start = typeof firstId === 'string' ? parseId(firstId): undefined; 
    let next = !start ? START : toNext(start) + 1;

    return function nextId() {
			const value = next;
			next = toNext(next);
      return toNewId(value);
    };
}

const validateNewId = (id: string) =>
  typeof parseId(id) !== 'number' ? 'Invalid New ID' : undefined;

export { isNewId, makeNewId, validateNewId };

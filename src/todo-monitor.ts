import { isServer } from 'solid-js/web';

const formatMs = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
	useGrouping: false,
  style: 'unit',
  unit: 'millisecond',
  unitDisplay: 'short',
});

const makeSnapShot = () =>
  new Set(document.querySelectorAll('li.c-todo-list__item').values());

type SnapShot = ReturnType<typeof makeSnapShot>;

function compare(prev: SnapShot, next: SnapShot) {
  const findings: string[] = [];
	const list = Array.from(next);

  if (prev.size !== next.size) 
    findings.push(`Size: ${prev.size} ⮕ ${next.size}`);
  
	let old = -1;
  for (const el of prev) {
		old += 1;
    const j = list.indexOf(el);
    if(old === j) continue;

    findings.push(
      j < 0 
      ? `Former ${old} has been removed`
      : `Former ${old} moved to ⮕ ${j}`
    );
  }

	let position = -1;
	const added: number[] = [];
	for (const el of next) {
		position += 1;
		if (prev.has(el)) continue;

		added.push(position);
	}
	if (added.length > 0)
		findings.push(`New items at: ${added.join(', ')}`);

  const report = 
    findings.length > 0 
    ? findings.join('\n') 
    : '';

  return(report);
}

function initialize() {
	const channel = new MessageChannel();
  const prev = makeSnapShot();
	const bag = {
		channel,
		prev,
	};

  channel.port2.addEventListener('message', (_e: MessageEvent<null>) => {
		const timeStamp = formatMs.format(performance.now());
		const next = makeSnapShot();
		const report = compare(bag.prev, next);
		bag.prev = next;

		console.log(`${ report.length > 0 ? report + '\n': '' }Compared ${timeStamp}`);
	});

	channel.port2.start();
	return bag;
}

let bag: ReturnType<typeof initialize> | undefined;

function scheduleCompare() {
	if (isServer) return;

	if (!bag) {
		bag = initialize();

		console.log(`todo-monitor initialzed: ${formatMs.format(performance.now())}`);
		return;
	}

	// Trigger a snapshot comparison
  bag.channel.port1.postMessage(null);	
}

export {
	scheduleCompare
}

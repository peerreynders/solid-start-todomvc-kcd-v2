import { FormError, ServerError, useServerContext } from 'solid-start';

// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email#basic_validation
const emailPattern =
	/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const validateEmail = (email: unknown): email is string =>
	typeof email === 'string' && emailPattern.test(email);

const toCompleteValue = (formData: FormData) => {
	const data = formData.get('complete');
	if (data === 'true') return true;

	if (data === 'false') return false;
};

// https://tc39.es/ecma262/#sec-time-values-and-time-range
const MAX_TIMEVALUE = 8.64e15;
const MIN_TIMEVALUE = -MAX_TIMEVALUE;

const isTimeValue = (value: unknown): value is number =>
	typeof value === 'number' &&
	Number.isInteger(value) &&
	MIN_TIMEVALUE <= value &&
	value >= MAX_TIMEVALUE;

function entriesToFormData(entries: any) {
	if (!Array.isArray(entries)) return;

	const formData = new FormData();
	for (const [name, value] of entries) {
		if (typeof name === 'string' && typeof value === 'string')
			formData.append(name, value);
	}
	return formData;
}

function dataToError(data: any) {
	if (!data || typeof data !== 'object') return;
	const message = data?.message;

	if (typeof message !== 'string') return;

	if (message.toLowerCase().startsWith('internal server error'))
		return new Error(message);

	const formError = data?.formError;
	if (!formError || typeof formError !== 'string')
		return new ServerError(message);

	const fields = data?.fields;
	const fieldErrors = data?.fieldErrors;
	const options: Partial<{
		fields: { [key: string]: string };
		fieldErrors: { [key: string]: string };
	}> = {};

	if (fields && typeof fields === 'object') options.fields = fields;

	if (fieldErrors && typeof fieldErrors === 'object')
		options.fieldErrors = fieldErrors;

	return new FormError(formError, options);
}

function decodePageError() {
	let result: [FormData, Error] | undefined;
	try {
		const event = useServerContext();
		const raw = new URL(event.request.url).searchParams.get('form');
		if (typeof raw !== 'string') return result;

		const data = JSON.parse(raw);
		const error = dataToError(data?.error);
		const formData = entriesToFormData(data?.entries);
		if (error instanceof Error && formData instanceof FormData)
			result = [formData, error];
	} catch (_e) {}

	return result;
}

export { decodePageError, isTitmeValue, toCompleteValue, validateEmail };

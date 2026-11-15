export class ApiError extends Error {
  constructor(message, status, fields = {}, code) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.code = code;
  }
}

export async function api(path, options = {}) {
  const { body, ...rest } = options;
  const response = await fetch(`/api${path}`, {
    ...rest,
    credentials: 'same-origin',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error?.message || 'Something went wrong. Please try again.', response.status, data?.error?.fields, data?.error?.code);
  return data;
}

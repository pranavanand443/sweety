export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function validationError(fields) {
  return new ApiError(400, 'VALIDATION_ERROR', Object.values(fields)[0] || 'Please check your entries.', fields);
}

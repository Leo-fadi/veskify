export class GovernanceError extends Error {
  constructor(code, message, { exitCode = 1, details = [] } = {}) {
    super(message);
    this.name = "GovernanceError";
    this.code = code;
    this.exitCode = exitCode;
    this.details = details.slice(0, 100);
  }
}

export const fail = (code, message, options) => {
  throw new GovernanceError(code, message, options);
};

export const requireCondition = (condition, code, message, options) => {
  if (!condition) fail(code, message, options);
};

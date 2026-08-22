export const P10B18C_P04_ACCEPTANCE_TOKEN_HEADER =
  "x-veskify-p10b-16p-04-acceptance-token" as const;

export function p10b18cP04AcceptanceHeaders(input: {
  processToken: string | undefined;
  serverToken: string | undefined;
}): Readonly<Record<typeof P10B18C_P04_ACCEPTANCE_TOKEN_HEADER, string>> {
  if (
    !input.processToken ||
    Buffer.byteLength(input.processToken) < 32 ||
    !input.serverToken ||
    input.serverToken !== input.processToken
  ) {
    throw new Error("The mocked P10B-16P-04 production preflight authority is unavailable.");
  }
  return Object.freeze({
    [P10B18C_P04_ACCEPTANCE_TOKEN_HEADER]: input.processToken,
  });
}

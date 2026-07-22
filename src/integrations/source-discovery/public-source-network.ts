export type PublicSourceResolvedAddress = Readonly<{
  address: string;
  family: 4 | 6;
}>;

export type PublicSourceNetworkRequest = Readonly<{
  url: URL;
  resolvedAddresses: readonly PublicSourceResolvedAddress[];
  headers: Readonly<Record<string, string>>;
  maxBytes: number;
  signal: AbortSignal;
}>;

export type PublicSourceNetworkResponse = Readonly<{
  status: number;
  headers: Readonly<Record<string, string>>;
  body: Uint8Array;
}>;

export interface PublicSourceNetwork {
  resolve(hostname: string, signal: AbortSignal): Promise<readonly PublicSourceResolvedAddress[]>;
  request(input: PublicSourceNetworkRequest): Promise<PublicSourceNetworkResponse>;
}

export class PublicSourceNetworkError extends Error {
  constructor(
    readonly reason: "response-too-large" | "network-failure",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PublicSourceNetworkError";
  }
}

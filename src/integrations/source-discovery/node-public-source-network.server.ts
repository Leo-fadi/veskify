import "server-only";

import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import {
  PublicSourceNetworkError,
  type PublicSourceNetwork,
  type PublicSourceNetworkRequest,
  type PublicSourceNetworkResponse,
  type PublicSourceResolvedAddress,
} from "./public-source-network";

function abortError(): Error {
  const error = new Error("The public-source request was cancelled.");
  error.name = "AbortError";
  return error;
}

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    signal.addEventListener("abort", () => reject(abortError()), { once: true });
  });
}

function responseHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
      .map(([name, value]) => [
        name.toLowerCase(),
        Array.isArray(value) ? value.join(", ") : value,
      ]),
  );
}

export class NodePublicSourceNetwork implements PublicSourceNetwork {
  async resolve(
    hostname: string,
    signal: AbortSignal,
  ): Promise<readonly PublicSourceResolvedAddress[]> {
    if (signal.aborted) throw abortError();
    const result = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      waitForAbort(signal),
    ]);
    return result.map((entry) => ({
      address: entry.address,
      family: entry.family === 6 ? 6 : 4,
    }));
  }

  request(input: PublicSourceNetworkRequest): Promise<PublicSourceNetworkResponse> {
    const pinnedAddress = input.resolvedAddresses[0];
    if (!pinnedAddress) {
      return Promise.reject(
        new PublicSourceNetworkError(
          "network-failure",
          "No validated public address is available.",
        ),
      );
    }
    if (input.signal.aborted) return Promise.reject(abortError());

    return new Promise((resolve, reject) => {
      let settled = false;
      const settleReject = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(
          error instanceof Error
            ? error
            : new PublicSourceNetworkError("network-failure", "The public source request failed.", {
                cause: error,
              }),
        );
      };
      const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
        callback(null, pinnedAddress.address, pinnedAddress.family);
      };
      const requestedHostname = input.url.hostname.replace(/^\[|\]$/g, "");
      const clientRequest = request(
        input.url,
        {
          method: "GET",
          headers: input.headers,
          lookup: pinnedLookup,
          servername: isIP(requestedHostname) === 0 ? requestedHostname : undefined,
        },
        (response) => {
          const contentLength = Number(response.headers["content-length"]);
          if (Number.isFinite(contentLength) && contentLength > input.maxBytes) {
            const error = new PublicSourceNetworkError(
              "response-too-large",
              "The public source response exceeds the configured size limit.",
            );
            response.destroy(error);
            settleReject(error);
            return;
          }
          const chunks: Buffer[] = [];
          let receivedBytes = 0;
          response.on("data", (chunk: Buffer) => {
            receivedBytes += chunk.byteLength;
            if (receivedBytes > input.maxBytes) {
              const error = new PublicSourceNetworkError(
                "response-too-large",
                "The public source response exceeds the configured size limit.",
              );
              response.destroy(error);
              settleReject(error);
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => {
            if (settled) return;
            settled = true;
            resolve({
              status: response.statusCode ?? 0,
              headers: responseHeaders(response.headers),
              body: Buffer.concat(chunks),
            });
          });
          response.on("error", settleReject);
        },
      );
      const cancel = () => clientRequest.destroy(abortError());
      input.signal.addEventListener("abort", cancel, { once: true });
      clientRequest.on("error", (error) => {
        input.signal.removeEventListener("abort", cancel);
        settleReject(error);
      });
      clientRequest.on("close", () => input.signal.removeEventListener("abort", cancel));
      clientRequest.end();
    });
  }
}

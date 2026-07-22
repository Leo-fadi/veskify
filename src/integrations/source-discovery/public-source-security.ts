import { isIP } from "node:net";
import { SourceDiscoveryApplicationError } from "@/application/source-discovery";

const blockedHostnames = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.azure.internal",
  "instance-data.ec2.internal",
  "metadata.oraclecloud.com",
]);

function blockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    blockedHostnames.has(normalized) ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".home.arpa")
  );
}

function ipv4Number(address: string): number | null {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return parts.reduce((value, part) => value * 256 + part, 0) >>> 0;
}

function inIpv4Range(address: number, base: string, prefix: number): boolean {
  const baseValue = ipv4Number(base);
  if (baseValue === null) return false;
  const mask = prefix === 0 ? 0 : (0xffff_ffff << (32 - prefix)) >>> 0;
  return (address & mask) === (baseValue & mask);
}

function publicIpv4(address: string): boolean {
  const value = ipv4Number(address);
  if (value === null) return false;
  const blockedRanges = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ] as const;
  return !blockedRanges.some(([base, prefix]) => inIpv4Range(value, base, prefix));
}

function ipv6Value(address: string): bigint | null {
  if (address.includes("%")) return null;
  let normalized = address.toLowerCase();
  const embeddedIpv4 = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (embeddedIpv4) {
    const value = ipv4Number(embeddedIpv4);
    if (value === null) return null;
    normalized = normalized.replace(
      embeddedIpv4,
      `${((value >>> 16) & 0xffff).toString(16)}:${(value & 0xffff).toString(16)}`,
    );
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const segments =
    halves.length === 2 ? [...left, ...Array.from({ length: missing }, () => "0"), ...right] : left;
  if (
    segments.length !== 8 ||
    segments.some((segment) => !/^[0-9a-f]{1,4}$/.test(String(segment)))
  ) {
    return null;
  }
  return segments.reduce((value, segment) => (value << 16n) | BigInt(`0x${segment}`), 0n);
}

function inIpv6Range(address: bigint, base: string, prefix: number): boolean {
  const baseValue = ipv6Value(base);
  if (baseValue === null) return false;
  const shift = 128n - BigInt(prefix);
  return address >> shift === baseValue >> shift;
}

function publicIpv6(address: string): boolean {
  const value = ipv6Value(address);
  if (value === null) return false;
  const blockedRanges = [
    ["::", 128],
    ["::1", 128],
    ["::ffff:0:0", 96],
    ["64:ff9b::", 96],
    ["64:ff9b:1::", 48],
    ["100::", 64],
    ["2001::", 32],
    ["2001:10::", 28],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["3fff::", 20],
    ["fc00::", 7],
    ["fec0::", 10],
    ["fe80::", 10],
    ["ff00::", 8],
  ] as const;
  return !blockedRanges.some(([base, prefix]) => inIpv6Range(value, base, prefix));
}

export function isPublicNetworkAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? publicIpv4(address) : family === 6 ? publicIpv6(address) : false;
}

function blocked(message: string): never {
  throw new SourceDiscoveryApplicationError("blocked-source", message);
}

export function validatePublicSourceUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SourceDiscoveryApplicationError(
      "invalid-url",
      "Enter a valid public storefront URL.",
    );
  }
  if (url.protocol !== "https:") {
    throw new SourceDiscoveryApplicationError(
      "unsupported-protocol",
      "Public storefront discovery supports HTTPS URLs only.",
    );
  }
  if (url.username || url.password) {
    throw new SourceDiscoveryApplicationError(
      "invalid-url",
      "Storefront URLs containing credentials are not supported.",
    );
  }
  if (url.port && url.port !== "443") {
    blocked("This storefront URL uses a network port that cannot be accessed safely.");
  }
  const hostname = publicSourceHostname(url);
  if (!hostname || blockedHostname(hostname)) {
    blocked("This storefront address cannot be accessed by public-source discovery.");
  }
  if (isIP(hostname) !== 0 && !isPublicNetworkAddress(hostname)) {
    blocked("This storefront address does not resolve to a public network.");
  }
  url.hash = "";
  return url;
}

export function publicSourceHostname(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, "");
}

export function assertPublicResolvedAddresses(addresses: readonly string[]): void {
  if (addresses.length === 0 || addresses.some((address) => !isPublicNetworkAddress(address))) {
    blocked("This storefront address does not resolve to a public network.");
  }
}

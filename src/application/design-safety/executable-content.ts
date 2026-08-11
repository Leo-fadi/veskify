const executableContentPatterns = [
  /<\/?[a-z][^>]*>/i,
  /javascript\s*:/i,
  /```/,
  /\b(?:alert|confirm|prompt|eval|fetch|require|setTimeout|setInterval)\s*\(/i,
  /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/,
  /\bconsole\s*\.\s*(?:log|error|warn|info|debug|trace|table|dir|assert)\s*\(/i,
  /\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\(/i,
  /\b(?:import|export)\s+(?:[\w*{},]+|default\b)/i,
  /\bclass\s+[A-Za-z_$][\w$]*\s*\{/,
  /\b(?:if|for|while|switch)\s*\([^)]*\)\s*\{/i,
  /=>/,
  /\bdocument\s*(?:\.\s*(?:cookie|write|querySelector|getElementById)|\[)/i,
  /\bwindow\s*(?:\.\s*(?:location|open|fetch)|\[)/i,
  /\bglobalThis\s*(?:\.|\[)/i,
  /\bprocess\s*\.\s*(?:env|exit|cwd|argv|stdin|stdout)\b/i,
  /\b(?:module\s*\.\s*exports|exports\s*(?:\.|\[)|subprocess\s*(?:\.|\[)|child_process\s*(?:\.|\[))/i,
  /(?:^|\n)\s*(?:bash|sh|zsh|python\d*|node|pnpm|npm|npx|curl|wget)\b/i,
  /\$\(/,
  /(?:^|\n)\s*(?:[.#][\w-]+|[a-z][\w-]*)\s*\{[^}]*:[^}]*\}/i,
  /\b(?:background|color|display|font-family|position)\s*:\s*[^;\n]+;/i,
] as const;

export function containsExecutableContent(value: unknown): boolean {
  if (typeof value === "string") {
    return executableContentPatterns.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) return value.some(containsExecutableContent);
  if (value && typeof value === "object") {
    return Object.values(value).some(containsExecutableContent);
  }
  return false;
}

export function assertNoExecutableContent(value: unknown): void {
  if (containsExecutableContent(value)) {
    throw new Error("Design authority cannot contain executable or embedded content.");
  }
}

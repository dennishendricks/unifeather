type VersionFormatter = (version: string) => string;

interface MatchRule {
  readonly name: string;
  readonly pattern: RegExp;
  readonly format?: VersionFormatter;
}

interface ParsedMatch {
  readonly name?: string;
  readonly version?: string;
}

export interface DeviceInfo {
  readonly browserName?: string;
  readonly browserVersion?: string;
  readonly osName?: string;
  readonly osVersion?: string;
}

const underscoresToDots: VersionFormatter = (version) => version.replace(/_/g, ".");

const WINDOWS_VERSIONS: Record<string, string> = {
  "10.0": "10/11",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
};

const BROWSER_RULES: readonly MatchRule[] = [
  { name: "Edge", pattern: /Edg(?:e|A|iOS)?\/(\d+)/ },
  { name: "Opera", pattern: /OPR\/(\d+)/ },
  { name: "Samsung Internet", pattern: /SamsungBrowser\/(\d+)/ },
  { name: "Firefox", pattern: /(?:Firefox|FxiOS)\/(\d+)/ },
  { name: "Chrome", pattern: /(?:Chrome|CriOS)\/(\d+)/ },
  { name: "Safari", pattern: /Version\/(\d+).*Safari/ },
];

const OS_RULES: readonly MatchRule[] = [
  { name: "iOS", pattern: /(?:iPhone|iPad); CPU (?:iPhone )?OS (\d+[_.]\d+)/, format: underscoresToDots },
  { name: "Android", pattern: /Android (\d+(?:\.\d+)?)/ },
  { name: "Windows", pattern: /Windows NT (\d+\.\d+)/, format: (v) => WINDOWS_VERSIONS[v] ?? v },
  { name: "macOS", pattern: /Mac OS X (\d+[_.]\d+(?:[_.]\d+)?)/, format: underscoresToDots },
  { name: "Linux", pattern: /Linux/ },
];

const matchFirst = (ua: string, rules: readonly MatchRule[]): ParsedMatch => {
  for (const { name, pattern, format } of rules) {
    const match = ua.match(pattern);
    if (!match) continue;
    const raw = match[1];
    return { name, version: raw ? (format?.(raw) ?? raw) : undefined };
  }
  return {};
};

/** Parse a User-Agent string into coarse browser/OS info. Zero dependencies. */
export const parseUA = (ua: string): DeviceInfo => {
  const browser = matchFirst(ua, BROWSER_RULES);
  const os = matchFirst(ua, OS_RULES);
  return {
    browserName: browser.name,
    browserVersion: browser.version,
    osName: os.name,
    osVersion: os.version,
  };
};

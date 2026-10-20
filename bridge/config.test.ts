import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { hostFor } from "./host.ts";
import {
  defaultSocketPath,
  envBool,
  isLoopbackBindHost,
  loadConfig,
  nonLoopbackBindRefusal,
  resolveBridgeHost,
  resolveStateDir,
  normaliseBasePath, hermesHome } from "./config.ts";
import { DEFAULT_MAX_UPLOAD_BYTES } from "./uploads.ts";

// loadConfig is the deployment contract — env vars in, a resolved Config out. Pure (just reads
// process.env + homedir), so we drive it by mutating the environment and restoring it after.

const KEYS = [
  "ISSANCE_PORT",
  "ISSANCE_HOST",
  "ISSANCE_POLL_MS",
  "ISSANCE_POLL_IDLE_MS",
  "ISSANCE_NOTIFY_DELAY_MS",
  "ISSANCE_CACHE_WARN_SECONDS",
  "ISSANCE_READ_LINES",
  "ISSANCE_TRANSCRIPT",
  "ISSANCE_TRANSCRIPT_ROOT",
  "ISSANCE_REDACT",
  "ISSANCE_CODEX_ROOT",
  "ISSANCE_PI_ROOT",
  "ISSANCE_OPENCODE_ROOT",
  "ISSANCE_GROK_ROOT",
  "ISSANCE_HERMES_ROOT",
  "ISSANCE_OPENCLAW_ROOT",
  // Each harness's own home var participates in journal-root resolution, so the suite must own them
  // too — otherwise a developer with CODEX_HOME set gets different results than CI.
  "CODEX_HOME",
  "PI_CODING_AGENT_DIR",
  "XDG_DATA_HOME",
  "GROK_HOME",
  "HERMES_HOME",
  "OPENCLAW_STATE_DIR",
  "ISSANCE_SUBMIT_KEYS",
  "ISSANCE_TRUSTED_USER",
  "ISSANCE_TRUSTED_USER_OPTIONAL",
  "ISSANCE_ALLOW_NON_LOOPBACK_BIND",
  "ISSANCE_ALLOW_ANY_HOST",
  "ISSANCE_TAILSCALE_HOSTS",
  "ISSANCE_DEVICE_HEADER",
  "ISSANCE_DEVICE_ALLOWLIST",
  "ISSANCE_ALLOWED_ORIGINS",
  "ISSANCE_PUBLIC_HOSTS",
  "ISSANCE_VAPID_PUBLIC",
  "ISSANCE_VAPID_PRIVATE",
  "ISSANCE_VAPID_SUBJECT",
  "ISSANCE_STATE_DIR",
  "ISSANCE_MULTI_SESSION",
  "ISSANCE_SKIP_SERVE",
  "ISSANCE_MAX_UPLOAD_MB",
  "ISSANCE_UPLOAD_EXTRA_TYPES",
  "HERDR_SOCKET_PATH",
  "HERDR_PLUGIN_STATE_DIR",
  "HERDR_PLUGIN_CONFIG_DIR",
  "ISSANCE_HERDR_DIAL",
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("loadConfig", () => {
  test("uses safe single-user defaults", () => {
    const cfg = loadConfig();
    expect(cfg.port).toBe(8787);
    expect(cfg.host).toBe("127.0.0.1");
    expect(cfg.pollMs).toBe(1500);
    expect(cfg.pollIdleMs).toBe(12_000);
    expect(cfg.readLines).toBe(200);
    // Transcript history defaults ON — it's the only scrollback a Claude pane can ever have.
    expect(cfg.transcript).toBe(true);
    // One root by default, and it is a list of one rather than a special case (issue #92).
    expect(cfg.journalRoots.claude).toHaveLength(1);
    expect(cfg.journalRoots.claude[0]).toBe(join(homedir(), ".claude", "projects"));
    // OpenCode keeps ONE sqlite database at the top of its XDG data dir — no per-session files.
    expect(cfg.journalRoots.opencode).toEqual([join(homedir(), ".local", "share", "opencode")]);
    expect(cfg.journalRoots.grok).toEqual([join(homedir(), ".grok", "sessions")]);
    expect(cfg.journalRoots.hermes).toEqual([join(homedir(), ".hermes")]);
    expect(cfg.journalRoots.openclaw).toEqual([join(homedir(), ".openclaw")]);
    expect(cfg.submitKeys).toEqual(["Enter"]);
    expect(cfg.trustedUser).toBe("");
    expect(cfg.trustedUserOptional).toBe(false);
    expect(cfg.allowedOrigins).toEqual([]);
    expect(cfg.notifyDelayMs).toBe(30_000);
    expect(cfg.allowAnyHost).toBe(false);
    expect(cfg.allowNonLoopbackBind).toBe(false);
    expect(cfg.tailscaleHosts).toEqual([]);
    expect(cfg.publicHosts).toEqual([]);
    // Per-device auth is off by default (empty header = feature disabled).
    expect(cfg.deviceHeader).toBe("");
    expect(cfg.deviceAllowlist).toEqual([]);
    // Multi-session support is on by default.
    expect(cfg.multiSession).toBe(true);
    // tailscale serve is used by default (reverse-proxy bypass is opt-in).
    expect(cfg.skipServe).toBe(false);
  });

  test("parses ISSANCE_MULTI_SESSION as a boolean toggle (default on)", () => {
    // Falsey spellings turn it off (pin to the primary session only).
    for (const off of ["off", "0", "false", "no", "OFF", " False "]) {
      process.env.ISSANCE_MULTI_SESSION = off;
      expect(loadConfig().multiSession).toBe(false);
    }
    // Truthy spellings keep it on.
    for (const on of ["on", "1", "true", "yes", "ON", " True "]) {
      process.env.ISSANCE_MULTI_SESSION = on;
      expect(loadConfig().multiSession).toBe(true);
    }
    // Garbage and empty fall back to the default (on).
    process.env.ISSANCE_MULTI_SESSION = "banana";
    expect(loadConfig().multiSession).toBe(true);
    process.env.ISSANCE_MULTI_SESSION = "";
    expect(loadConfig().multiSession).toBe(true);
  });

  test("parses ISSANCE_SKIP_SERVE as a boolean toggle (default off)", () => {
    // Truthy spellings turn it on (reverse-proxy mode; bypass tailscale serve).
    for (const on of ["on", "1", "true", "yes", "ON", " True "]) {
      process.env.ISSANCE_SKIP_SERVE = on;
      expect(loadConfig().skipServe).toBe(true);
    }
    // Falsey spellings keep it off (the default tailscale serve path).
    for (const off of ["off", "0", "false", "no", "OFF", " False "]) {
      process.env.ISSANCE_SKIP_SERVE = off;
      expect(loadConfig().skipServe).toBe(false);
    }
    // Garbage and empty fall back to the default (off).
    process.env.ISSANCE_SKIP_SERVE = "banana";
    expect(loadConfig().skipServe).toBe(false);
    process.env.ISSANCE_SKIP_SERVE = "";
    expect(loadConfig().skipServe).toBe(false);
  });

  test("parses ISSANCE_TRANSCRIPT as a boolean toggle (default ON)", () => {
    for (const off of ["off", "0", "false", "no", "OFF"]) {
      process.env.ISSANCE_TRANSCRIPT = off;
      expect(loadConfig().transcript).toBe(false);
    }
    for (const on of ["on", "1", "true", "yes"]) {
      process.env.ISSANCE_TRANSCRIPT = on;
      expect(loadConfig().transcript).toBe(true);
    }
    // Garbage falls back to the default — a typo must not silently remove the only scrollback a
    // Claude pane has.
    process.env.ISSANCE_TRANSCRIPT = "banana";
    expect(loadConfig().transcript).toBe(true);
  });

  test("ISSANCE_REDACT masks secrets by default and turns off with off/0/false/no", () => {
    expect(loadConfig().redact).toBe(true);
    for (const off of ["off", "0", "false", "no", "OFF"]) {
      process.env.ISSANCE_REDACT = off;
      expect(loadConfig().redact).toBe(false);
    }
    process.env.ISSANCE_REDACT = "on";
    expect(loadConfig().redact).toBe(true);
    // A typo must not quietly turn the mask off.
    process.env.ISSANCE_REDACT = "banana";
    expect(loadConfig().redact).toBe(true);
  });

  // ISSANCE_TRANSCRIPT_ROOT predates the per-harness split and meant Claude's root — it keeps meaning
  // exactly that, so an existing deployment's env survives the change untouched.
  test("ISSANCE_TRANSCRIPT_ROOT relocates the CLAUDE journal root", () => {
    process.env.ISSANCE_TRANSCRIPT_ROOT = "/srv/claude/projects";
    expect(loadConfig().journalRoots.claude).toEqual(["/srv/claude/projects"]);
  });

  // The multi-profile case from issue #92: CLAUDE_CONFIG_DIR gives each Claude profile its own
  // projects tree, so one root can only ever serve half the herd's history.
  test("ISSANCE_TRANSCRIPT_ROOT takes several roots, comma-separated and in order", () => {
    process.env.ISSANCE_TRANSCRIPT_ROOT = "/srv/work/projects,/srv/personal/projects";
    expect(loadConfig().journalRoots.claude).toEqual([
      "/srv/work/projects",
      "/srv/personal/projects",
    ]);
  });

  test("whitespace and empty entries around the separators are dropped", () => {
    process.env.ISSANCE_TRANSCRIPT_ROOT = " /a/projects , , /b/projects ,";
    expect(loadConfig().journalRoots.claude).toEqual(["/a/projects", "/b/projects"]);
  });

  // An empty value used to become a root of `""` — which resolves against the bridge's cwd, not a
  // journal. Falling back to the default is both safer and what the operator meant.
  test("an empty value falls back to the default root", () => {
    process.env.ISSANCE_TRANSCRIPT_ROOT = "   ";
    expect(loadConfig().journalRoots.claude).toEqual([join(homedir(), ".claude", "projects")]);
  });

  test("every harness root takes a list, not just Claude's", () => {
    process.env.ISSANCE_CODEX_ROOT = "/a/sessions,/b/sessions";
    process.env.ISSANCE_PI_ROOT = "/c/sessions,/d/sessions";
    process.env.ISSANCE_OPENCODE_ROOT = "/e/opencode,/f/opencode";
    process.env.ISSANCE_GROK_ROOT = "/g/sessions,/h/sessions";
    const cfg = loadConfig();
    expect(cfg.journalRoots.codex).toEqual(["/a/sessions", "/b/sessions"]);
    expect(cfg.journalRoots.pi).toEqual(["/c/sessions", "/d/sessions"]);
    expect(cfg.journalRoots.opencode).toEqual(["/e/opencode", "/f/opencode"]);
    expect(cfg.journalRoots.grok).toEqual(["/g/sessions", "/h/sessions"]);
  });

  test("each harness's own home var relocates its journal root", () => {
    process.env.CODEX_HOME = "/srv/codex";
    process.env.PI_CODING_AGENT_DIR = "/srv/pi";
    process.env.XDG_DATA_HOME = "/srv/share";
    process.env.GROK_HOME = "/srv/grok";
    const cfg = loadConfig();
    expect(cfg.journalRoots.codex).toEqual([join("/srv/codex", "sessions")]);
    expect(cfg.journalRoots.pi).toEqual([join("/srv/pi", "sessions")]);
    expect(cfg.journalRoots.opencode).toEqual([join("/srv/share", "opencode")]);
    expect(cfg.journalRoots.grok).toEqual([join("/srv/grok", "sessions")]);
  });

  test("an explicit ISSANCE_* root beats the harness's home var", () => {
    process.env.CODEX_HOME = "/srv/codex";
    process.env.ISSANCE_CODEX_ROOT = "/elsewhere/rollouts";
    expect(loadConfig().journalRoots.codex).toEqual(["/elsewhere/rollouts"]);
  });

  test("ISSANCE_HERMES_ROOT relocates Hermes state.db", () => {
    process.env.ISSANCE_HERMES_ROOT = "/srv/hermes";
    expect(loadConfig().journalRoots.hermes).toEqual(["/srv/hermes"]);
  });

  test("Hermes's root follows HERMES_HOME, and the issance override wins", () => {
    process.env.HERMES_HOME = "/srv/hermes-home";
    // `hermesHome` resolves the value to compare it with ~/.hermes, so on Windows it gains a drive.
    expect(loadConfig().journalRoots.hermes).toEqual([resolve("/srv/hermes-home")]);
    process.env.ISSANCE_HERMES_ROOT = "/srv/hermes";
    expect(loadConfig().journalRoots.hermes).toEqual(["/srv/hermes"]);
  });

  // A process Hermes runs inside a named profile has HERMES_HOME set to that profile's folder, and
  // Hermes keeps every profile under its home, not under the profile (`get_default_hermes_root`).
  test("a HERMES_HOME that is a named profile resolves to the home that holds every profile", () => {
    const home = resolve("/home/u");
    const native = join(home, ".hermes");
    expect(hermesHome(undefined, home)).toBe(native);
    expect(hermesHome("", home)).toBe(native);
    expect(hermesHome(join(native, "profiles", "assistant"), home)).toBe(native);
    expect(hermesHome(native, home)).toBe(native);
    expect(hermesHome(join(resolve("/opt/data"), "profiles", "coder"), home)).toBe(resolve("/opt/data"));
    expect(hermesHome(resolve("/opt/data"), home)).toBe(resolve("/opt/data"));
    expect(hermesHome(join(home, ".hermes-other"), home)).toBe(join(home, ".hermes-other"));
  });

  test("OpenClaw's state folder follows OPENCLAW_STATE_DIR, and the issance override wins", () => {
    process.env.OPENCLAW_STATE_DIR = "/srv/openclaw-state";
    expect(loadConfig().journalRoots.openclaw).toEqual(["/srv/openclaw-state"]);
    process.env.ISSANCE_OPENCLAW_ROOT = "/srv/a,/srv/b";
    expect(loadConfig().journalRoots.openclaw).toEqual(["/srv/a", "/srv/b"]);
  });

  // The operator's rows sit beside their .env, and the launcher hands us that dir precisely so the
  // bridge and scripts/issance-ctl.sh never disagree about which one it is.
  test("commands.toml is resolved in the plugin config dir the launcher passed", () => {
    process.env.HERDR_PLUGIN_CONFIG_DIR = "/srv/herdr/plugins/issance";
    expect(loadConfig().commandsFile).toBe(join("/srv/herdr/plugins/issance", "commands.toml"));
    expect(loadConfig().keysFile).toBe(join("/srv/herdr/plugins/issance", "keys.toml"));
    delete process.env.HERDR_PLUGIN_CONFIG_DIR;
    expect(loadConfig().commandsFile).toBe(join(homedir(), ".config", "issance", "commands.toml"));
    expect(loadConfig().keysFile).toBe(join(homedir(), ".config", "issance", "keys.toml"));
  });

  test("reads the per-device auth header and allowlist", () => {
    process.env.ISSANCE_DEVICE_HEADER = "  X-Device-Id  ";
    process.env.ISSANCE_DEVICE_ALLOWLIST = " phone , laptop ,";
    const cfg = loadConfig();
    expect(cfg.deviceHeader).toBe("X-Device-Id");
    expect(cfg.deviceAllowlist).toEqual(["phone", "laptop"]);
  });

  test("parses integer env vars and falls back to the default on garbage", () => {
    process.env.ISSANCE_PORT = "9999";
    expect(loadConfig().port).toBe(9999);
    process.env.ISSANCE_PORT = "not-a-number";
    expect(loadConfig().port).toBe(8787);
  });

  test("rejects trailing-garbage integers (parseInt would have accepted '8080abc')", () => {
    process.env.ISSANCE_PORT = "8080abc";
    expect(loadConfig().port).toBe(8787);
    // Surrounding whitespace is still fine.
    process.env.ISSANCE_READ_LINES = "  120  ";
    expect(loadConfig().readLines).toBe(120);
  });

  test("clamps out-of-range integers back to the default", () => {
    process.env.ISSANCE_PORT = "0";
    expect(loadConfig().port).toBe(8787);
    process.env.ISSANCE_PORT = "70000";
    expect(loadConfig().port).toBe(8787);
    process.env.ISSANCE_POLL_MS = "100"; // below the 250 floor
    expect(loadConfig().pollMs).toBe(1500);
    process.env.ISSANCE_POLL_IDLE_MS = "500"; // below the 1000 floor
    expect(loadConfig().pollIdleMs).toBe(12_000);
    process.env.ISSANCE_NOTIFY_DELAY_MS = "-5"; // below the 0 floor
    expect(loadConfig().notifyDelayMs).toBe(30_000);
  });

  test("accepts an in-range integer and a zero notify delay", () => {
    process.env.ISSANCE_POLL_MS = "250";
    expect(loadConfig().pollMs).toBe(250);
    process.env.ISSANCE_POLL_IDLE_MS = "30000";
    expect(loadConfig().pollIdleMs).toBe(30_000);
    process.env.ISSANCE_NOTIFY_DELAY_MS = "0";
    expect(loadConfig().notifyDelayMs).toBe(0);
  });

  test("ISSANCE_CACHE_WARN_SECONDS defaults to 300 and is bounded at 30 and 3600", () => {
    // The push window for a watched pane (ADR 0042), and NOT the quarter-of-the-TTL threshold that
    // turns the countdown chip amber. Two numbers with two jobs, so this one has its own bounds: a
    // window shorter than one idle poll is noise, and an hour is past the longest TTL any rule claims.
    expect(loadConfig().cacheWarnSeconds).toBe(300);
    process.env.ISSANCE_CACHE_WARN_SECONDS = "600";
    expect(loadConfig().cacheWarnSeconds).toBe(600);
    process.env.ISSANCE_CACHE_WARN_SECONDS = "29";
    expect(loadConfig().cacheWarnSeconds).toBe(300);
    process.env.ISSANCE_CACHE_WARN_SECONDS = "3601";
    expect(loadConfig().cacheWarnSeconds).toBe(300);
    process.env.ISSANCE_CACHE_WARN_SECONDS = "five minutes";
    expect(loadConfig().cacheWarnSeconds).toBe(300);
  });

  test("uses the default upload cap when unset, and resolves ISSANCE_MAX_UPLOAD_MB to bytes", () => {
    expect(loadConfig().maxUploadBytes).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    process.env.ISSANCE_MAX_UPLOAD_MB = "5";
    expect(loadConfig().maxUploadBytes).toBe(5 * 1024 * 1024);
  });

  test("an out-of-range or non-integer ISSANCE_MAX_UPLOAD_MB falls back to the default", () => {
    process.env.ISSANCE_MAX_UPLOAD_MB = "0";
    expect(loadConfig().maxUploadBytes).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    process.env.ISSANCE_MAX_UPLOAD_MB = "9999";
    expect(loadConfig().maxUploadBytes).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    process.env.ISSANCE_MAX_UPLOAD_MB = "not-a-number";
    expect(loadConfig().maxUploadBytes).toBe(DEFAULT_MAX_UPLOAD_BYTES);
  });

  test("ISSANCE_UPLOAD_EXTRA_TYPES normalises entries: lowercased, leading dot forgiven, invalid dropped, deduped", () => {
    process.env.ISSANCE_UPLOAD_EXTRA_TYPES = " .RB, ex ,bad name,rb";
    expect(loadConfig().uploadExtraTypes).toEqual(["rb", "ex"]);
  });

  test("reads the public-hosts allowlist, trimming and dropping blanks", () => {
    process.env.ISSANCE_PUBLIC_HOSTS = " issance.example.ts.net , issance.example.com:8443 ,";
    expect(loadConfig().publicHosts).toEqual([
      "issance.example.ts.net",
      "issance.example.com:8443",
    ]);
  });

  test("splits comma lists, trimming whitespace and dropping blanks", () => {
    process.env.ISSANCE_SUBMIT_KEYS = " ctrl+a , Enter ,";
    expect(loadConfig().submitKeys).toEqual(["ctrl+a", "Enter"]);
    process.env.ISSANCE_ALLOWED_ORIGINS = "https://a.example.com, https://b.example.com";
    expect(loadConfig().allowedOrigins).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  test("falls back to [Enter] when ISSANCE_SUBMIT_KEYS is empty", () => {
    process.env.ISSANCE_SUBMIT_KEYS = "";
    expect(loadConfig().submitKeys).toEqual(["Enter"]);
  });

  test("honours an explicit trusted user", () => {
    process.env.ISSANCE_TRUSTED_USER = "me@example.com";
    const cfg = loadConfig();
    expect(cfg.trustedUser).toBe("me@example.com");
  });

  test("carries a non-loopback bind and its escape hatch without deciding either", () => {
    process.env.ISSANCE_HOST = "0.0.0.0";
    // loadConfig REPORTS the bind; it does not refuse it. The refusal needs the crew mode, which is
    // resolved after this runs (bridge/index.ts) — see nonLoopbackBindRefusal below.
    expect(loadConfig().host).toBe("0.0.0.0");
    expect(loadConfig().allowNonLoopbackBind).toBe(false);
    process.env.ISSANCE_ALLOW_NON_LOOPBACK_BIND = "1";
    expect(loadConfig().allowNonLoopbackBind).toBe(true);
  });

  test("parses discovered Tailscale hosts and the two fail-closed opt-outs", () => {
    process.env.ISSANCE_TAILSCALE_HOSTS = "host.tailnet.ts.net,100.64.0.1";
    process.env.ISSANCE_ALLOW_ANY_HOST = "1";
    process.env.ISSANCE_TRUSTED_USER_OPTIONAL = "1";
    const cfg = loadConfig();
    expect(cfg.tailscaleHosts).toEqual(["host.tailnet.ts.net", "100.64.0.1"]);
    expect(cfg.allowAnyHost).toBe(true);
    expect(cfg.trustedUserOptional).toBe(true);
  });

  test("dial mode defaults to auto and accepts a forced dialer", () => {
    expect(loadConfig().dialMode).toBe("auto");
    process.env.ISSANCE_HERDR_DIAL = "net";
    expect(loadConfig().dialMode).toBe("net");
    process.env.ISSANCE_HERDR_DIAL = "BUN"; // case-insensitive
    expect(loadConfig().dialMode).toBe("bun");
  });

  test("an unrecognised dial mode falls back to auto rather than dialling nothing", () => {
    process.env.ISSANCE_HERDR_DIAL = "carrier-pigeon";
    expect(loadConfig().dialMode).toBe("auto");
  });
});

describe("nonLoopbackBindRefusal", () => {
  test("a loopback bind is never refused, whatever the hatch says", () => {
    expect(nonLoopbackBindRefusal({ host: "127.0.0.1", allowNonLoopbackBind: false })).toBeNull();
    expect(nonLoopbackBindRefusal({ host: "::1", allowNonLoopbackBind: false })).toBeNull();
  });

  test("a wide bind is refused, and names the one variable that permits it", () => {
    const why = nonLoopbackBindRefusal({ host: "0.0.0.0", allowNonLoopbackBind: false });
    expect(why).toMatch(/not a loopback address/);
    expect(why).toContain("ISSANCE_ALLOW_NON_LOOPBACK_BIND=1");
  });

  test("an empty ISSANCE_HOST is a wide bind, and says so in words", () => {
    expect(nonLoopbackBindRefusal({ host: "", allowNonLoopbackBind: false })).toContain(
      "every interface",
    );
  });

  test("the escape hatch clears it", () => {
    expect(nonLoopbackBindRefusal({ host: "10.0.0.4", allowNonLoopbackBind: true })).toBeNull();
  });
});

// Pure — both platform branches are testable from any host (expectations use join() so the
// host's separator never leaks into the assertion).
describe("isLoopbackBindHost", () => {
  test("accepts loopback spellings and rejects wildcards and LAN", () => {
    expect(isLoopbackBindHost("127.0.0.1")).toBe(true);
    expect(isLoopbackBindHost("localhost")).toBe(true);
    expect(isLoopbackBindHost("::1")).toBe(true);
    expect(isLoopbackBindHost("[::1]")).toBe(true);
    expect(isLoopbackBindHost("127.1.2.3")).toBe(true);
    expect(isLoopbackBindHost("0.0.0.0")).toBe(false);
    expect(isLoopbackBindHost("::")).toBe(false);
    expect(isLoopbackBindHost("10.0.0.1")).toBe(false);
    expect(isLoopbackBindHost("example.com")).toBe(false);
  });
});

describe("defaultSocketPath", () => {
  test("unix default lives under ~/.config/hangar", () => {
    expect(defaultSocketPath(hostFor("linux"), {}, "/home/u")).toBe("/home/u/.config/hangar/herdr.sock");
    expect(defaultSocketPath(hostFor("darwin"), {}, "/Users/u")).toBe("/Users/u/.config/hangar/herdr.sock");
  });

  test("win32 default honours APPDATA", () => {
    expect(defaultSocketPath(hostFor("win32"), { APPDATA: "C:\\Users\\u\\AppData\\Roaming" }, "C:\\Users\\u")).toBe(
      "C:\\Users\\u\\AppData\\Roaming\\\hangar\\\herdr.sock",
    );
  });

  test("win32 falls back to <home>/AppData/Roaming when APPDATA is unset", () => {
    expect(defaultSocketPath(hostFor("win32"), {}, "C:\\Users\\u")).toBe(
      "C:\\Users\\u\\AppData\\Roaming\\\hangar\\\herdr.sock",
    );
  });
});

// #226: a Hangar plugin action carries HERDR_PLUGIN_STATE_DIR and the service does not, so honouring it
// sent `push-test` (and every other state-reading action) to a directory the bridge never uses.
describe("resolveStateDir", () => {
  test("ignores the state dir Hangar injects into a plugin action", () => {
    expect(resolveStateDir({ HERDR_PLUGIN_STATE_DIR: "/h/.local/state/herdr/plugins/herdr.issance" }, "/h")).toBe(
      join("/h", ".local", "state", "issance"),
    );
  });

  test("ISSANCE_STATE_DIR still moves it, with or without Hangar's variable beside it", () => {
    expect(resolveStateDir({ ISSANCE_STATE_DIR: "/s" }, "/h")).toBe("/s");
    expect(resolveStateDir({ ISSANCE_STATE_DIR: "/s", HERDR_PLUGIN_STATE_DIR: "/p" }, "/h")).toBe("/s");
  });
});

// Also the source `cli/doctor.ts`'s bind check and `cli/lifecycle.ts`'s readiness probe read, so a
// peer's ISSANCE_HOST resolves identically wherever it's asked.
describe("resolveBridgeHost", () => {
  test("absent ISSANCE_HOST resolves to loopback", () => {
    expect(resolveBridgeHost({})).toBe("127.0.0.1");
  });

  test("an explicit ISSANCE_HOST is used verbatim — a peer's tailnet address, say", () => {
    expect(resolveBridgeHost({ ISSANCE_HOST: "100.64.0.8" })).toBe("100.64.0.8");
  });

  test("explicitly empty is passed through, not defaulted — the wildcard-bind case", () => {
    expect(resolveBridgeHost({ ISSANCE_HOST: "" })).toBe("");
  });
});

// Exported so mode-scoped config (bridge/crew/config.ts) parses its env in this exact style instead
// of growing a second reader. The env source is injectable, which is the only new thing here — the
// truth table below is the one loadConfig has always used.
describe("envBool", () => {
  test("empty and unset fall back", () => {
    expect(envBool("X", true, {})).toBe(true);
    expect(envBool("X", false, {})).toBe(false);
    expect(envBool("X", true, { X: "" })).toBe(true);
    expect(envBool("X", true, { X: "   " })).toBe(true);
  });

  test("the truthy and falsy vocabularies, case-insensitively", () => {
    for (const v of ["on", "1", "true", "yes", "TRUE", " Yes "]) expect(envBool("X", false, { X: v })).toBe(true);
    for (const v of ["off", "0", "false", "no", "OFF", " No "]) expect(envBool("X", true, { X: v })).toBe(false);
  });

  test("garbage falls back rather than silently flipping a feature", () => {
    expect(envBool("X", true, { X: "maybe" })).toBe(true);
    expect(envBool("X", false, { X: "maybe" })).toBe(false);
  });

  test("defaults to process.env when no source is given", () => {
    process.env.ISSANCE_MULTI_SESSION = "off";
    expect(envBool("ISSANCE_MULTI_SESSION", true)).toBe(false);
  });
});

// ADR 0052: the mount is a runtime setting, and this is its one reader.
describe("normaliseBasePath — ISSANCE_BASE_PATH as the bridge mounts it", () => {
  test("the root for unset, empty and a bare slash", () => {
    for (const v of [undefined, "", "  ", "/", "//"]) expect(normaliseBasePath(v)).toBe("/");
  });

  test("one leading and one trailing slash around the given segments", () => {
    for (const v of ["issance", "/issance", "issance/", "/issance/", "//issance//", " /issance "]) {
      expect(normaliseBasePath(v)).toBe("/issance/");
    }
    expect(normaliseBasePath("apps/issance")).toBe("/apps/issance/");
  });

  test("refuses what a URL path cannot carry, and answers the root", () => {
    for (const v of ["..", "/a/../b", "./issance", "a b", "a?b", "a#b", "a\\b"]) {
      expect(normaliseBasePath(v)).toBe("/");
    }
  });

  test("loadConfig carries it", () => {
    process.env.ISSANCE_BASE_PATH = "issance";
    expect(loadConfig().basePath).toBe("/issance/");
    delete process.env.ISSANCE_BASE_PATH;
    expect(loadConfig().basePath).toBe("/");
  });
});

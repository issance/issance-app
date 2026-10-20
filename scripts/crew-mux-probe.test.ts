// The probe's token rule: ISSANCE_TOKEN first, the local secret only for a loopback lead, and never
// the local secret toward another host. The probe itself needs a live crew and is not run here.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { authHeaders, isLoopbackUrl } from "./crew-mux-probe.ts";

const SECRET = "a".repeat(43); // the local secret's shape: 43 base64url characters, a placeholder
const STATE = "/tmp/issance-test-state";
const disk = (files: Record<string, string>) => (path: string) => files[path] ?? null;
const withSecret = disk({ [join(STATE, "local-secret")]: `${SECRET}\n` });

describe("crew-mux-probe authHeaders", () => {
  test("ISSANCE_TOKEN wins, for a local and for a remote lead", () => {
    for (const lead of ["http://127.0.0.1:8787", "https://issance.example.test"]) {
      expect(authHeaders(lead, { ISSANCE_TOKEN: " tok-placeholder ", ISSANCE_STATE_DIR: STATE }, withSecret)).toEqual({
        authorization: "Bearer tok-placeholder",
      });
    }
  });

  test("a loopback lead without ISSANCE_TOKEN reads the local secret from ISSANCE_STATE_DIR", () => {
    for (const lead of ["http://127.0.0.1:8787", "http://localhost:8788", "http://[::1]:8787"]) {
      expect(authHeaders(lead, { ISSANCE_STATE_DIR: STATE }, withSecret)).toEqual({ authorization: `Bearer ${SECRET}` });
    }
  });

  test("the local secret never goes to another host", () => {
    for (const lead of ["http://100.64.0.8:8789", "https://issance.example.test", "not a url"]) {
      expect(authHeaders(lead, { ISSANCE_STATE_DIR: STATE }, withSecret)).toEqual({});
    }
  });

  test("no token and no secret on disk: no header, and the lead's 403 is the answer", () => {
    expect(authHeaders("http://127.0.0.1:8787", { ISSANCE_STATE_DIR: STATE }, disk({}))).toEqual({});
    expect(authHeaders("http://127.0.0.1:8787", { ISSANCE_TOKEN: "  ", ISSANCE_STATE_DIR: STATE }, disk({}))).toEqual({});
  });

  test("isLoopbackUrl", () => {
    expect(isLoopbackUrl("http://127.0.0.2:1")).toBe(true);
    expect(isLoopbackUrl("http://127.0.0.1.example.test")).toBe(false);
    expect(isLoopbackUrl("http://minibuch:8789")).toBe(false);
  });
});

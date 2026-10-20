import { describe, expect, test } from "bun:test";

import { hostFor } from "../bridge/host.ts";
import { fakeFiles, posixKey } from "./fakes.ts";

describe("posixKey", () => {
  test("folds a Windows path to the POSIX key a fake filesystem stores", () => {
    expect(posixKey("C:\\opt\\issance\\bin\\issance.exe", hostFor("win32"))).toBe("/opt/issance/bin/issance.exe");
    expect(posixKey("\\opt\\issance", hostFor("win32"))).toBe("/opt/issance");
  });

  test("without a host it folds, so a Windows host pinned on Linux still finds its files", () => {
    expect(posixKey("C:\\opt\\issance")).toBe("/opt/issance");
    expect(posixKey("/opt/issance")).toBe("/opt/issance");
  });

  test("leaves a path alone off Windows, where a backslash is a legal name character", () => {
    expect(posixKey("/opt/co\\llie", hostFor("linux"))).toBe("/opt/co\\llie");
  });
});

describe("fakeFiles", () => {
  test("answers a path seeded by its POSIX key", () => {
    const files = fakeFiles({ "/opt/issance/VERSION": "1.0.0\n" });
    expect(files.read("/opt/issance/VERSION")).toBe("1.0.0\n");
    expect(files.exists("/opt/issance")).toBe(true);
  });
});

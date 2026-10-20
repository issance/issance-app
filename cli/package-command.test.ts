import { describe, expect, test } from "bun:test";

import { PACKAGED_SENTENCE } from "./install-kind.ts";
import { packageCommand } from "./package-command.ts";

// ── Naming the command, once the kind is already decided ─────────────────────
// The prefix is NEVER evidence of the kind (M17 principle 3). It only chooses which words to print
// after `classifyInstall` has already said `packaged`, and an unrecognised prefix costs the operator
// a command, never a wrong kind.

describe("packageCommand", () => {
  test("each prefix we publish to names its own manager", () => {
    expect(packageCommand("/opt/issance")).toBe("sudo pacman -Syu issance-bin");
    expect(packageCommand("/opt/issance/bin")).toBe("sudo pacman -Syu issance-bin");
    // The root every `issance-bin` before the /opt move installed to, still answered.
    expect(packageCommand("/usr/lib/issance")).toBe("sudo pacman -Syu issance-bin");
    expect(packageCommand("/nix/store/abc123-issance-1.5.3")).toBe("nix profile upgrade issance");
    expect(packageCommand("/opt/homebrew/Cellar/issance/1.5.3")).toBe("brew upgrade issance");
    expect(packageCommand("/usr/local/Cellar/issance/1.5.3")).toBe("brew upgrade issance");
  });

  test("an unrecognised prefix answers null, and the sentence stands on its own", () => {
    expect(packageCommand("/opt/vendor/issance")).toBeNull();
    expect(packageCommand("/usr/lib/issance-something-else")).toBeNull();
    expect(packageCommand("/opt/issance-something-else")).toBeNull();
    expect(PACKAGED_SENTENCE).toBe("updates come from your package manager");
  });
});

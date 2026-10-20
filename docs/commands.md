# Commands

Every verb uses the format **`issance <verb>`**. This is the canonical syntax across all
installations, implemented directly in the binary (`cli/`). Before adding `issance` to your PATH
([below](#put-issance-on-your-path)), run `bin/issance <verb>` from the repository root. On a
Hangar-managed installation, these same verbs register as Hangar actions ([below](#herdr-actions))
with identical behavior.

If the host runs multiple instances, prepend `ISSANCE_INSTANCE=<name>` to every verb. See
[Multiple issance instances on one host](deployment.md#multiple-issance-instances-on-one-host).

| Verb | Command | What it does |
| --- | --- | --- |
| **Start** | `issance start` | Build if needed, serve, print the URL |
| **Stop** | `issance stop` | Pause the bridge; removes nothing |
| **Restart** | `issance restart` | Stop, then start |
| **Status** | `issance status` | The *issance is running* banner + URLs |
| **URL** | `issance url` | Print the tailnet URL |
| **QR** | `issance qr` | The same URL as a scannable code |
| **Version** | `issance version` | The running version (`0.x.y+sha`) |
| **Skill** | `issance skill` | The agent-facing brief on issance, for an AI coding agent working in your terminal (also `issance --skill`). `issance skill install`, `uninstall`, `sync`, `status` and `print` manage the walky talky skill in your agents' instruction files; `issance update` runs `sync` after each update ([Install the skill](walky-talky.md#install-the-skill)) |
| **Docs** | `issance docs` · `issance docs <name>` · `issance docs --all` | These pages, printed out of the binary itself |
| **Update** | `issance update` | Stage the newest release of your major, flip to it, restart and verify (`--check` preflights, `--status` reports, `--major` crosses one) |
| **Rollback** | `issance update --rollback` | Put the previous version back (not on a Hangar-managed checkout, which has none staged) |
| **Uninstall** | `issance uninstall` | Remove the service; keep `.env` and the install |
| **Pair** | `issance pair` · `issance pair --expires <duration>` | Print an 8-character code and a QR code, good for 10 minutes; scan the QR code to open Settings → System → Paired devices with the code filled in, or enter the code manually to get it [paired](security.md#pair-a-device--the-write-credential). Without `--expires` the token never expires and the command says so; with it (`12h`, `30d`, `2w`) the command prints the date the token stops working once claimed. A script claims the code with a label of its own, for example `script`, and pairs once ([Give a device an expiry](security.md#give-a-device-an-expiry)) |
| **Devices** | `issance devices list` · `issance devices revoke <label>` · `issance devices set-expiry <label> <duration>` · `issance devices clear-expiry <label>` | List / revoke paired devices, or change when one [expires](security.md#give-a-device-an-expiry). `list` shows each device's expiry as `no expiry`, `expires <date>` or `EXPIRED <date>`. `set-expiry` counts a new lifetime from now; `clear-expiry` removes it. A label matches exactly, or without case when only one device fits |
| **Link** | `issance link` · `issance unlink` | Put `issance` on your PATH ([below](#put-issance-on-your-path)) |
| **Logs** | `issance logs` | Tail the service log |
| **Config** | `issance config show` · `issance config check` · `issance config init` | Print every setting with its source, validate the file, or write a commented `config.toml` ([the config file](configure.md#the-config-file)) |
| **Durable agents** | `issance durable attach <name> --socket <path>` · `issance durable attach <name> --url <url> --token-env <VAR>` · `issance durable detach <name>` · `issance durable list` | Add a durable agent to `sources.json`, remove it, or list each durable agent with the state the running bridge gives it. `attach` and `detach` apply at the next restart, or at once with `--restart`. Flags, output and exit codes: [Durable agents](durable-agents.md#the-three-verbs) |
| **Walky talky** | `issance walky who` · `issance walky send <address> <text>` · `issance walky reply <id> <text>` · `issance walky inbox` · `issance walky status <id>` | Message an agent session from a terminal, or from one agent to another ([Walky talky](walky-talky.md)) |
| **Voice** | `issance stt setup` · `stt test` · `stt status` · `stt off` | Configure / check / disable [voice input](voice-and-push.md#voice-input-optional) |
| **Push keys** | `issance push-keys` | Generate the VAPID keypair into your `.env` |
| **Push test** | `issance push-test` | Send one notification to prove it works |

The CLI also includes `build`, `serve`, `unserve`, `doctor`, and `crew …` for less frequent tasks.

Both `start` and `status` output the **issance is running** banner: a health mark and the version,
then a `service`, a `local` and a `tailnet` line.
[First run](install.md#first-run-what-youll-see) shows it in full, including what a failed health
check prints instead. The reported version reads from the served bundle stamp, reflecting the active
build.

**Ink or plain text.** The `start`, `status`, `doctor`, `crew add`, and `crew status` commands
render an interactive terminal UI when stdout is a TTY. Passing `--plain`, or redirecting output to
a pipe, file, systemd journal, or CI runner, falls back to raw line output.


## Put `issance` on your PATH

Run `issance link` to publish `~/.local/bin/issance`:

```bash
bin/issance link          # ~/.local/bin/issance → <checkout>/bin/issance
issance status            # from anywhere
bin/issance unlink        # take the name back down
```

It creates a **symlink to the checkout's binary**, so future `issance build` updates take effect
immediately without extra steps
([ADR 0021](../.adr/0021-the-path-name-is-a-pointer-never-a-copy.md)). The command replaces existing
links from other issance checkouts and prints which one it overwrote. It refuses to overwrite
non-issance files at that path. `unlink` removes the symlink only if it targets *your* current
checkout.

If `~/.local/bin` is missing from your `PATH`, `link` warns you and exits. It never edits your shell
profile. Run `issance doctor` to check the `path-link` line and see which checkout the bare `issance`
command resolves to.

## Hangar actions

**Applies only to a Hangar-managed install** created with `hangar plugin install issance/issance-app` or
`hangar plugin link`. Hangar is one of five multiplexers issance supports. These actions map directly
to the adapter: each action forwards the verb to the same `issance` binary documented in the table
above. On binary installs created via `scripts/install.sh`, plugin actions do not exist, and
`issance <verb>` is the only syntax.

issance registers these actions in `herdr-plugin.toml`. Invoke them with
`hangar plugin action invoke <id> --plugin herdr.issance`, or view them with
`hangar plugin action list --plugin herdr.issance`:

| `<id>` | Equivalent verb | What it does |
| --- | --- | --- |
| `start` | `issance start` | Build if needed, start the service, `tailscale serve`, print URL + banner |
| `stop` | `issance stop` | Pause the bridge; removes nothing |
| `restart` | `issance restart` | `stop` + `start` |
| `status` | `issance status` | The *issance is running* banner — readiness ✓/⚠, version, URLs |
| `url` | `issance url` | Print the tailnet URL |
| `version` | `issance version` | Print the running version (`0.x.y+sha`) |
| `update` | `issance update` | Advance the checkout (pull, or fetch + re-detach) + rebuild + restart |
| `uninstall` | `issance uninstall` | Tear down the service (keeps `.env` + checkout) |
| `push-keys` | `issance push-keys` | Write a VAPID keypair into the `.env` the service reads |
| `push-test` | `issance push-test` | Push one notification to every subscribed device |

`qr`, `pair`, `devices`, `link`, `logs`, `stt`, and `config` have no corresponding plugin action
because they require a terminal, positional arguments, or both. Run them as `issance <verb>`.

**Hangar actions return Hangar's JSON envelope instead of the terminal banner.** View the action's
captured stdout with `hangar plugin log list --plugin herdr.issance`, or run `issance <verb>` directly
to print output inline. Output from `hangar plugin list --json` reflects the version cached during
`plugin link`, not the active version. For linked clones, `update` re-links automatically to fix the
cache. You can force this with `hangar plugin link "$(pwd)"`. Hangar ≥0.8.0 re-reads the manifest from
disk on each invocation.

> **Note.** `scripts/issance-ctl.sh <verb>` remains supported. It operates as a bootstrap shim: it locates
> Bun, compiles `bin/issance` if the checkout lacks it, and passes along argv. A freshly linked clone
> uses this path to build its initial binary. Hangar actions continue to point to this script because
> Hangar <0.8.0 freezes the action definitions cached at install time
> ([ADR 0006](../.adr/0006-update-advances-the-checkout-herdr-installed.md)). Each verb is
> implemented once inside the compiled binary in `cli/`.


---

[← back to the README](../README.md)

# Terminals

These are the terminals issance reads [sessions](sessions.md) from: Hangar, tmux, zellij, tuios and
Tern. issance drives one terminal per install, and Hangar is the default. This page covers pointing
issance at any of them, what each one can answer, and the beacons issance uses to detect an agent in
a pane. A durable agent with no screen is not a terminal, and [Durable agents](durable-agents.md) covers it.

tmux and zellij call their own top-level group a session. issance shows it as a space.

## Pointing issance at a multiplexer

Name the backend in `ISSANCE_MUX`, point it at an endpoint, restart, and install the beacon hooks.

> **Experimental.** tmux and zellij (since 1.0) were tested on **tmux 3.6b** and **zellij 0.44.2**,
> on a single host. tuios (since 1.15.0) was tested on **tuios 0.8.4**. Tern was probed by its
> contributor on **tern 0.4.5**, a closed beta that the maintainers cannot run.
> Hangar is the default and the primary supported backend. **Testers wanted:** open an issue on
> [issance/issance-app](https://github.com/AltanS/collie/issues/new) titled `tmux: …`, `zellij: …`,
> `tuios: …` or `tern: …`, with your multiplexer, version, OS, and what you saw.

Name the multiplexer on the command line:

```bash
ISSANCE_MUX=hangar issance start
ISSANCE_MUX=tmux issance start
ISSANCE_MUX=zellij issance start
ISSANCE_MUX=tuios issance start
ISSANCE_MUX=tern issance start
```

Set the endpoint when the default target is not the one you want:

```bash
# in your .env: ~/.config/issance/.env, or Hangar's plugin config dir on a Hangar
# install. See Configure for the full precedence.
ISSANCE_MUX=tmux
ISSANCE_MUX_ENDPOINT_TMUX=/run/user/1000/issance-tmux.sock
ISSANCE_MUX_ENDPOINT_ZELLIJ=issance-zellij

# only if the binary sits somewhere unusual
# ISSANCE_TMUX_BIN=/usr/bin/tmux
# ISSANCE_ZELLIJ_BIN=/home/you/.local/bin/zellij
```

| variable | value | what it means |
| --- | --- | --- |
| `ISSANCE_MUX` | `hangar`, `tern`, `tmux`, `zellij` or `tuios` | which terminal this install drives |
| `ISSANCE_MUX_ENDPOINT_TMUX` | `/run/user/1000/issance-tmux.sock` | a socket PATH (`tmux -S`), because it has a `/` |
| `ISSANCE_MUX_ENDPOINT_TMUX` | `work` | a socket NAME (`tmux -L work`), no `/` |
| `ISSANCE_MUX_ENDPOINT_TMUX` | empty | tmux's own default server |
| `ISSANCE_MUX_ENDPOINT_ZELLIJ` | `issance-zellij` | a session NAME, not a path |
| `ISSANCE_MUX_ENDPOINT_ZELLIJ` | empty | the single running session |
| `ISSANCE_MUX_ENDPOINT_TUIOS` | `/run/user/1000/tuios/tuios.sock` | the tuios daemon's socket PATH |
| `ISSANCE_MUX_ENDPOINT_TUIOS` | empty | `$XDG_RUNTIME_DIR/tuios/tuios.sock`, else `/tmp/tuios-<uid>/tuios.sock` |
| `ISSANCE_MUX_ENDPOINT_TERN` | `/run/user/1000/tern/daemon.sock` | the Tern daemon's socket PATH |
| `ISSANCE_MUX_ENDPOINT_TERN` | empty | `$XDG_RUNTIME_DIR/tern/daemon.sock`, else `/tmp/tern-<uid>/daemon.sock` |
| `ISSANCE_TERN_BIN` | `/home/you/.local/opt/tern/tern` | only if tern sits somewhere unusual |
| `ISSANCE_TMUX_BIN` | `/usr/bin/tmux` | only if tmux sits somewhere unusual |
| `ISSANCE_ZELLIJ_BIN` | `/home/you/.local/bin/zellij` | only if zellij sits somewhere unusual |

Hangar has no endpoint variable here: its socket is `HERDR_SOCKET_PATH`, not a
`ISSANCE_MUX_ENDPOINT_` name.

That socket is the local one and no other. A machine saved in Hangar is not a crew member, and only
a issance crew brings another machine's panes to the phone. What each list is, and why one is not
the other, is in [Hangar machines and the crew](crew.md#herdr-machines-and-the-crew).

Then restart, install the beacon hooks, and start an agent where the phone can see it:

```bash
issance restart                 # after every .env edit
issance hooks install claude    # once per host; tmux, zellij and tern need it, Hangar gets hook edges

# open a window or a tab for the agent
tmux -S /run/user/1000/issance-tmux.sock new-window -n claude
zellij --session issance-zellij action new-tab --name claude

claude                         # in that window or tab
```

### What those commands did

`ISSANCE_MUX` on the command line sets the choice for that run and for every later run. `start`
writes the name to `.env`, so running `issance start` later drives the same multiplexer.

With `ISSANCE_MUX` unset, `start` probes for Hangar, tmux, and zellij, prompts for a backend, and
writes the answer to `.env`. For the full configuration reference, see
[`MUX_CONTRACT.md` → Pointing a issance at a multiplexer](../MUX_CONTRACT.md#pointing-a-issance-at-a-multiplexer).

`issance hooks install claude` installs issance [beacon](#agent-beacons-optional-linux) hooks, which
tmux, zellij and tern require. They expose panes as generic shells, so without hooks every pane appears as
`bash`.

The command updates `~/.claude/settings.json` and leaves project configs untouched
([details below](#issance-writes-hooks-into-claudes-own-settings)). Claude Code 2.1.301 reloads its
hooks while it runs. Restart an older Claude.

> **Note.** Hangar is not required in this mode. With `ISSANCE_MUX=tmux` or `ISSANCE_MUX=zellij`, the
> bridge loads only the selected adapter and ignores Hangar's socket. Discovery of several Hangar sessions across
> Hangar config roots is disabled (`bridge/index.ts`). You do not need Hangar installed or running,
> and `.env` lives in `~/.config/issance/` instead of the plugin configuration directory.

### tmux notes

`ISSANCE_TMUX_BIN` is usually left unset. issance checks a list of standard paths and does not read
`PATH`, which background services and Hangar actions do not share with login shells.

> **Note.** Keep socket paths short. Unix domain sockets longer than roughly 100 characters fail to
> connect, and tmux returns `error connecting to … (File name too long)`. Use `/run/user/<uid>/` or
> `/tmp` rather than a deep directory path.

On tmux versions before 3.7 with `window-size` set to `manual`, creating a window crashes the
server. issance blocks window creation in this state and tells you to run
`tmux set -g window-size latest`; [Requirements](install.md#requirements) lists the tested
versions.

With `automatic-rename` on, tmux renames a window after whatever program is running in it; issance
shows the last folder of that window's active pane instead, since a screenful of tabs named `bash`
says nothing. A window you named yourself keeps that name.

### zellij notes

If your distribution lacks zellij packages, download a binary from
[zellij's GitHub releases](https://github.com/zellij-org/zellij/releases) and place it in your
`PATH`.

Leaving the endpoint empty defaults to the single running session. If zero or multiple sessions
exist, issance halts with an error instead of selecting one. If a named session exits, issance reports
it by name instead of switching to an active one.

Zellij requires `XDG_RUNTIME_DIR` to locate sessions. If issance reports all sessions as exited,
verify that the systemd service includes this environment variable
([contract](../MUX_CONTRACT.md#pointing-a-issance-at-a-multiplexer)).

Zellij sessions persist independently of their initial terminal. Create a session with
`zellij -s issance-zellij` and detach using `Ctrl o` `d`. On headless hosts,
`zellij attach --create-background issance-zellij` starts a detached session directly (verified on
zellij 0.44.2).

> **Note.** issance manages active sessions, but it does not create or restart them.

Zellij 0.44 and later reports each pane's folder, so zellij panes get the Files button and show
their branch. An older zellij reports no folder, and its panes have neither.

### tern notes

Point issance at Tern:

```bash
ISSANCE_MUX=tern issance start
issance hooks install claude   # beacon hooks for agent detection
```

issance reads Tern sessions as spaces, tabs as tabs, and blocks as panes. The endpoint is the Tern daemon's socket, defaulting to `$XDG_RUNTIME_DIR/tern/daemon.sock` (or `/tmp/tern-<uid>/daemon.sock`). Inside a Tern pane, `$TERN_PANE` identifies the block and `$TERN_PANE_SOCKET` points at the daemon socket.

Tern reports lifecycle events via `tern events`, enabling immediate topology change notifications.

"Show in terminal" moves your Tern window to the pane's Tern session and tab and focuses its block. A tab or a Tern session that issance creates opens in the background and does not move your window.

issance does not detect Tern on its own, as it does not detect tuios: name it with `ISSANCE_MUX=tern`. Typed text longer than 128 KiB is refused, because it travels as one command-line argument.

### durable notes

A durable agent that you attach is not a terminal, and it has no screen. [Durable agents](durable-agents.md)
covers how to attach one with `issance durable attach`, the older form that drives a durable agent alone
with `ISSANCE_MUX=durable`, the two ways to reach a durable agent, what it can do on the phone, and what to
check when it shows as unreachable.

### tuios notes

tuios reports agents itself, so it needs no beacon hooks:

```bash
ISSANCE_MUX=tuios issance start
tuios integration install claude-code   # once, so tuios hears the agent's hooks
```

issance reads the agent, its state and its conversation from the tuios daemon. A pane that waits
for you shows as blocked, and a pane's history opens when the agent reported its conversation. An
agent that issance has no harness for shows as a shell.

issance shows each tuios session as a space, each workspace as a tab, and each window as a pane. A
workspace shows as a tab while it holds a pane. A pane that runs on another machine is not shown.
Point a issance on that machine at its own tuios.

The endpoint is the daemon's socket. Leave it empty to use the socket that `tuios` itself uses.
issance reads `XDG_RUNTIME_DIR` to find it, so make sure the service has that variable. Inside a
tuios pane, `echo $TUIOS_SOCKET` prints the path.

issance needs **tuios 0.8.3 or newer**: the daemon must announce the `workspace-renamed` event,
which 0.8.2 does not. With an older daemon, issance
shows the bridge as disconnected and the log says what to update.

Some things work differently on tuios:

- A new tab opens on the lowest empty workspace. A tuios session has nine workspaces by default, so
  issance refuses a tenth tab.
- Show in terminal moves every terminal that shows the pane's tuios session, a tuios-web tab included.
  tuios cannot move a terminal to another tuios session. If no terminal shows the pane's tuios session,
  issance refuses and names the tuios session the terminal shows.
- The **New worktree** switch on the New page stays, off, and says it needs Hangar.

### Did it work?

```bash
issance doctor   # the `mux` check names the multiplexer, its endpoint,
                # and whether it answered (durable: the six `durable-*` checks)

# `[bridge] mux: tmux · socket /run/user/1000/issance-tmux.sock`, printed at
# startup; a multiplexer it cannot reach is one warning line more
issance logs

# the herd, as the phone is given it; reads need the pairing token
curl -s -H "Authorization: Bearer $ISSANCE_TOKEN" http://127.0.0.1:8787/api/snapshot | head -c 400
```

Every read needs a paired device's token, so this `curl` call sends one. Without it, the bridge
answers `403 device not paired`. To get a token for a script, see
[Upgrading to 1.18.0](upgrading.md#upgrading-to-1180). `issance doctor` needs no token on the host.
`ISSANCE_DEVICE_HEADER` still gates only writes and the Files view
([Pair a device](security.md#pair-a-device--the-write-credential)).

Check the phone UI: the dashboard should display your **tmux windows** or **zellij tabs**, and the
Claude pane should identify as an agent instead of `bash`. If panes still display as standard
shells, verify the beacon hook installation below.

### issance writes hooks into Claude's own settings

```console
$ issance hooks install claude
$ issance hooks status
would install: /home/you/issance/bin/issance beacon emit  (this checkout)
/home/you/.claude/settings.json: installed (v1)
```

Because tmux, zellij and tern expose panes as generic shells, agents must announce themselves. This
requires installing issance [beacon](#agent-beacons-optional-linux) hooks into Claude Code's
configuration. On Hangar, the same hooks give [hook edges](#hook-edges) only.

The output references the `bin/issance` path from this repository. Package installs use the installed
binary path (`~/.local/bin/issance` or `~/.local/share/issance/current/bin/issance`) rather than
versioned directories, ensuring links remain valid across updates.

Behavior details for Claude configuration changes:

- Modifies the **global** `~/.claude/settings.json` and any active `CLAUDE_CONFIG_DIR`.
  Project-level `.claude/settings.json` files are untouched.
- Injects **five** hooks tagged `# issance-beacon v1` with 10-second timeouts. Existing hooks are
  preserved. `hooks uninstall claude` removes only issance entries.
- **Claude Code reloads its hooks while it runs.** This holds for 2.1.301. Restart an older Claude
  if no hook edges come.
- **Linux only.** The agent liveness check depends on `/proc`. Other operating systems do not emit
  beacons.
- **Beacons are multiplexer-specific.** They record pane and session identifiers for the active
  backend. Switching `ISSANCE_MUX` invalidates existing beacons. Old beacons remain on disk until
  cleared, visible under `issance doctor`'s `beacons` count.
- If using `ISSANCE_STATE_DIR`, export it in the agent's shell environment. `issance beacon emit`
  reads this variable directly; otherwise, beacons write to the default state directory where the
  bridge will not find them.

`issance doctor` includes a `beacon-hooks-claude` diagnostic check that points out missing hooks or
broken paths to moved checkouts. For runtime details, see
[Agent beacons](#agent-beacons-optional-linux).

### What changes compared with Hangar

The table below summarizes key differences. Refer to [`MUX_CONTRACT.md`](../MUX_CONTRACT.md) for the
exact specification.

| | Hangar | tmux | zellij |
| --- | --- | --- | --- |
| [a **space** is](../MUX_CONTRACT.md#what-a-space-and-a-tab-are-per-multiplexer) | a workspace | a session | the session, exactly one, so the phone drops the space strip |
| [a **tab** is](../MUX_CONTRACT.md#what-a-space-and-a-tab-are-per-multiplexer) | a tab | a window | a tab |
| [a **pane** is](../MUX_CONTRACT.md#what-a-space-and-a-tab-are-per-multiplexer) | a pane | a pane | a terminal pane |
| [who says a pane holds an agent](../MUX_CONTRACT.md#capabilities) | Hangar does, itself | a [beacon](#agent-beacons-optional-linux), or nothing | a [beacon](#agent-beacons-optional-linux), or nothing |
| [how soon an unannounced change is seen](../MUX_CONTRACT.md#the-declared-facts--not-capabilities-either) | pushed | pushed | counted on a schedule, 12 s ceiling |
| ["Show in terminal"](../MUX_CONTRACT.md#capabilities) | yes | yes | **no**, zellij accepts the request and moves nothing |
| [open / rename / close a tab](../MUX_CONTRACT.md#capabilities) | yes | yes (opening is refused on the tmux crash case above) | yes |
| [open a space](../MUX_CONTRACT.md#capabilities) | yes | yes | **no**, a session it made would be invisible to it |
| [pane history](../MUX_CONTRACT.md#capabilities) | from Hangar's own pane record | from the beacon's session key | from the beacon's session key |

Without active beacons, tmux, zellij and tern present panes as raw shells, and pane history is marked
unavailable rather than returning empty content.

### Two things that feel different on the phone

- **"synced Ns ago":** This indicator appears in the dashboard header to show data age. It is
  displayed **only when the backend relies on scheduled polling**, such as **zellij** (up to 12s
  polling interval). Hangar and tmux push state changes immediately, so the freshness badge is
  omitted.
- **"Show in terminal":** This pane action focuses the selected pane in your active host terminal.
  It is **disabled on zellij** because zellij's focus command accepts the instruction without
  changing view state.

> **Note.** The mobile interface never changes host terminal focus automatically. Only the explicit
> "Show in terminal" action updates the display. Navigating the dashboard or opening panes does not
> affect the active host cursor
> ([ADR 0031](../.adr/0031-freshness-is-a-declared-promise.md)).

### tmux tips, getting your windows back after a reboot

```bash
claude --resume      # reconnects the conversation, not the window
```

issance does not store multiplexer state. Restarting a tmux server destroys its windows, leaving the
dashboard empty. Standard tmux plugins restore the window layouts and working directories:
[tpm](https://github.com/tmux-plugins/tpm) for plugin management,
[tmux-resurrect](https://github.com/tmux-plugins/tmux-resurrect) for saving session trees, and
[tmux-continuum](https://github.com/tmux-plugins/tmux-continuum) for automated snapshots.

> **Note.** Running agent processes are not preserved. Restart Claude Code manually after recovery.

### zellij tips, after a reboot there is nothing to restore

```bash
zellij -s issance-zellij                                  # start the session
zellij attach --create-background issance-zellij          # headless: start it detached
claude --resume                                           # reconnects the agent
```

Zellij does not provide an equivalent to tmux-resurrect. Sessions persisted after terminal
detachment show as `(EXITED - attach to resurrect)`, and attaching triggers re-execution of session
commands, so a reboot means starting the session fresh with one of the commands above and launching
agents inside it, reconnecting each with `claude --resume` or `claude --continue`.

> **Note.** Because attaching produces side effects, issance does not attach to or resurrect
> sessions. Exited sessions appear as *unreachable*, and the UI displays a disconnection banner
> instead of an empty session list.


## Agent beacons (optional, Linux)

A **beacon** is how an agent identifies itself to issance, on tmux, zellij and tern, where a pane otherwise
appears as a generic shell.

```console
$ issance hooks install claude
$ issance hooks status
would install: /home/you/issance/bin/issance beacon emit  (this checkout)
/home/you/.claude/settings.json: installed (v1)
```

A hook in Claude Code settings runs `issance beacon emit`, which writes a file containing the harness
name, the session, and the target pane. Hangar tracks this natively. Setup details are in
[Pointing issance at a multiplexer](#issance-writes-hooks-into-claudes-own-settings); this section
explains the mechanism.

The path above references `bin/issance` from the local checkout. A binary install points to
`~/.local/bin/issance`, or to `~/.local/share/issance/current/bin/issance` when that name is not
linked, [as described above](#issance-writes-hooks-into-claudes-own-settings). The `status` command
performs no writes.

Running `hooks uninstall claude` removes only entries added by issance. It modifies your *global*
Claude configuration, not project-level files. This is Linux-only: the liveness check inspects
`/proc`, and issance writes no beacons on other operating systems.

Claude becomes visible immediately on startup. Because the hook triggers on `SessionStart`, an open
pane waiting for input displays as an idle agent instead of a shell.

Visibility ends when the process exits. issance verifies the emitting PID on each check, so once the
agent terminates, the pane immediately reports as a standard shell instead of lingering in an
unknown state.

issance does not delete the beacon file to do this: the file remains on disk, `issance doctor` reports
it under `beacons` as *expired*, and the next hook invocation overwrites it.

This allows the dashboard to label panes by agent name rather than `bash`. It lets **"needs you"
sort panes by blocked status**, and provides the state required for alerts. Pane history also relies
on the beacon to supply the session key used by the journal.

### Hook edges

The same hooks also write a **hook edge** for each event. A hook edge is a short note about one
pane. Examples are "a prompt went in", "the turn stopped" and "a permission dialog is up". issance
uses hook edges on every multiplexer, Hangar too. Hangar names its agents on its own. On Hangar the
hooks therefore write hook edges only, and no beacon.

A hook edge never decides on its own that a pane is free. After each edge, issance reads the screen
again about 0.7 seconds later. Only the screen can say that the input box is empty and no dialog is
up. An edge can say that a turn runs or that a dialog is up. issance then holds the pane as busy until
the closing edge comes. Three free screen reads over ten seconds also end the hold. A tool edge
from a subagent is not about the pane, so it never changes what issance reads there.

A send from the phone can show as **Confirmed**. That happens when a prompt edge carries the same
text soon after the send. The window is 30 seconds, or ten minutes for a send queued behind a turn.
The edge carries a salted hash of the prompt, never the text itself.

Claude Code and Codex take a message or a command during a turn. issance types it at once, and the
harness runs it after the turn. A harness that cannot take a send during its turn gets a held send
instead. So does a message that finds the input box not free, for example under a popup, or on a
screen that changes between issance two reads, or a probe character that failed and that one
Backspace took back out of a box issance read clean again. Such a message goes after five free polls over ten
seconds, or after a turn issance sees. A command there is still refused, and so is a send on a
screen you confirmed with Type here. A send on a pane with no profile is never held. issance keeps the text and shows a card that floats over the bottom of the terminal view: "Queued.
Sends when the turn ends." The card shows the text and a Cancel button. issance sends it after the turn ends, once the
pane reads free on two polls in a row, oldest first. Each later held send waits for the turn that
the send before it started. If no turn shows, it goes after five free polls over ten seconds. A held
command on pi, OMP or Codex sends Enter, and there Enter steers a turn. Such a command waits for a
turn issance sees, and so does any held command on an agent whose version issance could not read. A
later message on that pane waits behind the held ones. A held text lasts 30 minutes, a held command
10 minutes. After that the row says the message was not sent, and offers Resend. Some commands never
wait, and issance refuses them during a turn. On Claude Code these are `/clear`, `/exit`, `/quit`,
`/logout`, `/resume`, `/branch` and every `!` line. On Codex these are `/quit`, `/exit`, `/new`,
`/resume`, `/logout` and every `!` line. On Hermes these are `/exit`, `/quit`, `/clear`, `/new`,
`/resume` and every `!` line. A held send survives a restart of issance. Cancel works
until the send starts to go out, and only on this machine's own panes. With two or more held sends the
card shows a count and the first text, and Show all lists each send with its own Cancel. issance keeps the held text on
disk in plain form, in a file only your user can read (mode 0600). It deletes the text when the send
goes out, and at most one hour after the hold ends.

issance places each edge on one pane. The edge names the agent's process and its pane
(`HERDR_PANE_ID`, `TMUX_PANE` or `ZELLIJ_PANE_ID`). issance drops an edge that names no pane, two
panes, or a process that is gone. The bridge log then shows a `surface.edge.dropped` line. It shows at
most one line per reason and process each minute. An edge older than 30 seconds, or a file that is
not an edge, is counted but never logged.

#### Which bridges get the edges

Each bridge that takes hook edges lists itself in `~/.local/state/issance/hook-targets/` at boot.
With `XDG_STATE_HOME` set, the folder is `$XDG_STATE_HOME/issance/hook-targets/`. A bridge removes its
file when it stops cleanly. A running bridge writes its file again within two seconds when it goes
missing. The hook writes each edge into every listed bridge whose process still runs. It deletes the
file of a bridge that is gone. With no bridge listed, the hook writes into the
default state dir. A `ISSANCE_STATE_DIR` in the agent's own environment always gets the edges too.

#### The pane info

The pane info on the phone shows whether a pane sends hook edges:

- **Hooks: live** means the agent in that pane sends hook edges.
- **Hooks: live, holds permissions** means the agent's hooks also hold permissions for the phone.
  See [Permissions held for the phone](#permissions-held-for-the-phone).
- **Hooks: none** means issance has no hook edge from that pane. The hooks are not installed, or the
  agent has not sent an event since the install. Claude Code 2.1.301 picks up new hooks while it
  runs. Restart an older Claude.

A bridge keeps the live panes across its own restart. The row stays "live" after a bridge restart.

An installation from an earlier issance sends no edge for a permission dialog. `issance hooks
status` shows it as partial. Run `issance hooks install claude` again to update it in place.

#### Permissions held for the phone

```console
$ issance hooks install claude --hold-permissions
```

This adds one more hook, on Claude's `PermissionRequest`. When Claude asks for a permission, the
hook holds the request and waits for your tap. The phone shows the request as a card. A tap on
**Yes** or **No** goes back to Claude through the hook. issance sends no key to the pane for it.
The install needs Claude Code 2.0.45 or later, the first version with this hook. It refuses an
older one.

- **The hook finds each running bridge the way hook edges do.** It reads `hook-targets/` and
  holds with every live bridge. The first answer wins. The other phones then say "Another issance
  answered".
- **The desk still works.** Answer the dialog in the terminal, and the phone card says "The desk
  answered first". issance does not use a tap after that.
- **Only Yes and No go through the hook.** An option such as "don't ask again" stays a screen
  answer. issance refuses that tap on a held card.
- **A held request has a time limit of 290 seconds.** After it, the dialog stays on the screen
  and becomes an ordinary card with a new id. An old tap never turns into keys.
- **No bridge, no hold.** With no bridge listening, or on any error, the hook prints nothing.
  Claude then shows its own dialog as before. The hook never answers on its own.
- **The card shows the input shown.** That is the command, the file path or another key input.
  It adds the risky Bash flags, and the whole text a write puts in a file. issance drops characters
  that hide or turn text. The input shown has a limit of 1000 characters, the written text included.
  issance never holds a longer request: the card cannot show it all, so the dialog on the screen
  answers it. When the input has more lines than the box shows, the card says so.
- **A held request owns only the dialog that shows that very request.** The dialog's header must
  name the request's tool. It must say "from the ... agent" exactly when a subagent asks, and name
  the same type of subagent. Every line of the input must show on the dialog, in order. When two
  held requests fit one dialog, none owns it. Any other dialog keeps its own card on the phone. The
  request then waits on its hold card, and only a tap from that card answers it. The card does not
  take a tap in the first 400 ms after a new request shows. If you answer that other dialog with
  the keys and Claude then ends the hook, the hold card says that the keys answered it.
- **A subagent's request shows no dialog while the hook holds it.** This holds for Claude Code
  2.1.301. The hold card is then the only way to see it, so it shows the tool and the input shown.
- **A background request waits up to the hold limit, even with no phone watching.** Then issance
  lets the hook go, and Claude shows the dialog on the screen. Claude 2.1.301 does not deny it.
- **Questions and plans stay screen cards.** `AskUserQuestion` and `ExitPlanMode` are never held.

The socket is `<stateDir>/hold/sock`. Its folder is mode 0700 and the socket is mode 0600, so
another user cannot connect. Before it connects, the hook checks that the socket, its folder and the
state dir are yours. It also checks that nobody else can write to the two folders. The bridge
takes a request only from a process it places on a pane. It drops every other request with one
`surface.hold.dropped` line. The hook and the settings carry no token. Each card carries a hash of
the tool, the input shown and the labels. A tap with another hash lets the hook go with no answer.

The pane info says "holds permissions" when the settings Claude reads hold the hook. issance reads
the user settings, the two project settings files and the managed settings. `disableAllHooks` turns
the hold off, and so does `allowManagedHooksOnly` in the managed file.

Run `issance hooks install claude` without the flag to take the hold out again. `issance doctor`
says in how many settings files the hooks hold permissions.

> **Note.** Beacons and hook edges provide no control channel. They only change what issance
> *displays* and when it *reads* a pane. They cannot send text, inject keystrokes, rename panes,
> close sessions, or bypass access controls. The threat model and omitted fields are documented in
> [ADR 0024](../.adr/0024-a-beacon-is-a-hint-never-a-control-channel.md).
>
> The permission hold is the one control channel. A tap on the phone becomes Claude's answer to one
> permission. Four things guard it. The socket is yours alone (mode 0600 in a 0700 folder), and
> the hook checks this before it connects. The bridge answers only a process it places on a pane.
> The tap must carry the hash of the tool, the input shown and the labels the card showed. The
> answer is only ever a person's tap: issance never allows or denies on its own.

#### Codex

Codex has one outside hook, its `notify` command. issance can use it for a hook edge when a Codex turn
ends:

```console
$ issance hooks install codex
$ issance hooks status
/home/you/.codex/config.toml: installed
```

The install writes one line at the top of `$CODEX_HOME/config.toml` (`~/.codex/config.toml` when
`CODEX_HOME` is not set). The line goes after the comments at the top of the file:

```toml
notify = ["/home/you/.local/bin/issance", "beacon", "emit", "codex"]
```

Codex runs one notify command only. If your config already names one, issance leaves it in place and
the install stops with a message. If issance cannot read the file as TOML, the install stops and
names the line. issance keeps a copy of the file before its first change.
`issance hooks uninstall codex` puts back the exact bytes from before the install. If the install
created the file, uninstall removes it. A Codex that is already open may not see the new line until
it starts again.

Codex sends one event, `agent-turn-complete`, at the end of each turn. issance writes it as a stop
edge, and the screen read after it decides whether the pane is free. The limits:

- Codex sends no event for an approval dialog or for a new prompt. The screen alone shows a dialog,
  and a send from the phone never shows as Confirmed on a Codex pane.
- Codex 0.163.0 runs the notify command from a background helper (`codex app-server`). issance finds
  the Codex window in `/proc` with the same `CODEX_HOME` and the folder of the event. This is Linux
  only.
- Two Codex windows in one folder on one `CODEX_HOME` get no edge. issance cannot tell them apart.
  Their panes still update from the screen, as without the hook.
- Codex also runs a short hidden turn to name a new task. That turn sends one more stop edge, so
  the pane gets one more screen read.

issance presses Tab for a Codex message. During a turn, Codex queues it. In Codex, Tab sends a
message on an idle box and queues it during a turn. So Tab is right in both states. Enter steers a
running turn, so issance never presses Enter for a message. A text that starts with `/` or `!` is a command.
It takes Enter on an idle box, because Tab would complete a `/` command there. During a turn it
takes Tab, and Codex queues it like a message. Codex runs a `!` text as a shell command. The receipt
says queued only when Codex shows the queued row with the text.

issance answers a Codex approval with one key: the option's digit, `y`, or Escape. Only the trust
prompt of Codex 0.156 walks. There issance presses the arrow keys, reads the pointer back, then
presses Enter. A Codex question dialog also takes one key, the option's digit. In Codex 0.163.0 the
digit answers at once. On the last question it sends all the answers.

## Harness profiles

issance checks the input box of an agent before it sends a message from the phone.
A profile file describes that box for one agent. It says where the box starts and ends.
It says how a draft looks, which key sends, and which text the agent draws for a long paste.
A plain shell and an agent with no profile still take sends. issance cannot read their input box,
so it types the text and presses Enter without a check, one line at a time. Only a password prompt
on the last rows stops it: issance types nothing there, and the phone offers Type.

| Agent | Enter during a turn | Send key | Probe | Checked against |
| ----- | ------------------- | -------- | ----------------- | --------------- |
| OpenCode | Queues the message | Enter | Yes | 1.18.33 |
| pi | Steers the turn; Alt+Enter queues | Alt+Enter, Ctrl+Q on Windows | Short texts and sends into a turn | 1.1.0 |
| OMP | Steers the turn; Ctrl+Q queues | Ctrl+Q | Yes | 18.4.10 |
| Grok | Not measured | Enter | Yes | 1.0.41 |
| Antigravity (`agy`) | Not measured | Enter | Yes | Screens of 1.1.17 |
| Muse | Not measured | Enter | Yes | 1.4.7 |
| Hermes | Interrupts the turn by default; Hermes's `/busy` can make it queue or steer | Enter | Yes | 0.22.2 |
| Cursor CLI (`cursor-agent`) | Queues the message | Enter | Yes | 2026.10.16 |

A command, such as `/model`, always goes with Enter. A probed send types one extra character first.
issance checks that the character lands in the box, then removes it.

- **OpenCode** draws its box as a column of `┃` rows, closed by a `╹▀▀▀` line.
  issance finds the box by those rows.
  A message sent into a running turn waits in the transcript with a `QUEUED` badge.
  A newline goes in as Ctrl+J.
  issance refuses a message that is longer than the box can show, because it cannot read it back.

- **pi** draws its box between two rules with no prompt mark.
  issance finds it by the rule pair and by the status line that pi draws under it.
  A pi dialog opens between the same two rules.
  So issance reads the key hints and the list from the top rule down.
  In pi, Enter steers a running turn, but Alt+Enter sends on an idle box and queues in a turn.
  So issance sends with Alt+Enter, and with Ctrl+Q on Windows.
  pi shows a queued message as a `Follow-up:` row above the box.
  A box taller than 30 rows does not read as a box. The screen reads as unknown, and a send needs your tap.

- **OMP** lets you choose the border style of its box, so issance knows five of them.
  One is the open box with a status row on top. Others are a rule pair, a rule with no bottom rule,
  a pair with an empty middle, and a borderless box.
  issance cuts the hint that OMP draws at the right end of the prompt row.
  In OMP, Enter steers a running turn, but Ctrl+Q sends on an idle box and queues in a turn.
  So issance sends with Ctrl+Q.
  OMP lists a queued message in an `After yield` block above the box.
  OMP can show a dim completion after your text.
  A send that meets one stops before the send key and leaves the text in the box.

- **Grok** draws a rounded box with a `❯` prompt row and a row of key hints under it.
  A tall draft shows a scroll bar at the right edge of the box.
  Such a screen reads as unreadable, so a send needs your tap.
  A model list opens above the box and counts as part of the box.
  The pane never reads free while the list stands.

- **Antigravity** (`agy`) draws its box as a rule, a `>` row and a rule, with a `? for shortcuts` footer.
  The turn shows a spinner row with `...` above the box and `esc to cancel` under it.
  Hangar names this agent `agy` or `antigravity`. issance files both under `agy`.

- **Muse** draws its box as a rule that may carry a label, a `❯` row and a rule.
  An empty box shows a grey hint, and issance reads that hint as no text.
  A command palette that opens under the box shows as your draft.
  The list of background tasks under the box reads as unknown, and a send needs your tap.
  A running turn shows a row with a timer and `esc to interrupt`.

- **Hermes** (the classic CLI; `hermes --tui` is not read) draws its box as a rule, a `❯` row and a rule.
  Below 64 columns it draws no rule under the box. A named profile shows its name before the `❯`.
  A newline goes in as Alt+Enter: Ctrl+J sends the message when `display.cli_multiline_shortcuts` is off.
  The box shows at most eight rows. A longer message cannot be read back, so the send stops before Enter.
  Submit sends it, and the phone then cannot confirm it went.
  Hermes may show the rest of an earlier message in grey after your text.
  That send stops before Enter too, and Submit sends only what you typed.
  The model picker and the command palette open over the transcript, and the pane never reads free under one.

- **Hermes during a turn** starts its row with `☤`, and issance reads the turn from that mark.
  What Enter does then is Hermes's own setting, so issance never presses it during a turn.
  A send during a turn is held, and it goes when the turn ends.
  If a turn starts while issance types, the send stops before Enter and the text stays in the box.

- **Hermes's questions:** a question's typed answer opens a `✎` row, and a send from the phone answers it.
  A held message never goes into that row. It waits until the question closes, then goes as a message.
  While a held message waits, a new send joins it, so cancel the held one to answer from the phone.

- **Cursor CLI** (`cursor-agent`) draws its box as a `▄` rule, a `→` row and a `▀` rule.
  An empty box shows a grey hint, "Plan, search, build anything" or "Add a follow-up", and issance reads that hint as no text.
  `!` turns the box into a shell prompt with its own hint. issance reads that hint as text, so a message never goes into shell mode.
  A running turn shows a spinner row such as `Running` above the box and `ctrl+c to stop` at the right end of the `→` row. issance cuts that hint.
  Enter during a turn queues the message in a `follow-ups` box above the input box.
  The box shows at most six rows and scrolls a longer draft. issance cannot read a taller message back, so it leaves the typed text in the box and does not press Enter.
  Its dialogs (a command approval, a question, the folder trust prompt) replace the box, so the screen reads as unreadable.
  Live probed sends passed on 2026.10.14 and 2026.10.16.

Grok, Antigravity and Muse are not installed on the build host.
Their profiles rest on saved screens of each agent.
No live message has gone to them through a profile, so issance probes every send there.
Nobody measured what Enter does during a turn for them.
So issance refuses a send while the screen shows the turn running, and it types nothing.
Where a harness draws no running sign, issance cannot tell, and the agent decides what Enter does.
OpenCode and OMP passed live sends on a version above the checked one.
issance probes every send on them until a send passes inside the checked range.
Hermes passed live sends on 0.22.2, inside its range, on Hangar only.
The probe has not been tried in each Hermes dialog, so issance probes every send there too.

A version above the checked one still works, and the receipt says `provisional`.

---

[← back to the README](../README.md)

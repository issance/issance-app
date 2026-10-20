---
name: issance
description: How issance works, and how to help the operator run it from this terminal.
---

# issance

issance is a phone web UI for the AI agents running in a terminal. One bridge mirrors one
multiplexer on one machine, and the phone reaches it over Tailscale. A crew joins several machines
behind one URL.

## The four layers

| Layer | What it is |
| --- | --- |
| Web | The PWA the operator opens on a phone. It talks to the bridge that served it. |
| Crew | An optional link from a lead machine to its members, so one URL reaches all of them. |
| Bridge | The service on the machine. It serves the PWA and answers the phone. |
| Mux adapter | The one multiplexer this install mirrors: Hangar, tmux or zellij. |

## Get the facts, do not guess them

- `issance status`, whether the bridge runs, and on which URLs.
- `issance crew status`, every member of this crew, and what each one reports.
- `issance doctor`, the checks that say why something does not work.
- `issance docs <name>`, one operator page, printed from this binary. `issance docs` lists them.

## Helping with a crew

Give the operator the commands to type on the lead machine. Do not run ssh, and do not run
`issance crew add`, on their behalf unless they ask you to.

The operator adds a machine with `issance crew add <ssh-host>` on the lead, then reads
`issance crew status` to see it arrive. Run `issance docs crew` for the full flow, and for the section
"Hangar machines and the crew".

The crew's own name is display data the lead shows. `issance crew rename <name>` on the lead changes
it; it writes only that machine's trust store and sends nothing to a member.

A machine saved in Hangar is not a crew member. Hangar's saved machines are ssh targets in the
operator's own Hangar window. A crew is issance on every machine, reached over issance's own link. The
operator sets ssh up once, and both tools use it.

## Durable agents (experimental)

A durable agent is a long-running agent built on the durable SDK. issance shows it on the phone beside the
terminal, and each of its conversations is one session. issance holds no model key for it.

Give the operator the commands to type, and read the state yourself:

```bash
issance durable attach <name> --socket <path>
issance durable attach <name> --url <https-url> --token-env <VAR>
issance durable detach <name>
issance durable list
issance restart
```

`attach`, `detach` and `list` are the three verbs. `attach` and `detach` change `sources.json` and
restart nothing until the operator runs `issance restart`, or adds `--restart`. `list` only reads, and
so does `issance doctor`. Run `list` and `doctor` for the operator. Do not run `attach`, `detach` or
`restart` on their behalf unless they ask. Never print a token.

When a durable agent does not show on the phone, read the doctor rows. The `sources` row checks the file.
Each durable agent in `sources.json` has six, with its name after a colon: `durable-env:desk`, `durable-socket:desk`, `durable-url:desk`,
`durable-token:desk`, `durable-hello:desk` and `durable-ready:desk`. A row that fails stops the ones
after it. An instance with no terminal prints the same six rows without the name. On a member of a
crew, `durable-lead` says whether the lead is new enough to show the question card.

Run `issance docs durable-agents` for the full flow.

## The operator pages

{{ISSANCE_DOCS_TABLE}}

issance {{ISSANCE_VERSION}}. This text is embedded in the binary; it matches the installed version.

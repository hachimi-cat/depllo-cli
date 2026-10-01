# Changelog

## 0.3.0
- `depllo api webhook-endpoints create | list | get | update | delete | event-types` and `depllo api webhook-deliveries list | get | retry`: manage webhook endpoints and read or retry their deliveries.

## 0.2.0
- A route read by id next to its list is named `get` + the list's name: `depllo api projects get-pipelines` (was `depllo api projects pipelines-2`). Each old name still works, hidden from help.

## 0.1.3
- `depllo auth login` now signs in for real: the Huudis device flow (prints a code, opens the browser, saves the session to `~/.depllo/session.json` and refreshes it when it expires), or `--api-key <key>` (`-` reads stdin) to save an `sk_live_…` API key for machines and CI.
- `depllo auth whoami` shows the Huudis user or which key is in use; `depllo auth logout` deletes the saved credentials. All three take `--json`.
- `DEPLLO_TOKEN` still wins over the saved sign-in.

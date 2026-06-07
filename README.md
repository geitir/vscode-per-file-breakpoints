# Per-File Breakpoints

A small VS Code extension to enable, disable, or remove all breakpoints scoped to the **active editor file** — or to **every file except** the active one.

Useful when you have breakpoints scattered across many files and want to silence (or isolate) just the one you're working in, without losing the others.

## Features

- **Status bar counter** — shows enabled/disabled breakpoint counts for the active file. Click it to open the action menu.
- **Editor title button** — when the active file has breakpoints, a toolbar button offers quick Toggle / Disable-except / Remove actions.
- **Preserves breakpoint settings** — enabling/disabling keeps each breakpoint's condition, hit count, and log message intact.

## Commands

Open the Command Palette (`Ctrl`/`Cmd` + `Shift` + `P`) and run:

| Command                                    | Scope           |
| ------------------------------------------ | --------------- |
| Toggle All Breakpoints on Active File      | Active file     |
| Enable All Breakpoints on Active File      | Active file     |
| Disable All Breakpoints on Active File     | Active file     |
| Remove All Breakpoints on Active File      | Active file     |
| Enable All Breakpoints Except Active File  | All other files |
| Disable All Breakpoints Except Active File | All other files |
| Remove All Breakpoints Except Active File  | All other files |

## Requirements

VS Code `1.75.0` or newer.

## License

[MIT](./LICENSE)

<a href="https://buymeacoffee.com/geitir">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" width="210">
</a>

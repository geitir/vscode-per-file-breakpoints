# Per-File Breakpoints

Enable, disable, or remove breakpoints scoped to the **active editor file** — or to **every file except** the active one.

## Status bar

A dedicated status bar shows enabled/disabled breakpoint counts for the active file as well as extension action results. Click it to open the action menu.

## Editor title button

When the active file has breakpoints, a **Per-File Breakpoints** button appears in the editor toolbar with quick actions: Toggle, Disable Except Active File, Remove.

## Commands

Open the Command Palette (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>) and run:

**Active file**

- `Toggle All Breakpoints on Active File`
- `Enable All Breakpoints on Active File`
- `Disable All Breakpoints on Active File`
- `Remove All Breakpoints on Active File`

**All other files**

- `Enable All Breakpoints Except Active File`
- `Disable All Breakpoints Except Active File`
- `Remove All Breakpoints Except Active File`

Enabling/disabling preserves each breakpoint's condition, hit count, and log message.

---

<a href="https://buymeacoffee.com/geitir">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" width="210">
</a>

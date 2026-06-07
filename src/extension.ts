import {
  window,
  debug,
  SourceBreakpoint,
  Uri,
  commands,
  Breakpoint,
  ExtensionContext,
  ExtensionMode,
  StatusBarAlignment,
  StatusBarItem,
  Disposable,
  QuickPickItem,
} from "vscode";
import { Utils } from "vscode-uri";

const WELCOME_VERSION = 1;

const WELCOME_SHOWN_KEY = "perFileBreakpoints.welcomeShown";

const STATUS_BAR_ID = "perFileBreakpoints.statusBar";

const DEFAULT_TIMOUT = 5000;

enum ContextKey {
  HasBreakPoints = "perFileBreakpoints.hasBreakpoints",
  DevMode = "perFileBreakpoints.devMode",
}

enum Command {
  Menu = "perFileBreakpoints.showMenu",
  Disable = "perFileBreakpoints.disable",
  Enable = "perFileBreakpoints.enable",
  Remove = "perFileBreakpoints.remove",
  Toggle = "perFileBreakpoints.toggle",
  DisableExceptActiveFile = "perFileBreakpoints.disableExceptActiveFile",
  EnableExceptActiveFile = "perFileBreakpoints.enableExceptActiveFile",
  RemoveExceptActiveFile = "perFileBreakpoints.removeExceptActiveFile",
  ResetWelcome = "perFileBreakpoints.resetWelcome",
}

enum BreakpointAction {
  Enable,
  Disable,
  Remove,
  Toggle,
  DisableExceptActiveFile,
  EnableExceptActiveFile,
  RemoveExceptActiveFile,
}

const BREAKPOINT_ACTION_COMMANDS: Partial<Record<Command, BreakpointAction>> = {
  [Command.Disable]: BreakpointAction.Disable,
  [Command.Enable]: BreakpointAction.Enable,
  [Command.Remove]: BreakpointAction.Remove,
  [Command.Toggle]: BreakpointAction.Toggle,
  [Command.DisableExceptActiveFile]: BreakpointAction.DisableExceptActiveFile,
  [Command.EnableExceptActiveFile]: BreakpointAction.EnableExceptActiveFile,
  [Command.RemoveExceptActiveFile]: BreakpointAction.RemoveExceptActiveFile,
};

const BREAKPOINT_ACTION_LABELS: Record<BreakpointAction, string> = {
  [BreakpointAction.Toggle]:
    "$(activate-breakpoints) Toggle All Breakpoints on Active File",
  [BreakpointAction.Enable]:
    "$(debug-breakpoint) Enable All Breakpoints on Active File",
  [BreakpointAction.Disable]:
    "$(debug-breakpoint-unverified) Disable All Breakpoints on Active File",
  [BreakpointAction.Remove]: "$(trash) Remove All Breakpoints on Active File",
  [BreakpointAction.EnableExceptActiveFile]:
    "$(files)$(debug-breakpoint) Enable All Breakpoints Except Active File",
  [BreakpointAction.DisableExceptActiveFile]:
    "$(files)$(debug-breakpoint-unverified) Disable All Breakpoints Except Active File",
  [BreakpointAction.RemoveExceptActiveFile]:
    "$(files)$(trash) Remove All Breakpoints Except Active File",
};

class PerFileBreakPoints {
  statusBar: StatusBarItem;
  statusBarTimeoutId: ReturnType<typeof setTimeout> | undefined;
  disposables: Disposable[] = [];
  updating = false;

  constructor() {
    this.statusBar = window.createStatusBarItem(
      STATUS_BAR_ID,
      StatusBarAlignment.Right,
    );
    this.disposables.push(this.statusBar);

    this.statusBar.name = "Per-File Breakpoints";
    this.statusBar.command = Command.Menu;
    this.setStatusBarDefault();
    this.statusBar.show();

    window.onDidChangeActiveTextEditor(
      () => this.setStatusBarDefault(),
      this,
      this.disposables,
    );
    debug.onDidChangeBreakpoints(
      () => this.setStatusBarDefault(),
      this,
      this.disposables,
    );
  }

  dispose() {
    for (const item of this.disposables) {
      item.dispose();
    }
  }

  setStatusBarDefault() {
    if (this.updating) {
      return;
    }
    const editor = window.activeTextEditor;
    if (editor == null) {
      this.setStatusBar({ text: "...", tooltip: "No active editor." });
      return;
    }
    const activeUrl = editor.document.uri.toString();

    let enabled = 0;
    let disabled = 0;
    for (const bp of debug.breakpoints) {
      if (
        !(bp instanceof SourceBreakpoint) ||
        bp.location.uri.toString() !== activeUrl
      ) {
        continue;
      }
      if (bp.enabled) {
        enabled++;
      } else {
        disabled++;
      }
    }
    commands.executeCommand(
      "setContext",
      ContextKey.HasBreakPoints,
      enabled + disabled > 0,
    );
    this.setStatusBar({
      text: `$(debug-breakpoint)${enabled}$(debug-breakpoint-unverified)${disabled}`,
      tooltip: `${enabled + disabled} breakpoint${enabled + disabled === 1 ? "" : "s"} (${enabled} enabled and ${disabled} disabled).`,
    });
  }

  setStatusBar({
    text,
    tooltip,
    timeout,
  }: {
    text: string;
    tooltip?: string;
    timeout?: number;
  }) {
    if (this.statusBarTimeoutId) {
      clearTimeout(this.statusBarTimeoutId);
    }
    const existing = {
      text: this.statusBar.text,
      tooltip: this.statusBar.tooltip,
    };
    this.statusBar.text = text;
    if (tooltip != null) {
      this.statusBar.tooltip = tooltip;
    }
    if (!timeout) {
      return;
    }
    this.statusBarTimeoutId = setTimeout(() => {
      this.statusBar.text = existing.text;
      this.statusBar.tooltip = existing.tooltip;
    }, timeout);
  }

  async showMenu(actions: BreakpointAction[], fileUri?: Uri): Promise<void> {
    const items: Array<QuickPickItem & { action: BreakpointAction }> =
      actions.map((action) => ({
        label: BREAKPOINT_ACTION_LABELS[action],
        action,
      }));

    let fileName = "";
    const uri = fileUri ?? window.activeTextEditor?.document?.uri;
    if (uri) {
      fileName = `(${Utils.basename(uri)})`;
    }

    const pick = await window.showQuickPick(items, {
      title: "Per-File Breakpoints",
      placeHolder: `Choose an action for the active file's ${fileName} breakpoints`,
    });

    if (pick) {
      this.executeBreakpointAction(pick.action, fileUri);
    }
  }

  executeBreakpointAction(action: BreakpointAction, fileUri?: Uri): void {
    const editor = window.activeTextEditor;

    if (!editor) {
      window.showInformationMessage(
        "No active editor - open a file to update its breakpoints",
      );
      return;
    }

    const activeUri = editor.document.uri.toString();
    if (fileUri && fileUri.toString() != activeUri) {
      return;
    }

    const isExceptFileAction =
      action == BreakpointAction.DisableExceptActiveFile ||
      action == BreakpointAction.EnableExceptActiveFile ||
      action == BreakpointAction.RemoveExceptActiveFile;

    const breakpoints: SourceBreakpoint[] = [];
    const otherUri = new Set<string>();
    for (const bp of debug.breakpoints) {
      if (!(bp instanceof SourceBreakpoint)) {
        continue;
      }
      const bpUri = bp.location.uri.toString();
      if (isExceptFileAction) {
        if (bpUri !== activeUri) {
          otherUri.add(bpUri);
          breakpoints.push(bp);
        }
      } else if (bpUri === activeUri) {
        breakpoints.push(bp);
      }
    }
    if (!breakpoints.length) {
      if (isExceptFileAction) {
        this.setStatusBar({
          text: `$(files)0$(blank) `,
          tooltip: `No breakpoints on other files.`,
          timeout: DEFAULT_TIMOUT,
        });
      }
      return;
    }

    if (action === BreakpointAction.Toggle) {
      action = breakpoints.some((bp) => bp.enabled)
        ? BreakpointAction.Disable
        : BreakpointAction.Enable;
    }

    if (
      action == BreakpointAction.Remove ||
      action == BreakpointAction.RemoveExceptActiveFile
    ) {
      this.updating = true;
      try {
        debug.removeBreakpoints(breakpoints);
      } finally {
        this.updating = false;
      }
      switch (action) {
        case BreakpointAction.Remove:
          commands.executeCommand(
            "setContext",
            ContextKey.HasBreakPoints,
            false,
          );
          this.setStatusBar({
            text: `$(debug-breakpoint)0$(debug-breakpoint-unverified)0`,
            tooltip: `0 breakpoints (0 enabled and 0 disabled).`,
          });
          break;
        case BreakpointAction.RemoveExceptActiveFile:
          this.setStatusBar({
            text: `$(files)${otherUri.size}$(trash)${breakpoints.length}`,
            tooltip:
              `Removed ${breakpoints.length} breakpoint${breakpoints.length === 1 ? "" : "s"} ` +
              `from ${otherUri.size} file${otherUri.size == 1 ? "" : "s"}.`,
            timeout: DEFAULT_TIMOUT,
          });
      }
      return;
    }

    const enable =
      action === BreakpointAction.Enable ||
      action === BreakpointAction.EnableExceptActiveFile;
    const targets = breakpoints.filter((bp) => bp.enabled != enable);
    if (targets.length) {
      const replacements: Breakpoint[] = targets.map(
        (bp) =>
          new SourceBreakpoint(
            bp.location,
            enable,
            bp.condition,
            bp.hitCondition,
            bp.logMessage,
          ),
      );

      this.updating = true;
      try {
        debug.removeBreakpoints(targets);
        debug.addBreakpoints(replacements);
      } finally {
        this.updating = false;
      }
    }
    if (isExceptFileAction) {
      const icon =
        action == BreakpointAction.EnableExceptActiveFile
          ? "$(debug-breakpoint)"
          : "$(debug-breakpoint-unverified)";
      const actionText =
        action == BreakpointAction.EnableExceptActiveFile
          ? "Enabled"
          : "Disabled";
      this.setStatusBar({
        text: `$(files)${otherUri.size}${icon}${breakpoints.length}`,
        tooltip:
          `${actionText} ${breakpoints.length} breakpoint${breakpoints.length === 1 ? "" : "s"} ` +
          `from ${otherUri.size} file${otherUri.size == 1 ? "" : "s"}.`,
        timeout: DEFAULT_TIMOUT,
      });
      return;
    }
    this.setStatusBar({
      text: `$(debug-breakpoint)${enable ? breakpoints.length : 0}$(debug-breakpoint-unverified)${enable ? 0 : breakpoints.length}`,
      tooltip: `${breakpoints.length} breakpoint${breakpoints.length === 1 ? "" : "s"} (${enable ? breakpoints.length : 0} enabled and ${enable ? 0 : breakpoints.length} disabled).`,
    });
  }
}

function showWelcome(context: ExtensionContext): void {
  const welcomeUri = Uri.joinPath(context.extensionUri, "WELCOME.md");
  commands.executeCommand("markdown.showPreview", welcomeUri);
}

export function activate(context: ExtensionContext): void {
  if (context.globalState.get(WELCOME_SHOWN_KEY) != WELCOME_VERSION) {
    showWelcome(context);
    context.globalState.update(WELCOME_SHOWN_KEY, WELCOME_VERSION);
  }

  const extension = new PerFileBreakPoints();

  context.subscriptions.push(
    ...Object.entries(BREAKPOINT_ACTION_COMMANDS).map(([command, action]) =>
      commands.registerCommand(command, () =>
        extension.executeBreakpointAction(action),
      ),
    ),
    commands.registerCommand(Command.Menu, () =>
      extension.showMenu([
        BreakpointAction.Toggle,
        BreakpointAction.Enable,
        BreakpointAction.Disable,
        BreakpointAction.Remove,
        BreakpointAction.DisableExceptActiveFile,
        BreakpointAction.EnableExceptActiveFile,
        BreakpointAction.RemoveExceptActiveFile,
      ]),
    ),
    extension,
  );

  if (context.extensionMode === ExtensionMode.Development) {
    commands.executeCommand("setContext", ContextKey.DevMode, true);
    context.subscriptions.push(
      commands.registerCommand(Command.ResetWelcome, async () => {
        await context.globalState.update(WELCOME_SHOWN_KEY, undefined);
        showWelcome(context);
      }),
    );
  }
}

export function deactivate(): void {}

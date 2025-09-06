import * as vscode from "vscode";
import {
  LanguageClient,
  Executable,
  ServerOptions,
  LanguageClientOptions,
  RevealOutputChannelOn,
  State,
} from "vscode-languageclient/node";

function getConfig<T>(option: string, defaultValue?: any): T {
  const config = vscode.workspace.getConfiguration("epmlsp");
  return config.get<T>(option, defaultValue);
}

class FileStatus {
  private statuses = new Map<string, any>();
  private readonly statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    10
  );
  onFileUpdated(fileStatus: any) {
    const filePath = vscode.Uri.parse(fileStatus.uri);
    this.statuses.set(filePath.fsPath, fileStatus);
    this.updateStatus();
  }
  updateStatus() {
    const active = vscode.window.activeTextEditor;
    if (!active) {
      this.statusBarItem.hide();
      return;
    }
    const path = active.document.fileName;
    const status = this.statuses.get(path);
    if (!status) {
      this.statusBarItem.hide();
      return;
    }
    this.statusBarItem.text = `epmlsp: ${status.state}`;
    this.statusBarItem.show();
  }
  clear() {
    this.statuses.clear();
    this.statusBarItem.hide();
  }
  dispose() {
    this.statusBarItem.dispose();
  }
}

class EpmlspLanguageClient extends LanguageClient {}

export function activate(context: vscode.ExtensionContext) {
  const epmlsp: Executable = {
    command: getConfig<string>("path"),
    args: getConfig<string[]>("arguments"),
  };
  if (
    epmlsp.command.endsWith(".bat") &&
    process.platform === "win32"
  ) {
    epmlsp.options = { shell: true };
  }
  const serverOptions: ServerOptions = epmlsp;
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "epm" },
      { scheme: "svfunc", language: "epm" },
      { scheme: "ec", language: "epm" },
    ],
    initializationOptions: { epmlspFileStatus: true },
    revealOutputChannelOn: RevealOutputChannelOn.Never,
  };
  const epmlspClient = new EpmlspLanguageClient(
    "epmlsp",
    "EPM Language Server",
    serverOptions,
    clientOptions
  );
  console.log("EPM Language Server active");
  epmlspClient
    .start()
    .catch((err) =>
      vscode.window.showErrorMessage(`epmlsp start failed: ${err}`)
    );
  const status = new FileStatus();
  context.subscriptions.push(status);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => status.updateStatus())
  );
  epmlspClient.onDidChangeState((event) => {
    const newState = event.newState;
    if (newState === State.Running) {
      epmlspClient.onNotification(
        "textDocument/epmlsp.fileStatus",
        (fileStatus: any) => {
          status.onFileUpdated(fileStatus);
        }
      );
    } else if (newState === State.Stopped) {
      status.clear();
    }
  });
  context.subscriptions.push(
    vscode.commands.registerCommand("epmlsp-vscode.activate", async () => {})
  );
}

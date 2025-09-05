import * as vscode from "vscode";
import * as vscodelc from "vscode-languageclient";

// Derived from vscode-clangd:
// https://github.com/llvm-mirror/clang-tools-extra/tree/master/clangd/clients/clangd-vscode

/**
 * Method to get workspace configuration option
 * @param option name of the option (e.g. for epmlsp.path should be path)
 * @param defaultValue default value to return if option is not set
 */
function getConfig<T>(option: string, defaultValue?: any): T {
  const config = vscode.workspace.getConfiguration("epmlsp");
  return config.get<T>(option, defaultValue);
}

// namespace FetchFunctionRequest {
//   export const type = new vscodelc.RequestType<
//     vscodelc.TextDocumentIdentifier,
//     string | undefined,
//     void,
//     void
//   >("$epmlsp/functionDefn");
// }

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
    const path = vscode.window.activeTextEditor.document.fileName;
    const status = this.statuses.get(path);
    if (!status) {
      this.statusBarItem.hide();
      return;
    }
    this.statusBarItem.text = `epmlsp: ` + status.state;
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

class EpmlspLanguageClient extends vscodelc.LanguageClient {
  // Override the default implementation for failed requests. The default
  // behavior is just to log failures in the output panel, however output panel
  // is designed for extension debugging purpose, normal users will not open it,
  // thus when the failure occurs, normal users doesn't know that.
  //
  // For user-interactive operations (e.g. applyFixIt, applyTweaks), we will
  // prompt up the failure to users.
  logFailedRequest(rpcReply: vscodelc.RPCMessageType, error: any) {
    if (
      error instanceof vscodelc.ResponseError &&
      rpcReply.method === "workspace/executeCommand"
    )
      vscode.window.showErrorMessage(error.message);
    // Call default implementation.
    super.logFailedRequest(rpcReply, error);
  }
}

/**
 *  this method is called when your extension is activate
 *  your extension is activated the very first time the command is executed
 */
export function activate(context: vscode.ExtensionContext) {
  //   const myScheme = "ec";
  //   const myProvider = new (class implements vscode.TextDocumentContentProvider {
  //     // emitter and its event
  //     onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  //     onDidChange = this.onDidChangeEmitter.event;

  //     async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
  //       const docIdentifier = vscodelc.TextDocumentIdentifier.create(
  //         uri.toString()
  //       );
  //       const doc = await epmlspClient.sendRequest(
  //         FetchFunctionRequest.type,
  //         docIdentifier
  //       );
  //       return <string>doc;
  //     }
  //   })();
  //   context.subscriptions.push(
  //     vscode.workspace.registerTextDocumentContentProvider(myScheme, myProvider)
  //   );

  let epmlsp: vscodelc.Executable = {
    command: getConfig<string>("path"),
    args: getConfig<string[]>("arguments"),
  };
  if (epmlsp.args.includes(".bat") && process.platform === "win32") {
    epmlsp.options = { shell: true };
  }
  const serverOptions: vscodelc.ServerOptions = epmlsp;

  const clientOptions: vscodelc.LanguageClientOptions = {
    // Register the server for epm files
    documentSelector: [
      { scheme: "file", language: "epm" },
      { scheme: "svfunc", language: "epm" },
      { scheme: "ec", language: "epm" },
    ],
    initializationOptions: { epmlspFileStatus: true },
    // Do not switch to output window when epmlsp returns output
    revealOutputChannelOn: vscodelc.RevealOutputChannelOn.Never,
  };

  const epmlspClient = new EpmlspLanguageClient(
    "EPM Language Server",
    serverOptions,
    clientOptions
  );
  console.log("EPM Language Server active");
  context.subscriptions.push(epmlspClient.start());
  const status = new FileStatus();
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      status.updateStatus();
    })
  );
  epmlspClient.onDidChangeState(({ newState }) => {
    if (newState == vscodelc.State.Running) {
      // epmlsp starts or restarts after crash.
      epmlspClient.onNotification(
        "textDocument/epmlsp.fileStatus",
        (fileStatus) => {
          status.onFileUpdated(fileStatus);
        }
      );
    } else if (newState == vscodelc.State.Stopped) {
      // Clear all cached statuses when epmlsp crashes.
      status.clear();
    }
  });
  // An empty place holder for the activate command, otherwise we'll get an
  // "command is not registered" error.
  context.subscriptions.push(
    vscode.commands.registerCommand("epmlsp-vscode.activate", async () => {})
  );
}

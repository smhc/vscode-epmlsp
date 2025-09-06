# vscode-epmlsp

Provides access to the epmlsp LSP for the EPM language

## Building

This extension now uses esbuild to bundle the TypeScript sources.

Development (watch rebuild):

```
npm run compile
```

One-off build (unminified):

```
npm run esbuild-base
```

Production (used for `vsce publish` via `vscode:prepublish`):

```
npm run esbuild-min
```

Output bundle is written to `dist/extension.js` and referenced as the `main` entry in `package.json`.

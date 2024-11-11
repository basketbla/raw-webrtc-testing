import * as monaco from "monaco-editor";

// Configure Monaco environment for web workers
self.MonacoEnvironment = {
  getWorker: function (_workerId: string, label: string) {
    const getWorkerModule = (moduleUrl: string, label: string) => {
      return new Worker(
        (self.MonacoEnvironment as any).getWorkerUrl(moduleUrl),
        {
          name: label,
          type: "module",
        }
      );
    };

    switch (label) {
      case "json":
        return getWorkerModule(
          "/monaco-editor/esm/vs/language/json/json.worker?worker",
          label
        );
      case "css":
      case "scss":
      case "less":
        return getWorkerModule(
          "/monaco-editor/esm/vs/language/css/css.worker?worker",
          label
        );
      case "html":
      case "handlebars":
      case "razor":
        return getWorkerModule(
          "/monaco-editor/esm/vs/language/html/html.worker?worker",
          label
        );
      case "typescript":
      case "javascript":
        return getWorkerModule(
          "/monaco-editor/esm/vs/language/typescript/ts.worker?worker",
          label
        );
      default:
        return getWorkerModule(
          "/monaco-editor/esm/vs/editor/editor.worker?worker",
          label
        );
    }
  },
};

export function initializeMonacoEditor() {
  const containerId = "editor";
  const initialValue = "function hello() {\n\talert('Hello world!');\n}";
  const language = "javascript";
  const container = document.getElementById(containerId) as HTMLElement;
  if (container) {
    monaco.editor.create(container, {
      value: initialValue,
      language: language,
      theme: "vs-dark",
    });
  } else {
    console.error(`Container with ID "${containerId}" not found.`);
  }
}

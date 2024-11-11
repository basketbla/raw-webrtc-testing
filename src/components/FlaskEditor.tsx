import Editor from "@monaco-editor/react";
import { PyodideInterface } from "pyodide";
import React, { useState } from "react";
import { Button } from "./ui/button";

type FlaskEditorProps = {
  pyodide: PyodideInterface | null;
};

const FlaskEditor: React.FC<FlaskEditorProps> = ({ pyodide }) => {
  const [code, setCode] = useState(`# Flask Code
@route('/')
def home():
    return "Hello, World!"

@route('/greet')
def greet():
    return "Hello from the greet route!"`);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) setCode(value);
  };

  const runCode = () => {
    if (!pyodide) {
      console.error("Pyodide is not loaded yet.");
      return;
    }

    try {
      pyodide.runPython(`
routes = {}
def route(path):
    def decorator(func):
        routes[path] = func
        return func
    return decorator
${code}
def handle_request(path, method="GET", data=None):
    handler = routes.get(path)
    if handler:
        return handler()
    else:
        return "404 Not Found"
      `);
      console.log("Code executed successfully in Pyodide.");
    } catch (error) {
      console.error("Error executing code in Pyodide:", error);
    }
  };

  return (
    <div>
      <Editor
        height="300px"
        language="python"
        value={code}
        onChange={handleEditorChange}
        theme="vs-dark"
      />
      <Button onClick={runCode} style={{ marginTop: "10px" }}>
        Run Python
      </Button>
    </div>
  );
};

export default FlaskEditor;

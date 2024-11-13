import Editor from "@monaco-editor/react";
import { PyodideInterface } from "pyodide";
import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";

type FlaskEditorProps = {
  pyodide: PyodideInterface | null;
};

const FlaskEditor: React.FC<FlaskEditorProps> = ({ pyodide }) => {
  const [code, setCode] = useState(`# Flask Code
from flask import request, jsonify
    
@app.route("/", methods=["GET"])
def hello_world():
    return "Hello World!"

# posts don't work right now because the flask stuff relies on actual http...
# TODO: figure out how to handle that
@app.route('/dog', methods=['POST'])
def post_dog():
    data = request.get_json()
    dog_name = data.get('dog', 'unknown')  # Get 'dog' from JSON, default to 'unknown' if missing
    
    response = {
        'message': f"Nice {dog_name}!"
    }
    return jsonify(response), 200
`);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) setCode(value);
  };

  const runCode = () => {
    if (!pyodide) {
      console.error("Pyodide is not loaded yet.");
      return;
    }

    try {
      // Emulating Flask routing and request handling in Pyodide
      pyodide.runPython(`
from flask import Flask, request, jsonify
routes = {}

class FlaskEmulator:
    def route(self, path, methods=["GET"]):
        def decorator(func):
            routes[path] = {"func": func, "methods": methods}
            return func
        return decorator

app = FlaskEmulator()

${code}

def handle_request(path, method="GET", data=None):
    route = routes.get(path)
    if route and method in route["methods"]:
        func = route["func"]
        # Setting up basic emulation of Flask request object with data
        request_data = data or {}
        response = func(**request_data)
        return response
    else:
        return "404 Not Found"
      `);
      console.log("Code executed successfully in Pyodide.");
    } catch (error) {
      console.error("Error executing code in Pyodide:", error);
    }
  };

  // Run code once when pyodide loads
  useEffect(() => {
    if (pyodide) {
      runCode();
    }
  }, [pyodide]);

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

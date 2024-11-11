import Editor from "@monaco-editor/react";
import React from "react";

type FlaskEditorProps = {
  code: string;
  setCode: React.Dispatch<React.SetStateAction<string>>;
};

const FlaskEditor: React.FC<FlaskEditorProps> = ({ code, setCode }) => {
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) setCode(value);
  };

  return (
    <div style={{ border: "1px solid #ccc", marginBottom: "20px" }}>
      <Editor
        height="300px"
        language="python"
        value={code}
        onChange={handleEditorChange}
        theme="vs-dark"
      />
    </div>
  );
};

export default FlaskEditor;

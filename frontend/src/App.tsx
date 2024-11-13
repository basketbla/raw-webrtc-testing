// App.tsx
import ClientComponent from "@/components/ClientComponent";
import ServerComponent from "@/components/ServerComponent";
import { PyodideInterface } from "pyodide";
import React, { useEffect, useState } from "react";
import { Button } from "./components/ui/button";
import { initializePyodide } from "./lib/webrtcHttp";

const App: React.FC = () => {
  const [isServer, setIsServer] = useState<boolean | null>(null);
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);

  useEffect(() => {
    const initializePyodideInstance = async () => {
      const pyodideInstance = await initializePyodide();
      setPyodide(pyodideInstance ?? null);
      console.log("Pyodide initialized.");
    };
    initializePyodideInstance();
  }, []);

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold">Flask over WebRTC</h1>
      {pyodide != null ? (
        <div className="flex flex-row gap-3 my-4 mb-2">
          <Button onClick={() => setIsServer(true)}>Start Server</Button>
          <Button onClick={() => setIsServer(false)}>Start Client</Button>
        </div>
      ) : (
        <div>Loading Pyodide...</div>
      )}
      {isServer ? (
        <ServerComponent pyodide={pyodide} />
      ) : isServer === false ? (
        <ClientComponent />
      ) : null}
    </div>
  );
};

export default App;

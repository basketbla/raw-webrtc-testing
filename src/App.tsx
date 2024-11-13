// App.tsx
import ClientComponent from "@/components/ClientComponent";
import ServerComponent from "@/components/ServerComponent";
import { PyodideInterface } from "pyodide";
import React, { useEffect, useState } from "react";
import Messages from "./components/Messages";
import { Button } from "./components/ui/button";
import { initializePyodide } from "./lib/webrtcHttp";

const App: React.FC = () => {
  const [isServer, setIsServer] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);

  useEffect(() => {
    const initializePyodideInstance = async () => {
      const pyodideInstance = await initializePyodide();
      setPyodide(pyodideInstance ?? null);
      console.log("Pyodide initialized.");
    };
    initializePyodideInstance();
  }, []);

  const addMessage = (message: string) =>
    setMessages((prev) => [...prev, message]);

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold">WebRTC Flask Editor</h1>
      <div className="flex flex-row gap-3 my-4">
        <Button onClick={() => setIsServer(true)}>Start Server</Button>
        <Button onClick={() => setIsServer(false)}>Start Client</Button>
      </div>
      {isServer ? (
        <ServerComponent pyodide={pyodide} addMessage={addMessage} />
      ) : isServer === false ? (
        <ClientComponent addMessage={addMessage} />
      ) : null}
      <Messages messages={messages} />
    </div>
  );
};

export default App;

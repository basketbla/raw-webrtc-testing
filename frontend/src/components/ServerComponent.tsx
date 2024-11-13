// ServerComponent.tsx
import FlaskEditor from "@/components/FlaskEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  handleServerMessage,
  initializePyodide,
  setupWebRTCConnection,
} from "@/lib/webrtcHttp";
import { PyodideInterface } from "pyodide";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

const ServerComponent = () => {
  const [serverName, setServerName] = useState<string>(uuidv4());
  const [localOnly, setLocalOnly] = useState(false);
  const [status, setStatus] = useState<"live" | "initializing" | "failed">();
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);

  useEffect(() => {
    const initializePyodideInstance = async () => {
      const pyodideInstance = await initializePyodide();
      setPyodide(pyodideInstance ?? null);
      console.log("Pyodide initialized.");
    };
    initializePyodideInstance();
  }, []);

  const startServer = () => {
    // TODO: disconnect from server if already connected
    setupWebRTCConnection(
      localOnly ? "broadcast" : "websocket",
      serverName,
      serverName,
      "server",
      (data) => {
        handleServerMessage(JSON.parse(data), pyodide);
      },
      setStatus
    );
    console.log("Server mode enabled with UUID:", serverName);
  };

  useEffect(() => {
    if (!!pyodide) {
      startServer();
    }
  }, [localOnly, pyodide]);

  if (!pyodide) {
    return "Loading Pyodide...";
  }
  return (
    <div>
      <h2 className="text-xl font-bold">Server Mode</h2>
      <div className="flex items-center space-x-2 my-2">
        <Switch checked={localOnly} onCheckedChange={setLocalOnly} />
        <Label>Local only</Label>
      </div>
      <FlaskEditor pyodide={pyodide} />
      <div className="flex flex-row gap-3 my-4">
        <Input
          type="text"
          placeholder="Enter Session Name"
          value={serverName}
          onChange={(e) => setServerName(e.target.value)}
          className="border p-2"
        />
        <Button onClick={startServer}>Reset Session ID</Button>
      </div>
      {status === "initializing" && <p>Initializing server...</p>}
      {status === "failed" && (
        <p>Server failed: a server already exists with the name {serverName}</p>
      )}
      {status === "live" && (
        <p>Server is running. Waiting for client requests...</p>
      )}
    </div>
  );
};

export default ServerComponent;

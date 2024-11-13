// ServerComponent.tsx
import FlaskEditor from "@/components/FlaskEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { handleServerMessage, setupWebRTCConnection } from "@/lib/webrtcHttp";
import { PyodideInterface } from "pyodide";
import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

interface ServerComponentProps {
  pyodide: PyodideInterface | null;
}

const ServerComponent: React.FC<ServerComponentProps> = ({ pyodide }) => {
  const [serverName, setServerName] = useState<string>(uuidv4());
  const [localOnly, setLocalOnly] = useState(false);

  const startServer = () => {
    setupWebRTCConnection(
      localOnly ? "broadcast" : "websocket",
      serverName,
      serverName,
      "server",
      (data) => {
        handleServerMessage(JSON.parse(data), pyodide);
      }
    );
    console.log("Server mode enabled with UUID:", serverName);
  };

  useEffect(() => {
    startServer();
  }, [localOnly]);

  return (
    <div>
      <h2 className="text-xl font-bold">Server Mode</h2>
      <div className="flex items-center space-x-2">
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
      <p>Server is running. Waiting for client requests...</p>
    </div>
  );
};

export default ServerComponent;

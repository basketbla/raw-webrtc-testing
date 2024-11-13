// ClientComponent.tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  handleClientMessage,
  RequestMessage,
  sendRequest,
  setupClientWebsocketConnection,
  setupWebRTCConnection,
} from "@/lib/webrtcHttp";
import Editor from "@monaco-editor/react"; // Text editor for request body
import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";

interface ClientComponentProps {}

const CLIENT_ID = uuidv4();

const ClientComponent: React.FC<ClientComponentProps> = () => {
  const [serverName, setServerName] = useState(uuidv4());
  const [method, setMethod] = useState("GET"); // Dropdown for request method
  const [endpoint, setEndpoint] = useState("/"); // Endpoint text
  const [body, setBody] = useState(""); // Request body
  const [history, setHistory] = useState<
    { type: "request" | "response"; content: string }[]
  >([]);
  const [localOnly, setLocalOnly] = useState(false);

  useEffect(() => {
    setupClientWebsocketConnection(CLIENT_ID);
  }, []);

  const startClient = () => {
    if (serverName) {
      setupWebRTCConnection(
        localOnly ? "broadcast" : "websocket",
        serverName,
        CLIENT_ID,
        "client",
        (data) => {
          handleClientMessage(data, (response) =>
            setHistory((prev) => [
              ...prev,
              { type: "response", content: response },
            ])
          );
        }
      );
      console.log("Client connected to server with UUID:", serverName);
    } else {
      console.error("Client UUID is not provided.");
    }
  };

  const sendRequestToServer = () => {
    const request: RequestMessage = {
      type: "request",
      path: endpoint,
      method,
      body: body || null,
    };
    sendRequest(request);
    setHistory((prev) => [
      ...prev,
      { type: "request", content: `${method} ${endpoint}` },
    ]);
  };

  return (
    <div>
      <h2 className="text-xl font-bold">Client Mode</h2>
      <div className="flex items-center space-x-2">
        <Switch checked={localOnly} onCheckedChange={setLocalOnly} />
        <Label>Local only</Label>
      </div>
      <div className="my-4">
        {/* Session ID Input */}
        <Input
          type="text"
          placeholder="Enter Session ID"
          value={serverName}
          onChange={(e) => setServerName(e.target.value)}
          className="border p-2 mb-2"
        />
        <Button onClick={startClient} className="mb-4">
          Connect
        </Button>

        {/* HTTP Request Editor */}
        <div className="flex gap-3 mb-4">
          <Select value={method} onValueChange={(v) => setMethod(v)}>
            <SelectTrigger className="border p-2 rounded w-[180px]">
              <SelectValue placeholder="Select a method" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Methods</SelectLabel>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input
            type="text"
            placeholder="Enter Endpoint"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="border p-2 flex-grow"
          />
          <Button onClick={sendRequestToServer}>Send Request</Button>
        </div>

        {/* Request Body Editor for non-GET methods */}
        {(method === "POST" || method === "PUT") && (
          <Editor
            height="150px"
            language="json"
            value={body}
            onChange={(value) => setBody(value || "")}
            className="mb-4 border"
            theme="vs-dark"
          />
        )}

        {/* History of Requests and Responses */}
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Request/Response History
          </h3>
          <div className="space-y-2">
            {history.map((entry, index) => (
              <div key={index} className="border rounded p-2 bg-gray-100">
                <p className="font-semibold">
                  {entry.type === "request" ? "Request" : "Response"}
                </p>
                <p>{entry.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientComponent;

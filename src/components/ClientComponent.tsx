// ClientComponent.tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  handleClientMessage,
  RequestMessage,
  sendRequest,
  setupWebRTCConnection,
} from "@/lib/webrtcHttp";
import Editor from "@monaco-editor/react"; // Text editor for request body
import React, { useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface ClientComponentProps {}

const ClientComponent: React.FC<ClientComponentProps> = () => {
  const [clientUUID, setClientUUID] = useState("");
  const [method, setMethod] = useState("GET"); // Dropdown for request method
  const [endpoint, setEndpoint] = useState("/"); // Endpoint text
  const [body, setBody] = useState(""); // Request body
  const [history, setHistory] = useState<
    { type: "request" | "response"; content: string }[]
  >([]); // Request/response history

  const broadcastChannelRef = useRef<BroadcastChannel>();

  const startClient = () => {
    if (clientUUID) {
      broadcastChannelRef.current = new BroadcastChannel(
        `webrtc_channel_${clientUUID}`
      );
      setupWebRTCConnection(broadcastChannelRef.current, "client", (data) => {
        handleClientMessage(data, (response) =>
          setHistory((prev) => [
            ...prev,
            { type: "response", content: response },
          ])
        );
      });
      console.log("Client connected to server with UUID:", clientUUID);
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
      <div className="my-4">
        {/* Session ID Input */}
        <Input
          type="text"
          placeholder="Enter Session ID"
          value={clientUUID}
          onChange={(e) => setClientUUID(e.target.value)}
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

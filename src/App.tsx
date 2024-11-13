import { PyodideInterface } from "pyodide";
import React, { useEffect, useRef, useState } from "react";
import FlaskEditor from "./components/FlaskEditor";
import Messages from "./components/Messages";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  handleClientMessage,
  handleServerMessage,
  initializePyodide,
  sendRequest,
  setupWebRTCConnection,
} from "./lib/webrtcHttp";

const App: React.FC = () => {
  const [isServer, setIsServer] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [sessionUUID, setSessionUUID] = useState<string>("");
  const [clientUUID, setClientUUID] = useState<string>("");
  const [myPiodide, setMyPiodide] = useState<PyodideInterface | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel>();

  useEffect(() => {
    const initializePyodideInstance = async () => {
      const pyodideInstance = await initializePyodide();
      setMyPiodide(pyodideInstance ?? null);
      console.log("Pyodide initialized.");
    };
    initializePyodideInstance();
  }, []);

  const addMessage = (message: string) =>
    setMessages((prev) => [...prev, message]);

  const startServer = () => {
    setIsServer(true);
    // const uuid = uuidv4();
    const uuid = "server mode";
    setSessionUUID(uuid);

    broadcastChannelRef.current = new BroadcastChannel(
      `webrtc_channel_${uuid}`
    );

    // Server listens for client "ready" message before starting WebRTC connection
    setupWebRTCConnection(broadcastChannelRef.current, "server", (data) => {
      handleServerMessage(JSON.parse(data), myPiodide);
    });
    console.log("Server mode enabled with UUID:", uuid);
  };

  const startClient = () => {
    setIsServer(false);
    if (clientUUID) {
      broadcastChannelRef.current = new BroadcastChannel(
        `webrtc_channel_${clientUUID}`
      );
      setupWebRTCConnection(broadcastChannelRef.current, "client", (data) => {
        handleClientMessage(data, addMessage);
      });
      console.log("Client connected to server with UUID:", clientUUID);
    } else {
      console.error("Client UUID is not provided.");
    }
  };

  const sendRequestToServer = () => {
    sendRequest({ type: "request", path: "/greet", method: "GET" });
  };

  const resetSessionId = () => {
    broadcastChannelRef.current?.close();
    broadcastChannelRef.current = new BroadcastChannel(
      `webrtc_channel_${sessionUUID}`
    );
    setupWebRTCConnection(broadcastChannelRef.current, "server", (data) => {
      handleServerMessage(JSON.parse(data), myPiodide);
    });
  };

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold">WebRTC Flask Editor</h1>
      {isServer && <FlaskEditor pyodide={myPiodide} />}
      <div className="flex flex-row gap-3 my-4">
        <Button onClick={startServer}>Start Server</Button>
        <Button onClick={startClient}>Start Client</Button>
      </div>
      {isServer ? (
        <>
          <p>
            Server is running. Session ID:{" "}
            <div className="flex flex-row">
              <Input
                type="text"
                placeholder="Enter Session Name"
                value={sessionUUID}
                onChange={(e) => setSessionUUID(e.target.value)}
                className="border p-2"
              />
              <Button onClick={resetSessionId}>Reset Session ID</Button>
            </div>
          </p>
          <p>Waiting for client requests...</p>
        </>
      ) : (
        <div>
          <input
            type="text"
            placeholder="Enter Session ID"
            value={clientUUID}
            onChange={(e) => setClientUUID(e.target.value)}
            className="border p-2"
          />
          <Button onClick={sendRequestToServer}>Send Request</Button>
        </div>
      )}
      <Messages messages={messages} />
    </div>
  );
};

export default App;

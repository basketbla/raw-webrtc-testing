import { loadPyodide, PyodideInterface } from "pyodide";
import React, { useEffect, useState } from "react";
import FlaskEditor from "./components/FlaskEditor";
import Messages from "./components/Messages";
import {
  handleClientMessage,
  handleServerMessage,
  initializePyodide,
  sendRequest,
  setupWebRTCConnection,
} from "./webrtcHttp";

const App: React.FC = () => {
  const [isServer, setIsServer] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [myPiodide, setMyPiodide] = useState<PyodideInterface | null>(null);

  // Initialize Pyodide on mount and save to state
  useEffect(() => {
    const initializePyodide = async () => {
      const pyodideInstance = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/",
      });
      setMyPiodide(pyodideInstance);
      console.log("Pyodide initialized.");
    };

    initializePyodide();
  }, []);

  const addMessage = (message: string) =>
    setMessages((prev) => [...prev, message]);

  const startServer = async () => {
    setIsServer(true);
    setupWebRTCConnection("server", (data) => {
      handleServerMessage(JSON.parse(data), myPiodide);
    });
    await initializePyodide(); // Load Pyodide and set up Flask
  };

  // NOTE: current setup, need to click client one first.
  const startClient = () => {
    setIsServer(false);
    setupWebRTCConnection("client", (data) => {
      handleClientMessage(data, addMessage);
    });
  };

  const sendRequestToServer = () => {
    sendRequest({ type: "request", path: "/greet", method: "GET" });
  };

  return (
    <div>
      <h1>WebRTC Flask Editor</h1>
      {isServer && <FlaskEditor pyodide={myPiodide} />}
      <button onClick={startServer}>Start Server</button>
      <button onClick={startClient}>Start Client</button>
      {isServer ? (
        <p>Server is running. Waiting for client requests...</p>
      ) : (
        <button onClick={sendRequestToServer}>Send Request</button>
      )}
      <Messages messages={messages} />
    </div>
  );
};

export default App;

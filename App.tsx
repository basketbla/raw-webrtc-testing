import React, { useState } from "react";
import FlaskEditor from "./components/FlaskEditor";
import Messages from "./components/Messages";
import {
  initializePyodide,
  sendMessage,
  startClientConnection,
  startServerConnection,
} from "./webrtcHttp";

const App: React.FC = () => {
  const [isServer, setIsServer] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [code, setCode] = useState(`# Flask Code
@app.route('/')
def home():
    return "Hello, World!"

@app.route('/greet')
def greet():
    return "Hello from the greet route!"`);

  // Add a new message to the messages list
  const addMessage = (message: string) => {
    setMessages((prev) => [...prev, message]);
  };

  // Handle response received from the server
  const handleResponseFromServer = (data: string) => {
    const message = JSON.parse(data);
    if (message.type === "response") {
      console.log("Received response:", message.data);
      addMessage(`Response from server: ${message.data}`);
    }
  };

  // Start the server
  const startServer = async () => {
    setIsServer(true);
    await initializePyodide();
    await startServerConnection(handleResponseFromServer);
    console.log("Server started and ready to handle WebRTC messages.");
  };

  // Start the client
  const startClient = async () => {
    setIsServer(false);
    await startClientConnection(handleResponseFromServer);
    console.log("Client started. Ready to send messages.");
  };

  // Send a request from the client
  const handleSendRequest = () => {
    sendMessage({ type: "request", path: "/greet", method: "GET" });
    console.log("Client sent request to server.");
  };

  return (
    <div>
      <h1>WebRTC Cross-Tab Communication with Flask Editor</h1>
      <FlaskEditor code={code} setCode={setCode} />
      <button onClick={startServer}>Start Server</button>
      <button onClick={startClient}>Start Client</button>
      {isServer ? (
        <p>Server is running. Waiting for client requests...</p>
      ) : (
        <button onClick={handleSendRequest}>Send Request</button>
      )}
      <Messages messages={messages} />
    </div>
  );
};

export default App;

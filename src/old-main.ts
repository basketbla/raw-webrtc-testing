import { initializeMonacoEditor } from "./monaco-editor";
import {
  initializePyodide,
  sendMessage,
  startClientConnection,
  startServerConnection,
} from "./webrtcHttp";

// Initialize the Monaco Editor
initializeMonacoEditor();

const startServerButton = document.getElementById(
  "startServer"
) as HTMLButtonElement;
const startClientButton = document.getElementById(
  "startClient"
) as HTMLButtonElement;
const messageInput = document.getElementById("message") as HTMLInputElement;
const messagesDiv = document.getElementById("messages") as HTMLDivElement;

let isServer = false; // Track whether this tab is acting as the server

// Set up WebRTC and signaling regardless of role
startClientConnection(); // Establish WebRTC connection to receive messages

// Start the server: Initialize Pyodide and listen for messages
async function startServer() {
  isServer = true;
  await initializePyodide(); // Load Pyodide and set up the Python router
  await startServerConnection();
  console.log("Server started and ready to handle WebRTC messages.");
}

// Start the client: Send a request to the server
function startClient() {
  isServer = false; // Explicitly set as client

  const message = messageInput.value || "/greet";
  sendMessage({ type: "request", path: message, method: "GET" });
  console.log(`Client sent request to server: ${message}`);
}

// Display messages in the UI
function addMessage(message: string) {
  const messageElement = document.createElement("p");
  messageElement.textContent = message;
  messagesDiv.appendChild(messageElement);
}

// Event listeners for buttons
startServerButton.onclick = startServer;
startClientButton.onclick = startClient;

// Function to handle responses received from the server
export function handleResponseFromServer(data: string) {
  const message = JSON.parse(data);
  if (message.type === "response") {
    console.log("Received response:", message.data);
    addMessage(`Response from server: ${message.data}`);
  }
}

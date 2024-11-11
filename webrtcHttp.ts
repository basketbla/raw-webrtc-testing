import { loadPyodide, PyodideInterface } from "pyodide";

interface RequestMessage {
  type: "request";
  path: string;
  method: string;
}

interface ResponseMessage {
  type: "response";
  data: any;
}

const broadcastChannel = new BroadcastChannel("webrtc_channel");
let peerConnection: RTCPeerConnection;
let dataChannel: RTCDataChannel | null = null;
export var pyodide: PyodideInterface | null = null;

// Set up WebRTC connection and exchange ICE candidates
function setupWebRTCConnection(
  role: "server" | "client",
  handleResponse: (data: string) => void
) {
  console.log(`Setting up WebRTC connection as ${role}...`);
  peerConnection = new RTCPeerConnection();

  if (role === "server") {
    // Server creates data channel and offer
    dataChannel = peerConnection.createDataChannel("dataChannel");
    setupDataChannel(handleResponse);
    createOffer();
  } else {
    // Client receives data channel
    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel(handleResponse);
    };
  }

  // Handle ICE candidates
  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      broadcastChannel.postMessage({
        type: "ice-candidate",
        candidate: candidate.toJSON(),
      });
    }
  };

  // Signaling event listener for exchanging offers/answers and ICE candidates
  broadcastChannel.onmessage = async (event) => {
    const { type, offer, answer, candidate } = event.data;

    if (type === "offer" && role === "client") {
      console.log("Client received offer from server");
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      broadcastChannel.postMessage({ type: "answer", answer });
    } else if (type === "answer" && role === "server") {
      console.log("Server received answer from client");
      await peerConnection.setRemoteDescription(answer);
    } else if (type === "ice-candidate" && candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };
}

// Setup data channel behavior
function setupDataChannel(handleResponse: (data: string) => void) {
  if (!dataChannel) return;
  dataChannel.onopen = () => console.log("Data channel is open");
  dataChannel.onmessage = (event) => handleResponse(event.data);
  dataChannel.onclose = () => console.log("Data channel is closed");
}

// Server-only: Create and send an offer
function createOffer() {
  peerConnection.createOffer().then((offer) => {
    peerConnection.setLocalDescription(offer);
    broadcastChannel.postMessage({ type: "offer", offer });
    console.log("Server sent offer to client");
  });
}

// Initialize Pyodide with Flask routing
export async function initializePyodide(): Promise<void> {
  if (!pyodide) {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/",
    });
    console.log("Pyodide loaded.");

    // Load Flask and other required packages
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install("flask");
    console.log("Flask and other packages loaded.");
  }
}

// Handle request in Pyodide
async function handleRequestInPyodide(
  request: RequestMessage,
  pyodide: PyodideInterface
): Promise<string> {
  const { path, method } = request;
  console.log(`Handling request in Pyodide: ${method} ${path}`);
  const response = await pyodide.runPythonAsync(
    `handle_request("${path}", "${method}")`
  );
  return response ?? "Error handling request in Pyodide";
}

// Server message handler
export function handleServerMessage(
  request: RequestMessage,
  pyodide: PyodideInterface | null
) {
  if (!pyodide) {
    console.error("Pyodide is not available.");
    return;
  }

  console.log("Server received message:", request);
  handleRequestInPyodide(request, pyodide).then((response) => {
    dataChannel?.send(JSON.stringify({ type: "response", data: response }));
    console.log("Response sent to client:", response);
  });
}

// Client message handler
export function handleClientMessage(
  data: string,
  addMessage: (msg: string) => void
) {
  const message = JSON.parse(data);
  if (message.type === "response") {
    addMessage(`Response from server: ${message.data}`);
  }
}

// Send a request over WebRTC data channel
export function sendRequest(request: RequestMessage): void {
  if (dataChannel && dataChannel.readyState === "open") {
    dataChannel.send(JSON.stringify(request));
  } else {
    console.error("Data channel is not open. Cannot send request.");
  }
}

export { setupWebRTCConnection };

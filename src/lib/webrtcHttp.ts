import { loadPyodide, PyodideInterface } from "pyodide";

export interface RequestMessage {
  type: "request";
  path: string;
  method: string;
}

interface ResponseMessage {
  type: "response";
  data: any;
}

let peerConnection: RTCPeerConnection;
let dataChannel: RTCDataChannel | null = null;

export async function initializePyodide(): Promise<PyodideInterface> {
  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/",
  });
  console.log("Pyodide loaded.");
  return pyodide;
}

export function setupWebRTCConnection(
  broadcastChannel: BroadcastChannel,
  role: "server" | "client",
  handleResponse: (data: string) => void
) {
  peerConnection = new RTCPeerConnection();

  if (role === "server") {
    dataChannel = peerConnection.createDataChannel("dataChannel");
    setupDataChannel(handleResponse);

    // Server waits for client "ready" message
    broadcastChannel.onmessage = async (event) => {
      console.log(event);
      if (event.data === "ready") {
        console.log("Client is ready, server initiating connection...");
        createOffer(broadcastChannel);
      } else {
        const { type, answer, candidate } = event.data;

        if (type === "answer" && role === "server") {
          console.log("Server received answer from client");
          await peerConnection.setRemoteDescription(answer);
        } else if (type === "ice-candidate" && candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    };

    // ICE candidate handling for both roles
    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        broadcastChannel.postMessage({
          type: "ice-candidate",
          candidate: candidate.toJSON(),
        });
      }
    };

    return;
  } else {
    // Client sends a "ready" signal and waits for the offer
    broadcastChannel.postMessage("ready");

    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel(handleResponse);
    };
  }

  // ICE candidate handling for both roles
  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      broadcastChannel.postMessage({
        type: "ice-candidate",
        candidate: candidate.toJSON(),
      });
    }
  };

  broadcastChannel.onmessage = async (event) => {
    const { type, offer, candidate } = event.data;

    if (type === "offer" && role === "client") {
      console.log("Client received offer from server");
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      broadcastChannel.postMessage({ type: "answer", answer });
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
function createOffer(broadcastChannel: BroadcastChannel) {
  peerConnection.createOffer().then((offer) => {
    peerConnection.setLocalDescription(offer);
    broadcastChannel.postMessage({ type: "offer", offer });
    console.log("Server sent offer to client");
  });
}

// Send a request over the WebRTC data channel
export function sendRequest(request: RequestMessage): void {
  if (dataChannel && dataChannel.readyState === "open") {
    dataChannel.send(JSON.stringify(request));
    console.log("Request sent over data channel:", request);
  } else {
    console.error("Data channel is not open. Cannot send request.");
  }
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

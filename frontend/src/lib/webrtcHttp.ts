import { Message as WebsocketMessage } from "@shared/types";
import { loadPyodide, PyodideInterface } from "pyodide";

export interface RequestMessage {
  type: "request";
  path: string;
  method: string;
  body: string | null;
}

interface ResponseMessage {
  type: "response";
  data: any;
}

let peerConnection: RTCPeerConnection;
let dataChannel: RTCDataChannel | null = null;
let broadcastChannel: BroadcastChannel;

export async function initializePyodide(): Promise<PyodideInterface> {
  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/",
  });
  console.log("Pyodide loaded.");
  return pyodide;
}

export function setupClientWebsocketConnection(clientId: string) {
  connectToSignalingServer("", "client", clientId);
}

export function setupWebRTCConnection(
  signalingMethod: "broadcast" | "websocket",
  serverName: string,
  clientId: string,
  role: "server" | "client",
  handleResponse: (data: string) => void
) {
  peerConnection = new RTCPeerConnection();

  // Choose signaling method
  if (signalingMethod === "websocket" && role === "server") {
    connectToSignalingServer(serverName, "server");
  } else {
    broadcastChannel = new BroadcastChannel(`webrtc_channel_${serverName}`);
  }

  if (role === "server") {
    dataChannel = peerConnection.createDataChannel("dataChannel");
    setupDataChannel(handleResponse);

    if (signalingMethod === "broadcast") {
      dataChannel = peerConnection.createDataChannel("dataChannel");
      setupDataChannel(handleResponse);

      // Server waits for client "ready" message
      broadcastChannel.onmessage = async (event) => {
        console.log(event);
        if (event.data === "ready") {
          console.log("Client is ready, server initiating connection...");
          createOffer(broadcastChannel, "broadcast", serverName, "");
        } else {
          const { type, answer, candidate } = event.data;

          if (type === "answer" && role === "server") {
            console.log("Server received answer from client");
            await peerConnection.setRemoteDescription(answer);
          } else if (type === "ice-candidate" && candidate) {
            await peerConnection.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
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
    }
  } else {
    peerConnection.ondatachannel = (event) => {
      console.log("on data channel");
      console.log(event);
      dataChannel = event.channel;
      setupDataChannel(handleResponse);
    };

    // Client ready for the offer
    if (signalingMethod === "websocket") {
      console.log("sending ready message");
      sendSignalingMessage({
        type: "ready",
        serverName: serverName,
        clientId: clientId,
      });
    } else {
      broadcastChannel.postMessage("ready");
    }
  }

  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      if (signalingMethod === "broadcast") {
        broadcastChannel.postMessage({
          type: "ice-candidate",
          candidate: candidate.toJSON(),
        });
      } else {
        // Send ice candidate to signaling server?
        console.log("sending ice candidate");
        sendSignalingMessage({
          type: "ice-candidate",
          candidate: candidate,
          target: role === "server" ? "client" : "server",
          clientId: clientId,
          serverName: serverName,
        });
      }
    }
  };

  if (signalingMethod === "broadcast") {
    broadcastChannel.onmessage = async (event) => {
      const { type, offer, answer, candidate } = event.data;

      if (type === "offer") {
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        broadcastChannel.postMessage({ type: "answer", answer });
      } else if (type === "answer" && role === "server") {
        await peerConnection.setRemoteDescription(answer);
      } else if (type === "ice-candidate" && candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };
  }
}

function createOffer(
  broadcastChannel: BroadcastChannel | null,
  signalingMethod: "broadcast" | "websocket",
  serverName: string,
  clientId: string
) {
  peerConnection.createOffer().then((offer) => {
    peerConnection.setLocalDescription(offer);
    if (signalingMethod === "broadcast") {
      broadcastChannel!.postMessage({ type: "offer", offer });
    } else {
      sendSignalingMessage({
        type: "offer",
        offer: offer,
        serverName: serverName,
        clientId: clientId,
      });
    }
  });
}

// Setup data channel behavior
function setupDataChannel(handleResponse: (data: string) => void) {
  if (!dataChannel) return;
  dataChannel.onopen = () => console.log("Data channel is open");
  dataChannel.onmessage = (event) => handleResponse(event.data);
  dataChannel.onclose = () => console.log("Data channel is closed");
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
    addMessage(`${message.data}`);
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

// Signaling logic

// Signaling server WebSocket URL
const SIGNAL_SERVER_URL = "ws://localhost:8080";
let signalingSocket: WebSocket | null = null;

// Initialize WebSocket connection to the signaling server
function connectToSignalingServer(
  serverName: string,
  role: "server" | "client",
  clientId?: string
) {
  signalingSocket = new WebSocket(SIGNAL_SERVER_URL);

  signalingSocket.onopen = () => {
    console.log("Connected to signaling server");
    if (role === "server") {
      sendSignalingMessage({ type: "register", serverName: serverName });
    }
  };

  signalingSocket.onmessage = (event) => {
    console.log("Received message from signaling server:");
    console.log(event);
    const message = JSON.parse(event.data);
    handleSignalingMessage(message, role, clientId ?? "");
  };

  signalingSocket.onclose = () => {
    console.log("Disconnected from signaling server");
  };
}

// Function to handle signaling messages
function handleSignalingMessage(
  message: any,
  role: "server" | "client",
  clientId: string
) {
  const { type, offer, answer, candidate } = message;

  if (type === "ready" && role === "server") {
    createOffer(null, "websocket", message.serverName, message.from);
  }

  if (type === "offer" && peerConnection) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    peerConnection.createAnswer().then((answer) => {
      peerConnection.setLocalDescription(answer);
      sendSignalingMessage({
        type: "answer",
        answer,
        serverName: message.from as string,
        clientId: clientId,
      });
    });
  } else if (type === "answer" && peerConnection) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  } else if (type === "ice-candidate" && candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
}

// Send message over the signaling server
function sendSignalingMessage(message: WebsocketMessage) {
  if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
    signalingSocket.send(JSON.stringify(message));
  }
}

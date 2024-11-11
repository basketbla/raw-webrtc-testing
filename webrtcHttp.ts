import { loadPyodide, PyodideInterface } from "pyodide";

// Define types for WebRTC messages
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
let localConnection: RTCPeerConnection | null = null;
let remoteConnection: RTCPeerConnection | null = null;
let sendChannel: RTCDataChannel | null = null;
let receiveChannel: RTCDataChannel | null = null;
let pyodide: PyodideInterface | null = null;

export async function initializePyodide(): Promise<void> {
  if (!pyodide) {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/",
    });
    console.log("Pyodide loaded.");
  }
}

// Start server connection and listen for incoming messages
export async function startServerConnection(
  handleResponse: (data: string) => void
): Promise<void> {
  localConnection = new RTCPeerConnection();
  sendChannel = localConnection.createDataChannel("sendChannel");

  sendChannel.onopen = () => console.log("Data channel open on server");
  sendChannel.onmessage = async (event) => {
    const request: RequestMessage = JSON.parse(event.data);
    const response = await handleRequestInPyodide(request);
    sendChannel?.send(JSON.stringify({ type: "response", data: response }));
  };

  localConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      broadcastChannel.postMessage({
        type: "ice-candidate",
        candidate: candidate.toJSON(),
      });
    }
  };

  broadcastChannel.onmessage = async (event) => {
    const { type, answer, candidate } = event.data;
    if (type === "answer" && localConnection) {
      await localConnection.setRemoteDescription(answer);
      console.log("Server received answer from client.");
    } else if (type === "ice-candidate" && localConnection) {
      await localConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("Server received ICE candidate from client.");
    }
  };

  const offer = await localConnection.createOffer();
  await localConnection.setLocalDescription(offer);
  broadcastChannel.postMessage({ type: "offer", offer });
}

// Start client connection and listen for responses
export async function startClientConnection(
  handleResponse: (data: string) => void
): Promise<void> {
  remoteConnection = new RTCPeerConnection();

  remoteConnection.ondatachannel = (event) => {
    receiveChannel = event.channel;
    receiveChannel.onopen = () => console.log("Data channel open on client");
    receiveChannel.onmessage = (e) => handleResponse(e.data);
  };

  remoteConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      broadcastChannel.postMessage({
        type: "ice-candidate",
        candidate: candidate.toJSON(),
      });
    }
  };

  broadcastChannel.onmessage = async (event) => {
    const { type, offer, answer, candidate } = event.data;
    if (type === "offer") {
      await remoteConnection?.setRemoteDescription(offer);
      const answer = await remoteConnection?.createAnswer();
      await remoteConnection?.setLocalDescription(answer);
      broadcastChannel.postMessage({ type: "answer", answer });
    } else if (type === "ice-candidate" && remoteConnection) {
      await remoteConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };
}

export function sendMessage(request: RequestMessage): void {
  if (sendChannel && sendChannel.readyState === "open") {
    sendChannel.send(JSON.stringify(request));
  } else {
    console.error("Data channel is not open. Cannot send request.");
  }
}

// Handle a request in Pyodide and return the response
async function handleRequestInPyodide(
  request: RequestMessage
): Promise<string> {
  const { path, method } = request;
  const response = await pyodide?.runPythonAsync(
    `handle_request("${path}", "${method}")`
  );
  return response ?? "Error handling request in Pyodide";
}

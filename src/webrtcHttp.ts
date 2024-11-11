import { loadPyodide, PyodideInterface } from "pyodide";
import { handleResponseFromServer } from "./old-main";

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

/**
 * Initializes Pyodide and sets up the router (server-side)
 */
export async function initializePyodide(): Promise<void> {
  if (!pyodide) {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/",
    });
    console.log("Pyodide loaded.");

    pyodide.runPython(`
      routes = {}
      def route(path):
          def decorator(func):
              routes[path] = func
              return func
          return decorator
      @route("/")
      def home():
          return "Hello, World!"
      @route("/greet")
      def greet():
          return "Hello from the greet route!"
      def handle_request(path, method="GET"):
          handler = routes.get(path)
          return handler() if handler else "404 Not Found"
    `);
    console.log("Python router initialized.");
  }
}

/**
 * Sets up WebRTC connection for the server and listens for incoming messages
 */
export async function startServerConnection(): Promise<void> {
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

  // Listen for signaling messages
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

  // Create and send an offer
  const offer = await localConnection.createOffer();
  await localConnection.setLocalDescription(offer);
  broadcastChannel.postMessage({ type: "offer", offer });
}

/**
 * Sets up WebRTC connection for the client and listens for responses
 */
export async function startClientConnection(): Promise<void> {
  remoteConnection = new RTCPeerConnection();

  remoteConnection.ondatachannel = (event) => {
    receiveChannel = event.channel;
    receiveChannel.onopen = () => console.log("Data channel open on client");
    receiveChannel.onmessage = (e) => handleResponseFromServer(e.data);
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
    } else if (type === "answer" && localConnection) {
      await localConnection.setRemoteDescription(answer);
    } else if (type === "ice-candidate") {
      const peerConnection = localConnection || remoteConnection;
      if (peerConnection && candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }
  };
}

/**
 * Sends a message over WebRTC from the client
 */
export function sendMessage(request: RequestMessage): void {
  if (receiveChannel && receiveChannel.readyState === "open") {
    receiveChannel.send(JSON.stringify(request));
  } else {
    console.error("Data channel is not open. Cannot send request.");
  }
}

/**
 * Forwards a request to the Pyodide router
 */
async function handleRequestInPyodide(
  request: RequestMessage
): Promise<string> {
  const { path, method } = request;
  const response = await pyodide?.runPythonAsync(
    `handle_request("${path}", "${method}")`
  );
  return response ?? "Error handling request in Pyodide";
}

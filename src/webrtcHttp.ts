// webrtcHttp.ts
import { loadPyodide, PyodideInterface } from "pyodide";

// Define request and response types
interface RequestMessage {
  type: "request";
  requestId: string;
  path: string;
  method: string;
  body?: any;
}

interface ResponseMessage {
  type: "response";
  requestId: string;
  data: any;
}

interface IceCandidateMessage {
  type: "ice-candidate";
  candidate: RTCIceCandidateInit;
}

interface OfferMessage {
  type: "offer";
  offer: RTCSessionDescriptionInit;
}

interface AnswerMessage {
  type: "answer";
  answer: RTCSessionDescriptionInit;
}

type SignalingMessage = IceCandidateMessage | OfferMessage | AnswerMessage;

const broadcastChannel = new BroadcastChannel("webrtc_channel");
let localConnection: RTCPeerConnection | null = null;
let remoteConnection: RTCPeerConnection | null = null;
let sendChannel: RTCDataChannel | null = null;
let receiveChannel: RTCDataChannel | null = null;

/**
 * Starts a WebRTC connection and sends an offer
 */
export async function startConnection(): Promise<void> {
  localConnection = new RTCPeerConnection();
  sendChannel = localConnection.createDataChannel("sendChannel");

  sendChannel.onopen = () => console.log("Data channel is open");
  sendChannel.onmessage = (event) => handleIncomingMessage(event.data);

  // Send ICE candidates over the BroadcastChannel for signaling
  localConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      const iceCandidateMessage: IceCandidateMessage = {
        type: "ice-candidate",
        candidate: candidate.toJSON(),
      };
      broadcastChannel.postMessage(iceCandidateMessage);
    }
  };

  // Create and send an offer
  const offer = await localConnection.createOffer();
  await localConnection.setLocalDescription(offer);
  broadcastChannel.postMessage({ type: "offer", offer });
}

/**
 * Handle incoming messages for signaling and data exchange
 */
broadcastChannel.onmessage = async (event: MessageEvent) => {
  const data: SignalingMessage = event.data;

  if (data.type === "offer") {
    remoteConnection = new RTCPeerConnection();

    remoteConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        const iceCandidateMessage: IceCandidateMessage = {
          type: "ice-candidate",
          candidate: candidate.toJSON(),
        };
        broadcastChannel.postMessage(iceCandidateMessage);
      }
    };

    remoteConnection.ondatachannel = (event: RTCDataChannelEvent) => {
      receiveChannel = event.channel;
      receiveChannel.onopen = () => console.log("Receive channel is open");
      receiveChannel.onmessage = (e) => handleIncomingMessage(e.data);
    };

    await remoteConnection.setRemoteDescription(data.offer);
    const answer = await remoteConnection.createAnswer();
    await remoteConnection.setLocalDescription(answer);
    broadcastChannel.postMessage({ type: "answer", answer });
  } else if (data.type === "answer" && localConnection) {
    await localConnection.setRemoteDescription(data.answer);
  } else if (data.type === "ice-candidate") {
    const peerConnection = localConnection || remoteConnection;
    if (peerConnection && data.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }
};

/**
 * Sends a JSON-based request over WebRTC
 * @param request - The request object with path, method, body
 */
export function sendRequest(request: RequestMessage): void {
  if (sendChannel && sendChannel.readyState === "open") {
    sendChannel.send(JSON.stringify(request));
  } else {
    console.error("Data channel is not open. Cannot send request.");
  }
}

/**
 * Handles incoming JSON-based messages on the data channel
 * @param data - Incoming JSON string from data channel
 */
async function handleIncomingMessage(data: string): Promise<void> {
  const message = JSON.parse(data);

  if (message.type === "request") {
    const response = await forwardToFlask(message);
    if (sendChannel) {
      const responseMessage: ResponseMessage = {
        type: "response",
        requestId: message.requestId,
        data: response,
      };
      sendChannel.send(JSON.stringify(responseMessage));
    }
  } else if (message.type === "response") {
    console.log("Received response:", message.data);
  }
}

let pyodide: PyodideInterface | null = null;

/**
 * Initializes Pyodide and loads necessary packages (run this once at startup)
 */
export async function initializePyodide(): Promise<void> {
  if (!pyodide) {
    // Load Pyodide
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/",
    });
    console.log("Pyodide loaded.");

    // Load Flask and other required packages
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install("flask");

    console.log("Flask and other packages loaded.");

    // Define a basic router in Python to simulate Flask-like routing
    pyodide.runPython(`
        # Basic router dictionary to simulate routing
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

        def handle_request(path, method="GET", data=None):
            handler = routes.get(path)
            if handler:
                return handler()
            else:
                return "404 Not Found"
    `);
    console.log("Custom Python router set up.");
  }
}
/**
 * Forwards a request to a Flask app running in Wasm and gets the response
 * @param request - The JSON request object
 */
export async function forwardToFlask(request: {
  path: string;
  method: string;
  body?: any;
}): Promise<any> {
  if (!pyodide) {
    throw new Error(
      "Pyodide has not been initialized. Please call initializePyodide() first."
    );
  }

  const { path, method, body } = request;

  // Call the custom `handle_request` function in Python
  const response = await pyodide.runPythonAsync(`
    handle_request("${path}", "${method}", ${
    !!body ? JSON.stringify(body) : "None"
  })
  `);

  return response;
}

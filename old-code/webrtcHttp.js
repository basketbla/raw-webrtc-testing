// webrtcHttp.js

const broadcastChannel = new BroadcastChannel("webrtc_channel");
let localConnection, remoteConnection, sendChannel, receiveChannel;

/**
 * Starts a WebRTC connection and sends an offer
 */
export async function startConnection() {
  localConnection = new RTCPeerConnection();
  sendChannel = localConnection.createDataChannel("sendChannel");

  sendChannel.onopen = () => console.log("Data channel is open");
  sendChannel.onmessage = (event) => handleIncomingMessage(event.data);

  // Send ICE candidates over the BroadcastChannel for signaling
  localConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      broadcastChannel.postMessage({
        type: "ice-candidate",
        candidate: candidate.toJSON(),
      });
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
broadcastChannel.onmessage = async (event) => {
  const { type, offer, answer, candidate } = event.data;

  if (type === "offer") {
    remoteConnection = new RTCPeerConnection();

    remoteConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        broadcastChannel.postMessage({
          type: "ice-candidate",
          candidate: candidate.toJSON(),
        });
      }
    };

    remoteConnection.ondatachannel = (event) => {
      receiveChannel = event.channel;
      receiveChannel.onopen = () => console.log("Receive channel is open");
      receiveChannel.onmessage = (e) => handleIncomingMessage(e.data);
    };

    await remoteConnection.setRemoteDescription(offer);
    const answer = await remoteConnection.createAnswer();
    await remoteConnection.setLocalDescription(answer);
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

/**
 * Sends a JSON-based request over WebRTC
 * @param {Object} request - The request object with path, method, body
 */
export function sendRequest(request) {
  if (sendChannel && sendChannel.readyState === "open") {
    sendChannel.send(JSON.stringify(request));
  } else {
    console.error("Data channel is not open. Cannot send request.");
  }
}

/**
 * Handles incoming JSON-based messages on the data channel
 * @param {string} data - Incoming JSON string from data channel
 */
async function handleIncomingMessage(data) {
  const message = JSON.parse(data);

  if (message.type === "request") {
    const response = await forwardToFlask(message);
    sendChannel.send(
      JSON.stringify({
        type: "response",
        requestId: message.requestId,
        data: response,
      })
    );
  } else if (message.type === "response") {
    console.log("Received response:", message.data);
  }
}

/**
 * Forwards a request to a Flask app running in Wasm and gets the response
 * @param {Object} request - The JSON request object
 */
async function forwardToFlask(request) {
  const { path, method, body } = request;

  // Example of interacting with Pyodide to call Flask code
  const response = await pyodide.runPythonAsync(`
    from flask import request
    with app.test_request_context('${path}', method='${method}', data=${JSON.stringify(
    body
  )}) as ctx:
        response = app.full_dispatch_request()
        response.get_data(as_text=True)
  `);

  return response; // Return the response data from Flask
}

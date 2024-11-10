const broadcastChannel = new BroadcastChannel("webrtc_channel");
let localConnection, remoteConnection, sendChannel, receiveChannel;

// UI elements
const startConnectionButton = document.getElementById("startConnection");
const sendMessageButton = document.getElementById("sendMessage");
const messageInput = document.getElementById("message");
const messagesDiv = document.getElementById("messages");

startConnectionButton.onclick = async () => {
  startConnectionButton.disabled = true;

  localConnection = new RTCPeerConnection();
  sendChannel = localConnection.createDataChannel("sendChannel");

  // Event when data channel opens
  sendChannel.onopen = () => {
    console.log("Data channel is open");
    sendMessageButton.disabled = false; // Enable the send button once ready
  };

  // Event when a message is received
  sendChannel.onmessage = (event) => addMessage(`Received: ${event.data}`);

  // Listen for ICE candidates and serialize them before posting
  localConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      broadcastChannel.postMessage({
        type: "ice-candidate",
        candidate: candidate.toJSON(),
      });
    }
  };

  // Create offer
  const offer = await localConnection.createOffer();
  await localConnection.setLocalDescription(offer);
  broadcastChannel.postMessage({ type: "offer", offer });
};

// Send message through the data channel
sendMessageButton.onclick = () => {
  const message = messageInput.value;
  if (sendChannel && sendChannel.readyState === "open") {
    sendChannel.send(message);
    addMessage(`Sent: ${message}`);
  } else {
    console.error("Data channel is not open. Cannot send message.");
  }
};

// Handle incoming messages in the BroadcastChannel
broadcastChannel.onmessage = async (event) => {
  const { type, offer, answer, candidate } = event.data;

  if (type === "offer") {
    remoteConnection = new RTCPeerConnection();

    // Handle remote ICE candidates
    remoteConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        broadcastChannel.postMessage({
          type: "ice-candidate",
          candidate: candidate.toJSON(),
        });
      }
    };

    // Handle data channel from the remote side
    remoteConnection.ondatachannel = (event) => {
      receiveChannel = event.channel;
      receiveChannel.onopen = () => console.log("Receive channel is open");
      receiveChannel.onmessage = (e) => addMessage(`Received: ${e.data}`);
    };

    // Set remote description and create answer
    await remoteConnection.setRemoteDescription(offer);
    const answer = await remoteConnection.createAnswer();
    await remoteConnection.setLocalDescription(answer);
    broadcastChannel.postMessage({ type: "answer", answer });
  } else if (type === "answer" && localConnection) {
    await localConnection.setRemoteDescription(answer);
  } else if (type === "ice-candidate") {
    // Deserialize the candidate and add it to the connection
    const peerConnection = localConnection || remoteConnection;
    if (peerConnection && candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }
};

// Utility function to display messages
function addMessage(message) {
  const messageElement = document.createElement("p");
  messageElement.textContent = message;
  messagesDiv.appendChild(messageElement);
}

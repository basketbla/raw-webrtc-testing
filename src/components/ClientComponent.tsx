// ClientComponent.tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  handleClientMessage,
  sendRequest,
  setupWebRTCConnection,
} from "@/lib/webrtcHttp";
import React, { useRef, useState } from "react";

interface ClientComponentProps {
  addMessage: (message: string) => void;
}

const ClientComponent: React.FC<ClientComponentProps> = ({ addMessage }) => {
  const [clientUUID, setClientUUID] = useState("");
  const broadcastChannelRef = useRef<BroadcastChannel>();

  const startClient = () => {
    if (clientUUID) {
      broadcastChannelRef.current = new BroadcastChannel(
        `webrtc_channel_${clientUUID}`
      );
      setupWebRTCConnection(broadcastChannelRef.current, "client", (data) => {
        handleClientMessage(data, addMessage);
      });
      console.log("Client connected to server with UUID:", clientUUID);
    } else {
      console.error("Client UUID is not provided.");
    }
  };

  const sendRequestToServer = () => {
    sendRequest({ type: "request", path: "/greet", method: "GET" });
  };

  return (
    <div>
      <h2 className="text-xl font-bold">Client Mode</h2>
      <div className="my-4">
        <Input
          type="text"
          placeholder="Enter Session ID"
          value={clientUUID}
          onChange={(e) => setClientUUID(e.target.value)}
          className="border p-2"
        />
        <Button onClick={startClient}>Connect</Button>
        <Button onClick={sendRequestToServer} className="ml-2">
          Send Request
        </Button>
      </div>
    </div>
  );
};

export default ClientComponent;

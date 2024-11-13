import WebSocket, { WebSocketServer } from "ws";

// Message types
type Message =
  | { type: "register"; name: string }
  | { type: "search"; name: string }
  | { type: "ready"; name: string }
  | { type: "ice-candidate"; candidate: any; name: string };

interface Client {
  ws: WebSocket;
  name: string;
}

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`Signaling server is listening on ws://localhost:${PORT}`);

const clients: Map<string, Client> = new Map();

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString()) as Message;

    switch (message.type) {
      case "register":
        // Register the client with a name
        clients.set(message.name, { ws, name: message.name });
        console.log(`Server registered: ${message.name}`);
        break;

      case "search":
        // Check if the requested server name exists and inform the client
        const client = clients.get(message.name);
        if (client) {
          ws.send(JSON.stringify({ type: "found", name: message.name }));
        } else {
          ws.send(JSON.stringify({ type: "not-found", name: message.name }));
        }
        break;

      case "ready":
        // Send "ready" message to the specific server
        const targetServer = clients.get(message.name);
        if (targetServer) {
          targetServer.ws.send(
            JSON.stringify({ type: "ready", from: message.name })
          );
        }
        break;

      case "ice-candidate":
        // Relay ICE candidates between server and client
        const target = clients.get(message.name);
        if (target) {
          target.ws.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: message.candidate,
              from: message.name,
            })
          );
        }
        break;
    }
  });

  ws.on("close", () => {
    // Remove disconnected clients from the map
    clients.forEach((client, name) => {
      if (client.ws === ws) {
        clients.delete(name);
        console.log(`Client disconnected: ${name}`);
      }
    });
  });
});

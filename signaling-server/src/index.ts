import { Message } from "@shared/types";
import WebSocket, { WebSocketServer } from "ws";

export interface Client {
  ws: WebSocket;
}

export interface Server {
  ws: WebSocket;
  name: string;
}

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`Signaling server is listening on ws://localhost:${PORT}`);

// FUCK okay im getting tripped up so here's how I'm doing it.
// Servers are mapped by name. Clients are mapped by id. Sorry.
const servers: Map<string, Server> = new Map();
const clients: Map<string, Client> = new Map();

wss.on("connection", (ws) => {
  console.log("New connection");

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString()) as Message;

    console.log("Received message:", message);

    switch (message.type) {
      case "register":
        // Register the server with a name
        servers.set(message.serverName, { ws, name: message.serverName });
        console.log(`Server registered: ${message.serverName}`);
        break;

      case "search":
        // Check if the requested server name exists and inform the client
        const server = servers.get(message.serverName);
        if (server) {
          ws.send(JSON.stringify({ type: "found", name: message.serverName }));
        } else {
          ws.send(
            JSON.stringify({ type: "not-found", name: message.serverName })
          );
        }
        break;

      case "ready":
        // Register the client with its id
        clients.set(message.clientId, { ws });
        console.log(`Client registered: ${message.clientId}`);

        // Inform the server that the client is ready
        const targetServer = servers.get(message.serverName);
        if (targetServer) {
          targetServer.ws.send(
            JSON.stringify({
              type: "ready",
              from: message.clientId,
              serverName: message.serverName,
            })
          );
        }
        break;

      case "offer":
        // Forward the offer to the specific client
        const offerClient = clients.get(message.clientId);
        if (offerClient) {
          offerClient.ws.send(
            JSON.stringify({
              type: "offer",
              offer: message.offer,
              from: message.serverName,
            })
          );
          console.log(`Offer sent to client: ${message.clientId}`);
        }
        break;

      case "answer":
        // Forward the answer to the specific server
        const answerServer = servers.get(message.serverName);
        if (answerServer) {
          answerServer.ws.send(
            JSON.stringify({
              type: "answer",
              answer: message.answer,
              from: message.clientId,
            })
          );
          console.log(`Answer sent to server: ${message.serverName}`);
        }
        break;

      case "ice-candidate":
        // Relay ICE candidates between server and client
        const iceTarget =
          message.target === "server"
            ? servers.get(message.serverName)
            : clients.get(message.clientId);
        if (iceTarget) {
          iceTarget.ws.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: message.candidate,
              from:
                message.target === "server"
                  ? message.serverName
                  : message.clientId,
            })
          );
        }
        break;
    }
  });

  ws.on("close", () => {
    // Remove disconnected clients and servers from their respective maps
    servers.forEach((server, name) => {
      if (server.ws === ws) {
        servers.delete(name);
        console.log(`Server disconnected: ${name}`);
      }
    });

    clients.forEach((client, name) => {
      if (client.ws === ws) {
        clients.delete(name);
        console.log(`Client disconnected: ${name}`);
      }
    });
  });
});

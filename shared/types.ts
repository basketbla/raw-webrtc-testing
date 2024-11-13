export type Message =
  | { type: "register"; serverName: string }
  | { type: "search"; serverName: string }
  | { type: "ready"; serverName: string; clientId: string }
  | { type: "offer"; offer: any; clientId: string; serverName: string }
  | { type: "answer"; answer: any; serverName: string; clientId: string }
  | {
      type: "ice-candidate";
      candidate: any;
      target: "server" | "client";
      clientId: string;
      serverName: string;
    };

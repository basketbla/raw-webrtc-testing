import { sendRequest, startConnection } from "./webrtcHttp.js";

document.getElementById("startConnection").onclick = startConnection;

document.getElementById("sendMessage").onclick = () => {
  const message = document.getElementById("message").value;
  sendRequest({ type: "request", path: "/", method: "GET", body: message });
};

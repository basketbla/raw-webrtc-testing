import { forwardToFlask, initializePyodide } from "./webrtcHttp";

async function main() {
  await initializePyodide();
  const response = await forwardToFlask({ path: "/greet", method: "GET" });
  console.log(response); // Expected output: "Hello from the greet route!"
}

main();

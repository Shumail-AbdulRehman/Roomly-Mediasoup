import express from "express";
import * as http from "http";
import { WebSocketServer } from "ws";
import { webSocketServer } from "./lib/ws.js";
import { createWorkers } from "./lib/worker.js";
import { config } from "./config/config.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

await createWorkers();
webSocketServer(wss);

const port = config.listenPort;

server.listen(port, () => {
  console.log(`server started at ${config.listenPort}`);
});

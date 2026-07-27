import express from "express";
import * as http from "http";
import { WebSocketServer } from "ws";
import { webSocketServer } from "./lib/ws.js";
import { createWorkers } from "./lib/worker.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

await createWorkers();
webSocketServer(wss);

const port = 8000;

server.listen(port, () => {
  console.log("server started at 8000");
});
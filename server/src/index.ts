import express from "express";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import { WebSocketServer } from "ws";
import { webSocketServer } from "./lib/ws.js";
import { createWorkers } from "./lib/worker.js";
import { config } from "./config/config.js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = https.createServer(
  {
    key: fs.readFileSync(path.join(__dirname, "..", "certs", "key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "..", "certs", "cert.pem")),
  },
  app,
);
const wss = new WebSocketServer({ server });

await createWorkers();
webSocketServer(wss);

const port = config.listenPort;

server.listen(port, () => {
  console.log(`server started at ${config.listenPort}`);
});

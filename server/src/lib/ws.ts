import { WebSocketServer,WebSocket } from "ws";
import { createRoom, joinRoom } from "./room.js";

import onGetRouterRtpCapabilities from "../wsControllers/onGetRouterRtpCapabilities.js";
import onCreateProducerTransport from "../wsControllers/onCreateProducerTransport.js";
import onCreateConsumerTransport from "../wsControllers/onCreateConsumerTransport.js";
import onConnectProducerTransport from "../wsControllers/onConnectProducerTransport.js";
import onProduce from "../wsControllers/onProduce.js";
import onCreateConsumer from "../wsControllers/onCreateConsumer.js";
import onResumeConsumer from "../wsControllers/onResumeConsumer.js";

import { Peer } from "../types/peer.types.js";

export const webSocketServer = (wss:WebSocketServer) => {
  
  wss.on("connection", (ws:WebSocket)=> {

        let peerId:string=crypto.randomUUID();
        const peer: Peer = {
        peerId,
        ws,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      };

      ws.on("message", async (data:any)=> {
        const msg=JSON.parse(data);

        if(msg.type === "createRoom") {
          createRoom(peerId,peer);
          
        }

        else if(msg.type === "joinRoom") {
          joinRoom(peerId, msg.data.roomId,peer);
          
        }

        else if(msg.type === "getRouterRtpCapabilities") {

          onGetRouterRtpCapabilities(msg,peer);
        }


        else if(msg.type === "createProducerTransport") {
          await onCreateProducerTransport(peer);
        }

        else if(msg.type === "createConsumerTransport") {
          await onCreateConsumerTransport(msg,peer);
        }

        else if(msg.type === "connectProducerTransport") {

          await onConnectProducerTransport(msg,peer);
        }

        else if(msg.type === "produce") {
          await onProduce(msg,peer);
        }

        else if(msg.type === "createConsumer") {
          await onCreateConsumer(msg,peer);
        }

        else if(msg.type === "resumeConsumer") {
          onResumeConsumer(msg,peer);
        }

      })

    })
}
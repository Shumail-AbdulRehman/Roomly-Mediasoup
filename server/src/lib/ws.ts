import { WebSocketServer, WebSocket } from "ws";
import { createRoom, getRoom, joinRoom } from "./room.js";

import onGetRouterRtpCapabilities from "../wsControllers/onGetRouterRtpCapabilities.js";
import onCreateProducerTransport from "../wsControllers/onCreateProducerTransport.js";
import onCreateConsumerTransport from "../wsControllers/onCreateConsumerTransport.js";
import onConnectProducerTransport from "../wsControllers/onConnectProducerTransport.js";
import onProduce from "../wsControllers/onProduce.js";
import onCreateConsumer from "../wsControllers/onCreateConsumer.js";
import onResumeConsumer from "../wsControllers/onResumeConsumer.js";
import onProducerClose from "../wsControllers/onProducerClose.js";

import { Peer } from "../types/peer.types.js";
import { onConnectConsumerTransport } from "../wsControllers/onConnectConsumerTransport.js";
import onRequestExistingProducers from "../wsControllers/onRequestExistingProducers.js";
import send from "../utils/send.js";
import { rooms } from "../const/const.js";

export const webSocketServer = (wss: WebSocketServer) => {
  wss.on("connection", (ws: WebSocket) => {
    let peerId: string = Math.floor(100000 + Math.random() * 900000).toString();
    const peer: Peer = {
      peerId,
      ws,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };

    ws.on("message", async (data: any) => {
      let msg;
try {
         msg = JSON.parse(data);
  
} catch (error) {
    console.log("error while parsng JSON::",error);
    return;
}
      if (msg.type === "createRoom") {
        createRoom(peerId, peer, msg.data.userName);
      } else if (msg.type === "joinRoom") {
        joinRoom(peerId, msg.data.roomId, peer, msg.data.userName);
      } else if (msg.type === "getRouterRtpCapabilities") {
        onGetRouterRtpCapabilities(msg, peer);
        console.log("rtp capa");
      } else if (msg.type === "createProducerTransport") {
        await onCreateProducerTransport(peer);
      } else if (msg.type === "createConsumerTransport") {
        await onCreateConsumerTransport(msg, peer);
      } else if (msg.type === "connectProducerTransport") {
        await onConnectProducerTransport(msg, peer);
      } else if (msg.type === "connectConsumerTransport") {
        await onConnectConsumerTransport(msg, peer);
      } else if (msg.type === "produce") {
        await onProduce(msg, peer);
      } else if (msg.type === "createConsumer") {
        await onCreateConsumer(msg, peer);
      } else if (msg.type === "resumeConsumer") {
        onResumeConsumer(msg, peer);
      } else if (msg.type === "requestExistingProducers") {
        onRequestExistingProducers(msg, peer);
      } else if(msg.type === "producerClose") {
        onProducerClose(msg,peer);
      }
    });

    ws.on("close",()=> {

      if(!peer.roomId) return;

      const room=getRoom(peer.roomId);

      if(!room) return;

      try {
        peer.producers.forEach((producer)=> {
          room.peers.forEach((otherPeer)=> {
            if(peer.peerId === otherPeer.peerId) return;
  
  
            const msg={
              type:"producerClosed",
              data:{
                producerId:producer.id
              }
            }
  
            send(otherPeer.ws,msg);
  
          })
        })
  
  
        peer.transports.forEach((transportData)=> {
          transportData.transport.close();
        });
  
  
        peer.producers.forEach((producer)=> {
          room.producers.delete(producer.id);
        });
  
        peer.consumers.forEach((consumer)=> {
          room.consumers.delete(consumer.id);
        });
  
        room.peers.delete(peer.peerId);
  
        if(room.peers.size === 0){
          room.router.close();
          rooms.delete(peer.roomId);
  
        }
  
        peer.transports.clear();
        peer.consumers.clear();
        peer.producers.clear();
        
  
      } catch (error) {
        console.log("Error During Peer Cleanup::",error);
      }
    })
  });
};

import { signalingEvents } from "../services/signalingEvents";
import type { Msg } from "../types/Msg.type";

import {
  onRoomCreated,
  onRouterCapabilities,
  onProducerTransportCreated,
  onProducerTransportConnected,
  onConsumerTransportCreated,
  onConsumerTransportConnected,
  onNewProducer,
  onConsumerCreated,
  onProduced,
  onRoomJoined,
  onProducerClosed
} from "./mediasoup";

export async function handleMessage(msg: Msg) {
  if (msg.type === "roomCreated") {
    onRoomCreated();
  } else if (msg.type === "roomJoined") {
    onRoomJoined();
  } else if (msg.type === "routerCapabilities") {
    console.log("routerCapabilities");
    onRouterCapabilities(msg);
  } else if (msg.type === "producerTransportCreated") {
    await onProducerTransportCreated(msg);
  } else if (msg.type === "consumerTransportCreated") {
    onConsumerTransportCreated(msg);
  } else if (msg.type === "producerTransportConnected") {
    onProducerTransportConnected(msg);
  } else if (msg.type === "consumerTransportConnected") {
    onConsumerTransportConnected(msg);
  } else if (msg.type === "produced") {
    onProduced(msg);
  } else if (msg.type === "newProducer") {
    console.log("new producer ran::",msg.data);
    onNewProducer(msg);
  } else if (msg.type === "consumerCreated") {
    onConsumerCreated(msg);
  } else if (msg.type === "producerClosed") {                                        
       onProducerClosed(msg);                                                         
     }    
  else if (msg.type === "error") {
    if (msg.error) {
      signalingEvents.emit("error", msg.error);
    }
  }
}

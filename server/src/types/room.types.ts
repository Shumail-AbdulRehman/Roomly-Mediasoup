import { Consumer, Producer, Router, Worker } from "mediasoup/types";
import { Peer } from "./peer.types.js";

interface RoomProducer{
  peerId:string,
  producer:Producer
}

interface RoomConsumer{
  peerId:string,
  consumer:Consumer
}

export interface Room {
  roomId: string;
  worker: Worker;
  router: Router;
  peers: Map<string, Peer>;
  producers: Map<string,RoomProducer >
  consumers: Map<string, RoomConsumer>
}
import { getRoom } from "../lib/room.js";
import { Msg } from "../types/msg.types.js"
import { Peer } from "../types/peer.types.js"
import send from "../utils/send.js";

export default function onProducerClose(msg:Msg, peer:Peer){

    const producerId=msg.data.producerId;

    const roomId=peer.roomId;

    if(!roomId)return;
    const room=getRoom(roomId);

    if(!room) return;

    const producer=room.producers.get(producerId);

    if(!producer?.producer) return;

            console.log("producer Closed ran",producerId);

    
     const message={
              type:"producerClosed",
              data:{
                producerId:producer.producer.id
              }
            }

            const peers=room.peers;

            peers.forEach((otherPeer)=> {
                if(otherPeer.peerId === peer.peerId) return;

                send(otherPeer.ws,message);
            });
            producer.producer.close();
            room.producers.delete(producer.producer.id);
            peer.producers.delete(producer.producer.id);

}
import { Producer } from "mediasoup/types";
import { Msg } from "../types/msg.types.js";
import { Peer } from "../types/peer.types.js";
import send from "../utils/send.js";
import { broadcast, getRoom } from "../lib/room.js";

async function onProduce(msg:Msg, peer:Peer) {

    const { kind, rtpParameters, transportId, requestId } = msg.data;

    const transportData=peer.transports.get(transportId);

    if(!(transportData?.transport && peer.roomId)) {

        const message= {
            type:"error",
            data:{},
            error:"transport and roomId is required"
        }
        send(peer.ws,message);
        return;
    }

    const room=getRoom(peer.roomId);

    if(!room) {
        const message= {
            type:"error",
            data:{},
            error:"room not found during onProduce"
        }

        send(peer.ws,message);
        return;
    }
    
    let producer:Producer|null=null;
    try {
         producer=await transportData.transport.produce({
            kind,
            rtpParameters
        });
    } catch (error) {
        const message={
            type:"error",
            data:{},
            error:"error while producing"
        }
        send(peer.ws,message);
        return;
    }

    room.producers.set(producer.id,{
        peerId:peer.peerId,
        producer
    });

    peer.producers.set(producer.id,producer);

    const message= {
        type:"produced",
        data:{
            requestId,
            producerId:producer.id,
            transportId:transportData.transport.id
        }
    }


    broadcast(producer.id,peer);
    
    send(peer.ws,message);
    return;
}


export default onProduce;
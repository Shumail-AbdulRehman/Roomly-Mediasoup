import { Msg } from "../types/msg.types.js";
import { Peer } from "../types/peer.types.js";
import send from "../utils/send.js";

async function onResumeConsumer(msg:Msg,peer:Peer) {
    
    const consumerId=msg.data.consumerId;

    if(!consumerId) {

        const message= {
            type:"error",
            data:{},
            error:"consumer Id is required"
        }
        send(peer.ws,message);
        return;
    }

    const consumer=peer.consumers.get(consumerId);

    if(!consumer) {
        const message={
            type:"error",
            data:{},
            error:"consumer not found"
        }

        send(peer.ws,message);
        return;
    }


    if (consumer.closed) {
    send(peer.ws, {
        type: "error",
        data: {},
        error: "consumer is already closed"
    });
    return;
}

try {
    await consumer.resume();
} catch (error) {
    send(peer.ws, {
        type: "error",
        data: {},
        error: "error while resuming consumer"
    });

    console.error("Error while resuming consumer:", error);
    return;
}
    const message={
        type:"consumerResumed",
        data:consumerId
    }
    send(peer.ws,message);
    return;

}


export default onResumeConsumer;
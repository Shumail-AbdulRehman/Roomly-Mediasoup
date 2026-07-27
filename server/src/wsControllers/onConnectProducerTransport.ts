import { Msg } from "../types/msg.types.js";
import { Peer } from "../types/peer.types.js";
import send from "../utils/send.js";

async function onConnectProducerTransport(msg:Msg, peer:Peer) {

    const transportId=msg.data.transportId;
    const dtlsParameters=msg.data.dtlsParameters;

    const transportData=peer.transports.get(transportId);

    if(!(transportData?.transport && dtlsParameters)) {
        const message= {
            type:"error",
            data:{},
            error:"transport and dtlsParameters required"
        }
        send(peer.ws,message);
        return;
    }

    try {
        transportData.transport.connect(dtlsParameters);
    } catch (error) {
        const message={
            type:"error",
            data:{},
            error:"error while connecting to producer transport"
        }
        send(peer.ws,message);
        console.log("error while conecting to producer Transort: ",error);
        return;
    }


    const message= {
        type:"producerTransportConnected",
        data:transportData.transport.id
    }
    send(peer.ws,message);
    return;
}


export default onConnectProducerTransport;
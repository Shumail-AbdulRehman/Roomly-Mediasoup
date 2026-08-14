# Signaling flow

This is the actual message flow I use between the React client and the Node server. It is a bit messy because mediasoup splits the work into many small steps, but that is what makes the transport setup explicit.

```mermaid
sequenceDiagram
    participant A as Client A
    participant S as Server
    participant B as Client B

    Note over A: Step 1: Client gets the router RTP capabilities<br/>and checks that its Device can support them.

    A->>S: getRouterRtpCapabilities
    S-->>A: routerCapabilities { routerRtpCapabilities, roomId }

    Note over A: Step 2: Client creates its own producer transport<br/>using the server transport params.

    A->>S: createProducerTransport
    S-->>A: producerTransportCreated { transportOptions }

    Note over A: Step 3: The transport fires a connect event,<br/>so the client sends its DTLS parameters.

    A->>S: connectProducerTransport { dtlsParameters }
    S-->>A: producerTransportConnected

    Note over A: Step 4: Client actually produces media.

    A->>S: produce { kind, rtpParameters, appData }
    S-->>A: produced { producerId }

    Note over S: Step 5: Server tells other peers a new producer exists.

    S->>B: newProducer { producerId }

    Note over B: Before consuming, B already loaded router caps<br/>and created a recv transport the same way A created its send transport.

    B->>S: createConsumer { producerId, transportId, rtpCapabilities }
    S-->>B: consumerCreated { consumer params }

    Note over B: Step 6: B creates the consumer locally,<br/>then tells the server to resume it.

    B->>S: resumeConsumer { consumerId }
    S-->>B: consumerResumed
```

## What is happening on each side

### Client A (the one producing)

1. Loads the server router RTP capabilities into a mediasoup Device.
2. Creates a send transport.
3. Connects the send transport by sending DTLS parameters.
4. Calls `produce()` for camera and microphone tracks.
5. The server stores the producers and notifies other peers.

### Client B (the one consuming)

1. Does the same router cap check and creates a recv transport.
2. When it receives `newProducer`, it asks to consume that producer.
3. The server creates a consumer on B's recv transport and sends back the params.
4. B calls `recvTransport.consume()` with those params.
5. B resumes the consumer so media starts flowing.

### Server

- Holds one router per room.
- Holds transports, producers, and consumers in Maps per peer.
- Routes messages by type and cleans everything up when a peer disconnects.

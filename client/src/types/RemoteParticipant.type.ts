import type { Consumer } from "mediasoup-client/types";

export type RemoteParticipant = {
  peerId: string;
  audioConsumer?: Consumer;
  cameraConsumer?: Consumer;
  screenConsumer?: Consumer;
};

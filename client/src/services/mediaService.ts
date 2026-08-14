import { type Producer, type Transport, type TransportOptions } from "mediasoup-client/types";

import { Device } from "mediasoup-client";
import { onLeave } from "../lib/mediasoup";
import { getWebsocket } from "../lib/websocket";
import send from "../utils/send";


class MediaService {

  sendTransport:Transport|null=null
  recvTransport:Transport|null=null

  device:Device|null=null

  localStream: MediaStream | null = null;
  screenStream: MediaStream | null = null;

  audioProducer: Producer | null = null;
  videoProducer: Producer | null = null;
  screenProducer: Producer | null = null;

  async init() {
    if (this.localStream) return this.localStream;

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    return this.localStream;
  }

  async produce(
    transport: Transport,
    options: {
      audioEnabled: boolean;
      videoEnabled: boolean;
    },
  ) {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      const videoTrack = this.localStream.getVideoTracks()[0];

      if (audioTrack && !this.audioProducer) {
        this.audioProducer = await transport.produce({
          track: audioTrack,
          appData: {
            type: "audio",
          },
        });

        console.log("audio porducer is::", this.audioProducer);
        if (!options.audioEnabled) {
          this.audioProducer.pause();
          audioTrack.enabled = false;
        }
      }

      if (videoTrack && !this.videoProducer) {
        this.videoProducer = await transport.produce({
          track: videoTrack,
          appData: {
            type: "camera",
          },
        });

        if (!options.videoEnabled) {
          this.videoProducer.pause();
          videoTrack.enabled = false;
        }
      }
    }
  }

  async startScreenSharing(transport: Transport) {
    if (this.screenProducer) return;
    if (!this.screenStream) {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    }

    const screenTrack = this.screenStream.getVideoTracks()[0];

    if (!screenTrack) {
      console.log("no screen track found");
      return;
    }

    this.screenProducer = await transport.produce({
      track: screenTrack,
      appData: {
        type: "screen",
      },
    });

    screenTrack.onended = () => {
      this.stopScreenSharing();
    };

    console.log("Screen producer created:", this.screenProducer);
  }

  stopScreenSharing() {

    const msg={
      type:"producerClose",
      data:{
        producerId:this.screenProducer?.id
      }
    }


    const ws=getWebsocket();

    if(!ws) return;
    send(ws,msg);
    this.screenProducer?.close();
    this.screenProducer = null;

    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.screenStream = null;

    console.log("Screen sharing stopped");
  }

  toggleAudio(enabled: boolean) {
    if (!this.audioProducer) return;
    enabled ? this.audioProducer.resume() : this.audioProducer.pause();
  }

  toggleVideo(enabled: boolean) {
    if (!this.videoProducer) return;
    enabled ? this.videoProducer.resume() : this.videoProducer.pause();
  }

  close() {
    this.audioProducer?.close();
    this.videoProducer?.close();
    this.screenProducer?.close();

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.screenStream?.getTracks().forEach((track) => track.stop());

    this.audioProducer = null;
    this.videoProducer = null;
    this.screenProducer = null;

    this.localStream = null;
    this.screenStream = null;
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.sendTransport=null;
    this.recvTransport=null;
    
    this.device=null;

    onLeave();
  }

  createNewSendTransport (params:TransportOptions) {

    if(!this.device){

      console.log("device not created cant create Transport");
      return;
    }


    this.sendTransport= this.device?.createSendTransport(params);
    return this.sendTransport;

  }


  createNewRecvTransport(params:TransportOptions) {

    if(!this.device){
      console.log("device not created cant create Transport");
      return;
    }

    this.recvTransport=this.device.createRecvTransport(params);

    return this.recvTransport;

  }

  createDevice(){
    if(this.device) return this.device;

    this.device=new Device();
    return this.device;
  }

  getSendTransport() {
  return this.sendTransport;
}

getRecvTransport() {
  return this.recvTransport;
}

getDevice() {
  return this.device;
}

}

export const mediaService = new MediaService();

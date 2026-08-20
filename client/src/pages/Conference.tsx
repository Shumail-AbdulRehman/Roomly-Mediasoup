import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { mediaService } from "../services/mediaService";
import { signalingEvents } from "../services/signalingEvents";
import type { RemoteParticipant } from "../types/RemoteParticipant.type";
import {
  getWebsocket,
  setCurrentRoomId,
  setIntentionalClose,
} from "../lib/websocket";

function Conference() {
  const location = useLocation();
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const {
    audioEnabled = true,
    videoEnabled = true,
    roomId,
  } = location.state || {};

  const [remoteParticipants, setRemoteParticipants] = useState<
    RemoteParticipant[]
  >([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const [isAudioEnabled, setIsAudioEnabled] = useState(audioEnabled);
  const [isVideoEnabled, setIsVideoEnabled] = useState(videoEnabled);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        mediaService.stopScreenSharing();
        setIsScreenSharing(false);
        return;
      }

      const sendTransport = mediaService.getSendTransport();
      if (!sendTransport) return;

      await mediaService.startScreenSharing(sendTransport);
      setIsScreenSharing(true);
    } catch (error) {
      console.error("Screen sharing failed:", error);
    }
  };

  useEffect(() => {
    const handleProducerClosed = ({
      peerId,
      producerId,
    }: {
      peerId: string;
      producerId: string;
    }) => {
      setRemoteParticipants((prev) =>
        prev
          .map((p) => {
            if (p.peerId !== peerId) return p;

            const updated = { ...p };

            if (updated.audioConsumer?.producerId === producerId)
              delete updated.audioConsumer;

            if (updated.cameraConsumer?.producerId === producerId)
              delete updated.cameraConsumer;

            if (updated.screenConsumer?.producerId === producerId)
              delete updated.screenConsumer;

            return updated;
          })
          .filter(
            (p) =>
              p.audioConsumer ||
              p.cameraConsumer ||
              p.screenConsumer
          )
      );
    };

    signalingEvents.on("producer-closed", handleProducerClosed);

    return () => {
      signalingEvents.off("producer-closed", handleProducerClosed);
    };
  }, []);

  useEffect(() => {
    const handleRemoteStream = (remoteParticipant: RemoteParticipant) => {
      console.log("Remote stream received:", remoteParticipant);
      setIsReconnecting(false);

      setRemoteParticipants((prevParticipants) => {
        const existingParticipant = prevParticipants.find(
          (item) => item.peerId === remoteParticipant.peerId
        );

        if (existingParticipant) {
          return prevParticipants.map((item) =>
            item.peerId === remoteParticipant.peerId
              ? {
                  ...existingParticipant,
                  audioConsumer:
                    remoteParticipant.audioConsumer ??
                    existingParticipant.audioConsumer,
                  cameraConsumer:
                    remoteParticipant.cameraConsumer ??
                    existingParticipant.cameraConsumer,
                  screenConsumer:
                    remoteParticipant.screenConsumer ??
                    existingParticipant.screenConsumer,
                }
              : item
          );
        }

        return [...prevParticipants, remoteParticipant];
      });
    };

    signalingEvents.on("remote-stream", handleRemoteStream);

    return () => {
      signalingEvents.off("remote-stream", handleRemoteStream);
    };
  }, []);

  useEffect(() => {
    startCamera();

    return () => {
      mediaService.close();
    };
  }, []);

  useEffect(() => {
    const handleError = (error: string) => {
      setError(error);
      setIsReconnecting(false);
    };

    signalingEvents.on("error", handleError);

    return () => {
      signalingEvents.off("error", handleError);
    };
  }, []);

  useEffect(() => {
    if (roomId) {
      setCurrentRoomId(roomId);
    }

    const handleReconnecting = () => {
      setIsReconnecting(true);
      mediaService.close();
      setRemoteParticipants([]);
      startCamera();
    };

    signalingEvents.on("reconnecting", handleReconnecting);

    return () => {
      setCurrentRoomId(null);
      signalingEvents.off("reconnecting", handleReconnecting);
    };
  }, [roomId]);

  const startCamera = async () => {
    try {
      const stream = await mediaService.init();
      if (!stream) return;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error starting camera:", error);
    }
  };

  const toggleAudio = () => {
    const stream = mediaService.localStream;
    if (!stream) return;

    const track = stream.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setIsAudioEnabled(track.enabled);
    mediaService.toggleAudio(track.enabled);
  };

  const toggleVideo = () => {
    const stream = mediaService.localStream;
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setIsVideoEnabled(track.enabled);
    mediaService.toggleVideo(track.enabled);
  };

  const leaveCall = () => {
    setIntentionalClose(true);
    setCurrentRoomId(null);
    getWebsocket()?.close();
    mediaService.close();
    setRemoteParticipants([]);
    navigate("/home");
  };

  const copyRoomId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enterFullscreen = (peerId: string) => {
    const video = screenVideoRefs.current.get(peerId);
    if (video?.requestFullscreen) {
      video.requestFullscreen().catch((err) => {
        console.error("Fullscreen failed:", err);
      });
    }
  };

  const videoAudioStreams = remoteParticipants.map((p) => {
    const stream = new MediaStream();

    if (p.cameraConsumer?.track) {
      stream.addTrack(p.cameraConsumer.track);
    }

    if (p.audioConsumer?.track) {
      stream.addTrack(p.audioConsumer.track);
    }

    return { peerId: p.peerId, stream, hasVideo: !!p.cameraConsumer?.track };
  });

  const screenStreams = remoteParticipants
    .filter((p) => p.screenConsumer?.track)
    .map((p) => ({
      peerId: `${p.peerId}-screen`,
      ownerPeerId: p.peerId,
      stream: new MediaStream([p.screenConsumer!.track]),
    }));

  const gridClass =
    videoAudioStreams.length <= 1
      ? "grid-cols-1"
      : videoAudioStreams.length <= 4
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-2 md:grid-cols-3";

  const shortPeerId = (id: string) => id.slice(0, 6).toUpperCase();

  const isScreenShareActive = screenStreams.length > 0;

  return (
    <div className="h-screen bg-canvas text-ink font-sans relative overflow-hidden">
      {/* Top pill */}
      {roomId && (
        <div className="absolute top-4 sm:top-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-full bg-surface/90 border border-border backdrop-blur-md max-w-[92vw]">
          <div className="overflow-x-auto max-w-[60vw] sm:max-w-none">
            <span className="text-[11px] sm:text-xs text-ink whitespace-nowrap">{roomId}</span>
          </div>
          <button
            onClick={copyRoomId}
            aria-label="Copy room ID"
            className="flex items-center justify-center transition-opacity hover:opacity-80 active:scale-95"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-waveform-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-tally-red/10 border border-tally-red/20 text-tally-red text-xs text-center">
          {error}
        </div>
      )}

      {isReconnecting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas/80 backdrop-blur-sm">
          <svg className="animate-spin h-8 w-8 text-waveform-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-muted text-sm font-medium">Reconnecting...</span>
        </div>
      )}

      {/* Stage */}
      <div className="absolute inset-0 pt-20 pb-28 px-4 overflow-hidden">
        {isScreenShareActive ? (
          <div className="flex flex-col md:flex-row gap-4 h-full">
            {/* Left: screen share */}
            <div className="h-[55%] md:h-auto md:flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
              {screenStreams.map(({ peerId, ownerPeerId: _ownerPeerId, stream }) => (
                <div
                  key={peerId}
                  className="relative flex-1 rounded-2xl overflow-hidden bg-surface border border-waveform-green/20 shadow-lg shadow-black/20 group"
                >
                  <video
                    autoPlay
                    playsInline
                    ref={(element) => {
                      if (element) {
                        element.srcObject = stream;
                        screenVideoRefs.current.set(peerId, element);
                      } else {
                        screenVideoRefs.current.delete(peerId);
                      }
                    }}
                    className="w-full h-full object-contain bg-black cursor-pointer"
                    onDoubleClick={() => enterFullscreen(peerId)}
                  />
                  {/* <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-vu-amber/10 border border-vu-amber/20 backdrop-blur-sm">
                    <span className="text-vu-amber text-[10px] font-medium uppercase tracking-wider">
                      Screen - Guest {shortPeerId(ownerPeerId)}
                    </span>
                  </div> */}

                  <button
                    onClick={() => enterFullscreen(peerId)}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-ink border border-border opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Fullscreen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Right sidebar: participant cameras */}
            <div className="h-[45%] md:h-auto md:w-[30%] grid grid-cols-2 md:flex md:flex-col gap-3 overflow-y-auto md:overflow-y-auto overflow-x-hidden shrink-0 pb-1 md:pb-0 pr-0 md:pr-1">
              {videoAudioStreams.map(({ peerId, stream, hasVideo }) => (
                <div
                  key={peerId}
                  className={`relative w-full aspect-video md:aspect-[4/3] rounded-xl overflow-hidden bg-surface shadow-lg shadow-black/20 ${
                    hasVideo ? "border border-waveform-green/20" : "border border-border"
                  }`}
                >
                  {hasVideo ? (
                    <video
                      autoPlay
                      playsInline
                      ref={(element) => {
                        if (element) {
                          element.srcObject = stream;
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-surface-highlight border border-border flex items-center justify-center">
                        <span className="text-base font-medium text-ink">
                          {shortPeerId(peerId).slice(0, 2)}
                        </span>
                      </div>
                      <span className="text-muted text-xs">Audio only</span>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                    <span className="text-ink text-[11px] font-medium">
                      Guest {shortPeerId(peerId)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`w-full h-full grid ${gridClass} gap-4 auto-rows-fr transition-all duration-300`}>
            {videoAudioStreams.map(({ peerId, stream, hasVideo }) => (
              <div
                key={peerId}
                className={`relative rounded-2xl overflow-hidden bg-surface shadow-lg shadow-black/20 group transition-colors duration-300 ${
                  hasVideo ? "border border-waveform-green/20" : "border border-border"
                }`}
              >
                {hasVideo ? (
                  <video
                    autoPlay
                    playsInline
                    ref={(element) => {
                      if (element) {
                        element.srcObject = stream;
                      }
                    }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-surface-highlight border border-border flex items-center justify-center">
                      <span className="text-xl font-medium text-ink">
                        {shortPeerId(peerId).slice(0, 2)}
                      </span>
                    </div>
                    <span className="text-muted text-sm">Audio only</span>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                  <span className="text-ink text-xs font-medium">
                    Guest {shortPeerId(peerId)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {videoAudioStreams.length === 0 && !isScreenShareActive && (
          <div className="absolute bottom-28 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none">
            <p className="text-muted text-sm font-normal">Waiting for others</p>
            <p className="text-muted/60 text-xs">Share the room ID to invite someone</p>
          </div>
        )}

        {/* Self View */}
        <div className="absolute top-16 right-3 z-10 sm:bottom-24 sm:right-5 sm:top-auto">
          <div className={`rounded-2xl ${isVideoEnabled ? "live-ring" : "live-ring live-ring-muted"}`}>
            <div className="relative w-20 h-14 sm:w-44 sm:h-28 rounded-2xl overflow-hidden bg-surface border border-border">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-canvas flex items-center justify-center">
                  <span className="text-muted text-xs">Camera off</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-canvas/70 border border-border/50">
                <span className="text-ink text-[10px] font-medium">You</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls dock */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-2xl bg-surface/90 border border-border backdrop-blur-md">
        {/* Mic */}
        <button
          onClick={toggleAudio}
          className={`h-10 sm:h-11 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 ${
            isAudioEnabled
              ? "bg-surface-highlight border border-border text-ink"
              : "bg-transparent border border-border text-muted hover:bg-surface-highlight hover:text-ink"
          }`}
          title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {isAudioEnabled && <span className="w-1.5 h-1.5 rounded-full bg-waveform-green"></span>}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isAudioEnabled ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
            ) : (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </>
            )}
          </svg>
          <span className="text-xs font-medium hidden sm:inline">{isAudioEnabled ? "Mute" : "Unmute"}</span>
        </button>

        {/* Camera */}
        <button
          onClick={toggleVideo}
          className={`h-10 sm:h-11 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 ${
            isVideoEnabled
              ? "bg-surface-highlight border border-border text-ink"
              : "bg-transparent border border-border text-muted hover:bg-surface-highlight hover:text-ink"
          }`}
          title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoEnabled && <span className="w-1.5 h-1.5 rounded-full bg-waveform-green"></span>}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isVideoEnabled ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            )}
          </svg>
          <span className="text-xs font-medium hidden sm:inline">Camera</span>
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          className={`h-10 sm:h-11 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 ${
            isScreenSharing
              ? "bg-surface-highlight border border-vu-amber/30 text-vu-amber"
              : "bg-transparent border border-border text-muted hover:bg-surface-highlight hover:text-ink"
          }`}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          {isScreenSharing && <span className="w-1.5 h-1.5 rounded-full bg-vu-amber"></span>}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium hidden sm:inline">{isScreenSharing ? "Sharing" : "Share"}</span>
        </button>

        <div className="w-px h-6 bg-border mx-1"></div>

        {/* Leave */}
        <button
          onClick={leaveCall}
          className="h-10 sm:h-11 px-3 sm:px-4 rounded-full bg-tally-red hover:bg-peak-red text-white text-xs font-medium transition-all duration-200 flex items-center gap-2 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </div>
  );
}

export default Conference;

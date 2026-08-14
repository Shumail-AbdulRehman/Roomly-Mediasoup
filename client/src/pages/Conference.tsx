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

      const sendTransport =mediaService.getSendTransport();
      if (!sendTransport) return;

      await mediaService.startScreenSharing(sendTransport);
      setIsScreenSharing(true);
    } catch (error) {
      console.error("Screen sharing failed:", error);
    }
  };


  useEffect(()=> {


    const handleProducerClosed=({peerId,producerId}:{peerId:string,producerId:string})=> {

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
    }

    signalingEvents.on("producer-closed",handleProducerClosed);


    return()=> {
      signalingEvents.off("producer-closed",handleProducerClosed);
    }
  },[]);


  useEffect(() => {
    const handleRemoteStream = (remoteParticipant: RemoteParticipant) => {
      console.log("Remote stream received:", remoteParticipant);
      setIsReconnecting(false);

      setRemoteParticipants((prevParticipants) => {
        const existingParticipant = prevParticipants.find(
          (item) => item.peerId === remoteParticipant.peerId,
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
              : item,
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

  const participantCount = videoAudioStreams.length + 1;

  const gridClass =
    videoAudioStreams.length <= 1
      ? "grid-cols-1"
      : videoAudioStreams.length <= 4
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-2 md:grid-cols-3";

  const shortPeerId = (id: string) => id.slice(0, 6).toUpperCase();

  const isScreenShareActive = screenStreams.length > 0;

  return (
    <div className="h-screen bg-[#0a0a0c] flex flex-col overflow-hidden font-['Manrope'] text-stone-100">
      {/* Top Bar */}
      <div className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-white/[0.06] bg-[#0a0a0c]/80 backdrop-blur-md z-20">
        {roomId && (
          <button
            onClick={copyRoomId}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition-all duration-200 group"
          >
            <span className="text-stone-400 text-xs ">
              {roomId.slice(0, 8)}...{roomId.slice(-4)}
            </span>
            <span className="text-[10px] text-stone-500 group-hover:text-amber-400 transition-colors font-medium uppercase tracking-wider">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-stone-500 text-xs ">
            {participantCount} in call
          </span>
        </div>
      </div>

      {error && (
        <div className="shrink-0 px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs text-center">
          {error}
        </div>
      )}

      {isReconnecting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0a0a0c]/80 backdrop-blur-sm">
          <svg
            className="animate-spin h-8 w-8 text-amber-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-stone-400 text-sm font-medium">
            Reconnecting...
          </span>
        </div>
      )}

      {/* Stage */}
      <div className="flex-1 relative p-4 overflow-hidden">
        {isScreenShareActive ? (
          <div className="flex flex-col md:flex-row gap-4 h-full">
            {/* Left: screen share */}
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
              {screenStreams.map(({ peerId, ownerPeerId, stream }) => (
                <div
                  key={peerId}
                  className="relative flex-1 rounded-2xl overflow-hidden bg-[#141416] border border-amber-500/20 shadow-2xl shadow-black/40 group"
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
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
                    <span className="text-amber-400 text-[10px]  font-medium uppercase tracking-wider">
                      Screen — Guest {shortPeerId(ownerPeerId)}
                    </span>
                  </div>

                  <button
                    onClick={() => enterFullscreen(peerId)}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-stone-200 border border-white/[0.08] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Fullscreen"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Right sidebar: participant cameras */}
            <div className="w-full md:w-[30%] flex flex-row md:flex-col gap-3 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden shrink-0 pb-1 md:pb-0 pr-0 md:pr-1">
              {videoAudioStreams.map(({ peerId, stream, hasVideo }) => (
                <div
                  key={peerId}
                  className="relative shrink-0 w-40 md:w-full aspect-video md:aspect-[4/3] rounded-xl overflow-hidden bg-[#141416] border border-white/[0.06] shadow-xl shadow-black/40"
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
                      <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                        <span className="text-lg font-medium text-stone-300">
                          {shortPeerId(peerId).slice(0, 2)}
                        </span>
                      </div>
                      <span className="text-stone-500 text-xs ">
                        Audio only
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                    <span className="text-stone-100 text-[11px] font-medium tracking-wide">
                      Guest {shortPeerId(peerId)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className={`w-full h-full grid ${gridClass} gap-4 auto-rows-fr transition-all duration-300`}
          >
            {videoAudioStreams.map(({ peerId, stream, hasVideo }) => (
              <div
                key={peerId}
                className="relative rounded-2xl overflow-hidden bg-[#141416] border border-white/[0.06] shadow-2xl shadow-black/40 group"
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
                    <div className="w-20 h-20 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                      <span className="text-2xl font-medium text-stone-300">
                        {shortPeerId(peerId).slice(0, 2)}
                      </span>
                    </div>
                    <span className="text-stone-500 text-sm ">Audio only</span>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                  <span className="text-stone-100 text-xs font-medium tracking-wide">
                    Guest {shortPeerId(peerId)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {videoAudioStreams.length === 0 && !isScreenShareActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none">
            <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
              <svg
                className="w-9 h-9 text-stone-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <p className="text-stone-300 text-base font-medium">
                Waiting for others
              </p>
              <p className="text-stone-500 text-sm">
                Share the room ID to invite someone
              </p>
            </div>
            {roomId && (
              <button
                onClick={copyRoomId}
                className="pointer-events-auto mt-2 px-5 py-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-400 text-sm font-medium transition-colors"
              >
                {copied ? "Copied to clipboard" : "Copy room ID"}
              </button>
            )}
          </div>
        )}

        {/* Self View */}
        <div className="absolute bottom-5 right-5 z-10">
          <div className="relative w-44 h-28 rounded-xl overflow-hidden bg-[#141416] border border-white/[0.08] shadow-2xl shadow-black/50 transition-transform duration-200 hover:scale-[1.02]">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-[#141416] flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-lg text-stone-400">
                  You
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm">
              <span className="text-stone-300 text-[10px]  font-medium">
                You
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="h-20 shrink-0 flex items-center justify-center gap-3 border-t border-white/[0.06] bg-[#0a0a0c]/90 backdrop-blur-md px-4">
        {/* Mic */}
        <button
          onClick={toggleAudio}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
            isAudioEnabled
              ? "bg-white/[0.06] hover:bg-white/[0.10] text-stone-200 border border-white/[0.08]"
              : "bg-red-500/15 hover:bg-red-500/20 text-red-400 border border-red-500/25"
          }`}
          title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {isAudioEnabled ? (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
              />
            </svg>
          )}
        </button>

        {/* Camera */}
        <button
          onClick={toggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
            isVideoEnabled
              ? "bg-white/[0.06] hover:bg-white/[0.10] text-stone-200 border border-white/[0.08]"
              : "bg-red-500/15 hover:bg-red-500/20 text-red-400 border border-red-500/25"
          }`}
          title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoEnabled ? (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          )}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
            isScreenSharing
              ? "bg-amber-500/15 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_16px_-4px_rgba(245,158,11,0.3)]"
              : "bg-white/[0.06] hover:bg-white/[0.10] text-stone-200 border border-white/[0.08]"
          }`}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </button>

        <div className="w-px h-8 bg-white/[0.08] mx-1" />

        {/* Leave */}
        <button
          onClick={leaveCall}
          className="h-11 px-5 rounded-full bg-red-500/90 hover:bg-red-600 text-white font-medium text-sm transition-all duration-200 flex items-center gap-2 shadow-lg shadow-red-500/10"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
            />
          </svg>
          Leave
        </button>
      </div>
    </div>
  );
}

export default Conference;

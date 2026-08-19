# Home Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `client/src/pages/Home.tsx` as a polished, two-pane lobby that matches the approved design spec while fixing related lifecycle and UX bugs.

**Architecture:** Keep the existing lazy WebSocket connection and media-service flow. Replace only the UI layer of `Home.tsx` with a full-height split layout (left form + right preview). Preserve Redux dispatches to avoid scope creep, but rely on local React state for UI.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vite, mediasoup-client.

---

## File Structure

- **Modify:** `client/src/pages/Home.tsx` — complete UI rewrite + behavior fixes.
- **No new files needed.** Theme tokens already exist in `client/src/index.css`.

---

## Task 1: Rewrite Home.tsx with the new two-pane layout

**Files:**
- Modify: `client/src/pages/Home.tsx`

### Step 1: Replace imports and component scaffold

Replace the entire contents of `client/src/pages/Home.tsx` with this scaffold:

```tsx
import { useEffect, useRef, useState } from "react";
import send from "../utils/send";
import { connectWebSocket } from "../lib/websocket";
import { useNavigate } from "react-router-dom";
import { mediaService } from "../services/mediaService";
import { useDispatch } from "react-redux";
import { setAudio, setVideo } from "../store/mediaSlice";
import type { AppDispatch } from "../store/store";
import { signalingEvents } from "../services/signalingEvents";

function Home() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const [roomId, setRoomId] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const isJoiningRef = useRef(false);

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans">
      {/* content goes here */}
    </div>
  );
}

export default Home;
```

### Step 2: Add camera initialization and cleanup effect

Inside the component, add this effect:

```tsx
useEffect(() => {
  let mounted = true;

  const startCamera = async () => {
    try {
      const stream = await mediaService.init();
      if (!mounted || !stream) return;

      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      if (hasVideo) {
        setVideoEnabled(true);
        dispatch(setVideo(true));
      }
      if (hasAudio) {
        setAudioEnabled(true);
        dispatch(setAudio(true));
      }

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error starting camera:", err);
      setError("Could not access camera or microphone.");
    }
  };

  startCamera();

  return () => {
    mounted = false;
    localStream?.getTracks().forEach((track) => track.stop());
  };
}, [dispatch]);
```

### Step 3: Add the join-navigation effect

```tsx
useEffect(() => {
  const handleRoomJoin = (data: string) => {
    setLoading(false);
    isJoiningRef.current = false;
    navigate("/conference", {
      state: {
        videoEnabled,
        audioEnabled,
        roomId: data,
      },
    });
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setLoading(false);
    isJoiningRef.current = false;
  };

  signalingEvents.on("enter-conference", handleRoomJoin);
  signalingEvents.on("error", handleError);

  return () => {
    signalingEvents.off("enter-conference", handleRoomJoin);
    signalingEvents.off("error", handleError);
  };
}, [navigate, audioEnabled, videoEnabled]);
```

### Step 4: Add toggle handlers

```tsx
const toggleAudio = () => {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (!track) return;

  track.enabled = !track.enabled;
  setAudioEnabled(track.enabled);
  dispatch(setAudio(track.enabled));
  mediaService.toggleAudio(track.enabled);
};

const toggleVideo = () => {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (!track) return;

  track.enabled = !track.enabled;
  setVideoEnabled(track.enabled);
  dispatch(setVideo(track.enabled));
  mediaService.toggleVideo(track.enabled);
};
```

### Step 5: Add join/create handlers with validation and rapid-click guard

```tsx
const handleJoinRoom = async () => {
  if (isJoiningRef.current || loading) return;

  const trimmed = roomId.trim();
  if (!trimmed) {
    setError("Please enter a room ID");
    return;
  }

  setError(null);
  setLoading(true);
  isJoiningRef.current = true;

  try {
    const ws = await connectWebSocket();
    send(ws, {
      type: "joinRoom",
      data: { roomId: trimmed },
    });
  } catch {
    setLoading(false);
    isJoiningRef.current = false;
    setError("Could not connect to server.");
  }
};

const handleCreateRoom = async () => {
  if (isJoiningRef.current || loading) return;

  setError(null);
  setLoading(true);
  isJoiningRef.current = true;

  try {
    const ws = await connectWebSocket();
    send(ws, { type: "createRoom" });
  } catch {
    setLoading(false);
    isJoiningRef.current = false;
    setError("Could not connect to server.");
  }
};
```

### Step 6: Add the JSX layout

Replace the `return` placeholder with this full layout:

```tsx
return (
  <div className="min-h-screen bg-canvas text-ink font-sans flex flex-col lg:flex-row">
    {/* Left pane */}
    <div className="relative w-full lg:w-[45%] flex flex-col p-8 lg:p-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Roomly
        </h1>
        <p className="text-sm text-muted mt-1">
          Multi-party video calls, simplified
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto lg:mx-0 w-full">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-tally-red/10 border border-tally-red/20 text-tally-red text-sm">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-ink placeholder-muted outline-none focus:border-waveform-green/40 focus:bg-surface-highlight transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        />

        <button
          onClick={handleJoinRoom}
          disabled={loading}
          className="w-full mt-4 py-3 rounded-xl bg-surface-highlight border border-border text-ink font-medium transition-all duration-200 hover:bg-white/[0.06] hover:border-waveform-green/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 relative overflow-hidden group"
        >
          <span className="absolute inset-x-0 top-0 h-px bg-waveform-green/0 group-hover:bg-waveform-green/60 transition-colors" />
          Join room
        </button>

        <div className="relative flex items-center gap-4 py-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-muted text-xs font-medium uppercase tracking-wider">
            or
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleCreateRoom}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-transparent border border-border text-ink font-medium transition-all duration-200 hover:bg-white/[0.04] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Create new room
        </button>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto lg:mx-0 w-full mt-8 lg:mt-0">
        <button
          onClick={toggleVideo}
          disabled={!localStream || loading}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all duration-200 active:scale-[0.98] disabled:opacity-50 ${
            videoEnabled
              ? "bg-surface border-border text-ink"
              : "bg-tally-red/10 border-tally-red/25 text-tally-red"
          }`}
        >
          {videoEnabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-waveform-green" />
          )}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {videoEnabled ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            )}
          </svg>
          <span className="text-sm font-medium">
            {videoEnabled ? "Camera on" : "Camera off"}
          </span>
        </button>

        <button
          onClick={toggleAudio}
          disabled={!localStream || loading}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all duration-200 active:scale-[0.98] disabled:opacity-50 ${
            audioEnabled
              ? "bg-surface border-border text-ink"
              : "bg-tally-red/10 border-tally-red/25 text-tally-red"
          }`}
        >
          {audioEnabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-waveform-green" />
          )}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {audioEnabled ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"
              />
            ) : (
              <>
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
              </>
            )}
          </svg>
          <span className="text-sm font-medium">
            {audioEnabled ? "Mic on" : "Mic off"}
          </span>
        </button>
      </div>
    </div>

    {/* Right pane */}
    <div className="hidden lg:flex w-full lg:w-[55%] items-center justify-center p-12 border-l border-border bg-canvas">
      <div className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden bg-surface border border-border">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${videoEnabled ? "scale-x-[-1]" : "hidden"}`}
        />
        {!videoEnabled && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-muted text-sm">Camera off</span>
          </div>
        )}
      </div>
    </div>

    {/* Loading overlay */}
    {loading && (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas/80 backdrop-blur-sm">
        <svg
          className="animate-spin h-8 w-8 text-waveform-green"
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
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-muted text-sm font-medium">Joining...</span>
      </div>
    )}
  </div>
);
```

### Step 7: Run TypeScript check

```bash
cd /home/shumail/mediasoup-on-my-own/client
npx tsc -b --noEmit
```

Expected: no errors.

### Step 8: Run ESLint

```bash
cd /home/shumail/mediasoup-on-my-own/client
npm run lint
```

Expected: no errors (or only pre-existing warnings outside `Home.tsx`).

---

## Task 2: Manual verification checklist

**Files:**
- Verify: `client/src/pages/Home.tsx`

### Step 1: Visual/layout checks

- [ ] Page renders as two-pane on desktop (left form, right preview).
- [ ] On mobile/tablet, form stacks and preview hides or moves below.
- [ ] `Roomly` wordmark and tagline appear top-left.
- [ ] Input, Join button, divider, Create button match the design.
- [ ] Camera/Mic toggles sit at the bottom of the left pane.
- [ ] Preview card is large, centered, rounded, with subtle border.
- [ ] Camera off shows centered `Camera off` text.
- [ ] Camera on shows mirrored local video feed.

### Step 2: Interaction checks

- [ ] Typing in the room ID input updates the value.
- [ ] Clicking `Join room` without a room ID shows inline error, does not connect.
- [ ] Clicking `Join room` with a valid ID shows loading overlay and sends `joinRoom`.
- [ ] Clicking `Create new room` shows loading overlay and sends `createRoom`.
- [ ] Buttons/input are disabled while loading.
- [ ] Rapid clicks on Join/Create do not spawn multiple WebSockets.
- [ ] Toggling camera/mic while joining does **not** hide the loading overlay.
- [ ] Camera and mic toggle states update visually and functionally.

### Step 3: Lifecycle checks

- [ ] `Home.tsx` does **not** stop the local camera stream on unmount (the stream is cached by `mediaService` and reused by `Conference.tsx`).
- [ ] Successful join navigates to `/conference` with `roomId`, `audioEnabled`, `videoEnabled` in state.
- [ ] Server `error` messages clear the loading overlay and show the error banner.
- [ ] Toggling camera/mic while on Home does not re-subscribe signaling event listeners.
- [ ] Join/Create handlers do not update state after the component unmounts.

---

## Self-Review Checklist

- [ ] **Spec coverage:** two-pane layout, left form, right preview, Studio Console accents, loading overlay, inline error, camera cleanup, rapid-click guard — all covered.
- [ ] **No placeholders:** all code provided, no TODO/TBD.
- [ ] **Type consistency:** `loading`, `error`, `audioEnabled`, `videoEnabled`, `localStream`, `roomId` types are consistent across effects and handlers.
- [ ] **No scope creep:** Redux left in place; Conference page untouched; environment config unchanged.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-19-home-page-redesign.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach would you like?


---

## Post-Implementation Notes

During code-quality review, the following corrections were applied to the initial implementation:

1. **Stream cleanup removed from `Home.tsx` unmount.** `mediaService.init()` caches the local stream, which `Conference.tsx` reuses after navigation. Stopping tracks on `Home` unmount would break the in-call camera. Cleanup remains in `Conference.tsx` via `mediaService.close()`.
2. **Signaling listener effect stabilized.** `audioEnabled`/`videoEnabled` were removed from the dependency array; refs now provide current toggle values to the `enter-conference` handler.
3. **Unmount guards added to async join/create handlers.** A `mountedRef` prevents `setState`/`send` after the component unmounts.
4. **Accessibility improvements.** Added an explicit `<label>` for the room ID input, `aria-pressed` + `aria-label` on toggle buttons, and live-region roles for error and loading overlays.
5. **ESLint disable removed.** The `react-hooks/exhaustive-deps` disable became unnecessary once the stale-closure cleanup was corrected.

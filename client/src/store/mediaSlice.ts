import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

const initialState: MediaState = {
  audioEnabled: true,
  videoEnabled: true,
};

const mediaSlice = createSlice({
  name: "media",
  initialState,
  reducers: {
    setAudio: (state: MediaState, action: PayloadAction<boolean>) => {
      state.audioEnabled = action.payload;
    },

    setVideo: (state: MediaState, action: PayloadAction<boolean>) => {
      state.videoEnabled = action.payload;
    },

    setMediaState: (state: MediaState, action: PayloadAction<MediaState>) => {
      state.audioEnabled = action.payload.audioEnabled;
      state.videoEnabled = action.payload.videoEnabled;
    },
  },
});

export const { setAudio, setVideo, setMediaState } = mediaSlice.actions;

export default mediaSlice.reducer;

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

export interface PlantInfo {
  id: number;
  name: string;
  entity_id?: number;
}

export interface UserShift {
  id: number | null;
  name: string;
  start_time: string;
  end_time: string;
  grace_time: number;
  working_hours: number;
  is_night_shift: boolean;
  effective_from: string | null;
  effective_to: string | null;
}

export interface RmcUser {
  id: number;
  name: string;
  email: string;
  personnel_id: number | null;
  mobile: string | null;
  shift?: UserShift | null;
}

export interface RmcAuthState {
  user: RmcUser | null;
  user_id: number | null;
  shift: UserShift | null;
  working_hours: number | null;
  token: string | null;
  token_type: string | null;
  expires_at?: string | null;
  plants: PlantInfo[];
  plant_id: number | null;
  plant_name: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  isCheckedIn: boolean;
  checkInTime: string | null;
  checkInTimestamp: number | null;
  attendanceId: number | null;
}

const initialState: RmcAuthState = {
  user: null,
  user_id: null,
  shift: null,
  working_hours: null,
  token: null,
  token_type: null,
  expires_at: null,
  plants: [],
  plant_id: null,
  plant_name: null,
  isLoading: false,
  isError: false,
  errorMessage: "",
  isCheckedIn: false,
  checkInTime: null,
  checkInTimestamp: null,
  attendanceId: null,
};

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (
    payload: {
      email?: string;
      password?: string;
    },
    thunkAPI,
  ) => {
    try {
      const res = await axios.post(
        `https://curie.modormc.com/api/mobile/v1/auth/login`,
        {
          email: payload.email,
          password: payload.password,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      const responseData = res.data;

      if (responseData?.success && responseData?.data?.token) {
        await AsyncStorage.setItem("user_rmc", JSON.stringify(responseData.data));
        return responseData.data;
      }
      return thunkAPI.rejectWithValue(
        responseData?.message || "Invalid RMC Login",
      );
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "RMC Login Failed";
      return thunkAPI.rejectWithValue(message);
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    resetRmcAuth: (state) => {
      state.user = null;
      state.user_id = null;
      state.shift = null;
      state.working_hours = null;
      state.token = null;
      state.token_type = null;
      state.expires_at = null;
      state.plants = [];
      state.plant_id = null;
      state.plant_name = null;
      state.isLoading = false;
      state.isError = false;
      state.errorMessage = "";
      state.isCheckedIn = false;
      state.checkInTime = null;
      state.checkInTimestamp = null;
      state.attendanceId = null;
      AsyncStorage.removeItem("user_rmc").catch((err) =>
        console.log("Error removing user_rmc from storage", err),
      );
      AsyncStorage.removeItem("rmc_attendance").catch((err) =>
        console.log("Error removing rmc_attendance from storage", err),
      );
    },
    setAttendanceState: (
      state,
      action: PayloadAction<{
        isCheckedIn: boolean;
        checkInTime?: string | null;
        checkInTimestamp?: number | null;
        attendanceId?: number | null;
      }>,
    ) => {
      state.isCheckedIn = action.payload.isCheckedIn;
      state.checkInTime = action.payload.checkInTime ?? null;
      state.checkInTimestamp = action.payload.checkInTimestamp ?? null;
      state.attendanceId = action.payload.attendanceId ?? null;
    },
    setCheckInSuccess: (
      state,
      action: PayloadAction<{
        timestamp?: number;
        timeStr?: string;
        attendanceId?: number | null;
      }>,
    ) => {
      state.isCheckedIn = true;
      state.checkInTimestamp = action.payload.timestamp || Date.now();
      state.checkInTime = action.payload.timeStr || new Date().toISOString();
      state.attendanceId = action.payload.attendanceId ?? null;
    },
    setCheckOutSuccess: (state) => {
      state.isCheckedIn = false;
      state.checkInTimestamp = null;
      state.checkInTime = null;
      state.attendanceId = null;
    },
    setSelectedPlant: (
      state,
      action: PayloadAction<{ id: number; name: string }>,
    ) => {
      state.plant_id = action.payload.id;
      state.plant_name = action.payload.name;
    },
    setSeletedPlant: (
      state,
      action: PayloadAction<{ id: number; name: string }>,
    ) => {
      state.plant_id = action.payload.id;
      state.plant_name = action.payload.name;
    },
    setRmcUserFromStorage: (state, action) => {
      const userData = action.payload;
      if (userData) {
        state.user = userData.user || null;
        state.user_id = userData.user?.id || null;
        state.shift = userData.user?.shift || userData.shift || null;
        state.working_hours =
          userData.user?.shift?.working_hours ??
          userData.shift?.working_hours ??
          state.working_hours ??
          null;
        state.token = userData.token || null;
        state.token_type = userData.token_type || null;
        state.expires_at = userData.expires_at || null;

        const lastPlantId = state.plant_id;
        const plants: PlantInfo[] =
          userData?.plants || userData?.user?.plants || [];
        state.plants = plants;

        const foundPlant = plants.find((p) => p.id === lastPlantId);
        const plant = foundPlant || plants[0];

        state.plant_name = (plant as any)?.name || (plant as any)?.plant_name || "No Plant";
        state.plant_id = plant?.id || null;
      }
    },
    updateUser: (
      state,
      action: PayloadAction<Partial<RmcUser> & { username?: string }>,
    ) => {
      if (state.user) {
        const updateUser = {
          ...state.user,
          ...action.payload,
          name:
            action.payload.username || action.payload.name || state.user.name,
        };
        state.user = updateUser;
        if (updateUser.id !== undefined && updateUser.id !== null) {
          state.user_id = updateUser.id;
        }
        AsyncStorage.getItem("user_rmc")
          .then((stored) => {
            if (stored) {
              const parsed = JSON.parse(stored);
              parsed.user = { ...parsed.user, ...updateUser };
              AsyncStorage.setItem("user_rmc", JSON.stringify(parsed));
            }
          })
          .catch((err) => console.log("error updating user in storage", err));
      }
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.errorMessage = "";
      })
      .addCase(loginUser.fulfilled, (state, action: any) => {
        state.isLoading = false;
        state.isError = false;
        state.errorMessage = "";
        state.user = action.payload.user;
        state.user_id = action.payload?.user?.id || null;
        state.shift = action.payload?.user?.shift || action.payload?.shift || null;
        state.working_hours =
          action.payload?.user?.shift?.working_hours ??
          action.payload?.shift?.working_hours ??
          (action.payload?.user?.shift?.working_hours === 0 ? 0 : 10);
        state.token = action.payload.token;
        state.token_type = action.payload.token_type;
        state.expires_at = action.payload.expires_at || null;

        const lastPlantId = state.plant_id;
        const plants: PlantInfo[] =
          action.payload?.plants || action.payload?.user?.plants || [];
        state.plants = plants;

        const foundPlant = plants.find((p) => p.id === lastPlantId);
        const plant = foundPlant || plants[0];

        state.plant_name = (plant as any)?.name || (plant as any)?.plant_name || "No Plant";
        state.plant_id = plant?.id || null;
      })
      .addCase(loginUser.rejected, (state, action: any) => {
        state.isLoading = false;
        state.isError = true;
        state.errorMessage =
          typeof action.payload === "string"
            ? action.payload
            : "RMC Login Failed";
      });
  },
});

export const {
  resetRmcAuth,
  setAttendanceState,
  setCheckInSuccess,
  setCheckOutSuccess,
  setSelectedPlant,
  setSeletedPlant,
  setRmcUserFromStorage,
  updateUser,
} = authSlice.actions;

export const selectAuth = (state: { auth: RmcAuthState }) => state?.auth;
export const selectUser = (state: { auth: RmcAuthState }) => state?.auth?.user;
export const selectShift = (state: { auth: RmcAuthState }) => state?.auth?.shift;
export const selectWorkingHours = (state: { auth: RmcAuthState }) =>
  state?.auth?.working_hours;
export const selectIsCheckedIn = (state: { auth: RmcAuthState }) =>
  state?.auth?.isCheckedIn ?? false;
export const selectCheckInTime = (state: { auth: RmcAuthState }) =>
  state?.auth?.checkInTime ?? null;
export const selectCheckInTimestamp = (state: { auth: RmcAuthState }) =>
  state?.auth?.checkInTimestamp ?? null;
export const selectAttendanceId = (state: { auth: RmcAuthState }) =>
  state?.auth?.attendanceId ?? null;

export default authSlice.reducer;

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

export interface PlantInfo {
  id: number;
  name: string;
  entity_id?: number;
}

export interface RmcUser {
  id: number;
  name: string;
  email: string;
  personnel_id: number;
  mobile: string;
}

export interface RmcAuthState {
  user: RmcUser | null;
  token: string | null;
  token_type: string | null;
  plants: PlantInfo[];
  plant_id: number | null;
  plant_name: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
}

const initialState: RmcAuthState = {
  user: null,
  token: null,
  token_type: null,
  plants: [],
  plant_id: null,
  plant_name: null,
  isLoading: false,
  isError: false,
  errorMessage: "",
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
      state.token = null;
      state.token_type = null;
      state.plants = [];
      state.plant_id = null;
      state.plant_name = null;
      state.isLoading = false;
      state.isError = false;
      state.errorMessage = "";
      AsyncStorage.removeItem("user_rmc").catch((err) =>
        console.log("Error removing user_rmc from storage", err),
      );
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
        state.token = userData.token || null;
        state.token_type = userData.token_type || null;

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
        state.token = action.payload.token;
        state.token_type = action.payload.token_type;

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
  setSelectedPlant,
  setSeletedPlant,
  setRmcUserFromStorage,
  updateUser,
} = authSlice.actions;
export default authSlice.reducer;

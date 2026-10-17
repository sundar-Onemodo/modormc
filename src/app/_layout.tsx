import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { persistor, RootState, store } from "../../store/store";

function AppLayout() {
  const colorScheme = useColorScheme();
  const isLoggedIn = useSelector((state: RootState) => !!state.auth.token);
  const isDark = colorScheme === "dark";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <StatusBar style={isDark ? "light" : "dark"} />

        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            animation: "none",
          }}
        >
          {isLoggedIn ? (
            [
              <Stack.Screen
                key="index"
                name="index"
                options={{ gestureEnabled: false }}
              />,
              <Stack.Screen
                key="(tabs)"
                name="(tabs)"
                options={{ gestureEnabled: false }}
              />,
              <Stack.Screen
                key="showlistquotation"
                name="showlistquotation"
                options={{ statusBarStyle: "light" }}
              />,
              <Stack.Screen
                key="showcreatequotations"
                name="showcreatequotations"
                options={{ statusBarStyle: "light" }}
              />,
              <Stack.Screen
                key="showeditquotations"
                name="showeditquotations"
                options={{ statusBarStyle: "light" }}
              />,
              <Stack.Screen
                key="showcreatelead"
                name="showcreatelead"
                options={{ statusBarStyle: "light" }}
              />,
              <Stack.Screen
                key="showeditlead"
                name="showeditlead"
                options={{ statusBarStyle: "light" }}
              />,
              <Stack.Screen
                key="quotations"
                name="quotations"
                options={{ statusBarStyle: "light" }}
              />,
              <Stack.Screen
                key="shocustomerlist"
                name="shocustomerlist"
                options={{ statusBarStyle: "light" }}
              />,
            ]
          ) : (
            <Stack.Screen name="login" options={{ gestureEnabled: false }} />
          )}
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AppLayout />
      </PersistGate>
    </Provider>
  );
}

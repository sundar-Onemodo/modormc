import React from "react";
import { Redirect } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "../../store/store";

export default function RootIndex() {
  const token = useSelector((state: RootState) => state.auth.token);

  if (!token) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={"/(tabs)" as any} />;
}

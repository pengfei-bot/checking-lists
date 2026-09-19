import React from "react";
import { Text, View } from "react-native";
import { rewardsUi } from "../theme/rewardsUi";

/** Visible QA marker so smoke tests know which Pages bundle is live. */
export const BUILD_STAMP = "751ad70";

export function BuildStamp() {
  return (
    <View style={{ alignItems: "center", paddingVertical: 2 }}>
      <Text style={{ fontSize: 10, color: rewardsUi.navyMuted, fontWeight: "600" }}>
        build {BUILD_STAMP}
      </Text>
    </View>
  );
}

import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../navigation/types";
import { rewardsStyles, rewardsUi } from "../theme/rewardsUi";

type Navigate = {
  navigate: <RouteName extends keyof RootStackParamList>(
    ...args: undefined extends RootStackParamList[RouteName]
      ? [screen: RouteName] | [screen: RouteName, params: RootStackParamList[RouteName]]
      : [screen: RouteName, params: RootStackParamList[RouteName]]
  ) => void;
  reset?: (state: {
    index: number;
    routes: Array<{ name: keyof RootStackParamList; params?: object }>;
  }) => void;
};

type ChildTab = "home" | "tasks" | "history";
type ParentTab = "dashboard" | "tasks" | "rewards" | "profile";

export function ChildRewardsBottomNav({
  navigation,
  active,
  childId,
  rewardsActive = true,
}: {
  navigation: Navigate;
  active: ChildTab;
  childId?: string;
  rewardsActive?: boolean;
}) {
  const { t } = useTranslation();
  const item = (
    key: ChildTab,
    icon: string,
    label: string,
    onPress: () => void
  ) => {
    const isActive = active === key;
    return (
      <Pressable
        key={key}
        style={styles.navItem}
        onPress={onPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={label}
      >
        <Text style={rewardsStyles.fakeNavIcon}>{icon}</Text>
        <Text
          style={[
            rewardsStyles.fakeNavLabel,
            isActive && rewardsStyles.fakeNavLabelActive,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {isActive ? <View style={styles.activeDot} /> : <View style={styles.activeDotSpacer} />}
      </Pressable>
    );
  };

  return (
    <View style={[rewardsStyles.fakeNav, styles.navBar]}>
      {item("home", "🏠", t("childHome.navHome"), () => navigation.navigate("ChildHome"))}
      {item("tasks", "📋", t("childHome.navTasks"), () => navigation.navigate("ChildHistory"))}
      {/* No Récompenses tab — Accueil solde card opens RewardsChild. */}
      {rewardsActive
        ? item("history", "📜", t("childHome.navHistory"), () => {
            if (childId) navigation.navigate("RewardsChild", { childId });
          })
        : null}
    </View>
  );
}

export function ParentRewardsBottomNav({
  navigation,
  active,
}: {
  navigation: Navigate;
  active: ParentTab;
}) {
  const { t } = useTranslation();
  const item = (
    key: ParentTab,
    icon: string,
    label: string,
    onPress: () => void
  ) => {
    const isActive = active === key;
    return (
      <Pressable
        key={key}
        style={styles.navItem}
        onPress={onPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={label}
      >
        <Text style={rewardsStyles.fakeNavIcon}>{icon}</Text>
        <Text
          style={[
            rewardsStyles.fakeNavLabel,
            isActive && rewardsStyles.fakeNavLabelActive,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {isActive ? <View style={styles.activeDot} /> : <View style={styles.activeDotSpacer} />}
      </Pressable>
    );
  };

  return (
    <View style={[rewardsStyles.fakeNav, styles.navBar]}>
      {item("dashboard", "🏠", t("parentDash.navDashboard"), () =>
        navigation.navigate("ParentDashboard")
      )}
      {item("tasks", "📋", t("parentDash.navTasks"), () =>
        navigation.navigate("ParentCalendar")
      )}
      {item("rewards", "🏆", t("parentDash.navRewards"), () =>
        navigation.navigate("Rewards")
      )}
      {item("profile", "👤", t("parentDash.navProfile"), () =>
        navigation.navigate("ParentSettings")
      )}
    </View>
  );
}

const styles = {
  navBar: {
    zIndex: 20,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: "center" as const,
    gap: 2,
    paddingVertical: 6,
    minWidth: 64,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: rewardsUi.navActive,
    marginTop: 2,
  },
  activeDotSpacer: {
    width: 5,
    height: 5,
    marginTop: 2,
  },
};

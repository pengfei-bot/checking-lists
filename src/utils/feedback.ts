import { Alert, Platform } from "react-native";

/**
 * Show a simple OK dialog. React Native Web's Alert.alert is a no-op,
 * so on web we use window.alert for visible feedback.
 *
 * Alerts are deferred with setTimeout so callers can clear spinners / re-render
 * before the synchronous alert freezes the JS thread (which looked like an
 * "infinite spinner / hung renderer" on GitHub Pages).
 */
export function notifyUser(title: string, message: string): void {
  const show = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };
  if (Platform.OS === "web") {
    setTimeout(show, 0);
    return;
  }
  show();
}

/**
 * Confirm dialog. On web uses window.confirm (Alert buttons are unreliable).
 */
export function confirmUser(
  title: string,
  message: string,
  confirmLabel = "OK"
): Promise<boolean> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

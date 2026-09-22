import { useEffect } from "react";
import { useAuth } from "../auth";

/** Redirect child_device sessions away from parent-only screens. */
export function useParentOnlyGuard(navigation: {
  replace: (name: "ProfilePicker" | "ChildHome") => void;
}): boolean {
  const { isChildDevice } = useAuth();

  useEffect(() => {
    if (isChildDevice) {
      navigation.replace("ProfilePicker");
    }
  }, [isChildDevice, navigation]);

  return isChildDevice;
}

/**
 * Open the profile picker for an explicit switch (⋯ menu, ParentSettings, etc.).
 *
 * Important: do NOT clear currentProfileId before navigating. Clearing re-renders the
 * outgoing screen with a null profile mid-transition and has caused Rules-of-Hooks
 * crashes (hooks after early null guards). mode=switch already blocks auto-enter of
 * the remembered profile on ProfilePicker.
 */
export function openProfileSwitcher(navigation: {
  replace: (
    name: "ProfilePicker",
    params?: { mode?: "switch" }
  ) => void;
}): void {
  navigation.replace("ProfilePicker", { mode: "switch" });
}

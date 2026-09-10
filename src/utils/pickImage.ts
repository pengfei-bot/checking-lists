import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

export type PickImageOutcome =
  | { status: "success"; uri: string }
  | { status: "canceled" }
  | { status: "error"; message: string };

/** Tiny 1x1 PNG used only when the web picker itself throws (not on cancel). */
export const MOCK_PHOTO_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/**
 * Native HTML file input — most reliable on web (RN Web Alert is a no-op;
 * expo-image-picker can also miss cancel / fail silently in some browsers).
 */
function pickViaHtmlFileInput(): Promise<PickImageOutcome> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve({ status: "error", message: "Selecteur de fichier indisponible." });
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("data-testid", "proof-photo-file-input");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.style.opacity = "0";
    input.style.width = "1px";
    input.style.height = "1px";

    let settled = false;
    const finish = (outcome: PickImageOutcome) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onFocus);
      try {
        input.remove();
      } catch {
        /* ignore */
      }
      resolve(outcome);
    };

    const onFocus = () => {
      window.setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          finish({ status: "canceled" });
        }
      }, 500);
    };

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        finish({ status: "canceled" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const uri = typeof reader.result === "string" ? reader.result : undefined;
        if (uri) finish({ status: "success", uri });
        else finish({ status: "error", message: "Lecture du fichier image impossible." });
      };
      reader.onerror = () =>
        finish({ status: "error", message: "Erreur lors de la lecture du fichier." });
      reader.readAsDataURL(file);
    });

    input.addEventListener("cancel", () => finish({ status: "canceled" }));

    document.body.appendChild(input);
    window.addEventListener("focus", onFocus);
    input.click();
  });
}

async function pickViaExpoLibrary(quality: number): Promise<PickImageOutcome> {
  const pick = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality,
  });
  if (pick.canceled) return { status: "canceled" };
  const uri = pick.assets?.[0]?.uri;
  if (uri) return { status: "success", uri };
  return { status: "canceled" };
}

/**
 * Pick a proof photo.
 * - Web: HTML file input first; expo-image-picker fallback on error.
 * - Native: camera (if preferred) then media library.
 */
export async function pickProofImage(options?: {
  quality?: number;
  preferCamera?: boolean;
}): Promise<PickImageOutcome> {
  const quality = options?.quality ?? 0.7;

  if (Platform.OS === "web") {
    try {
      return await pickViaHtmlFileInput();
    } catch (htmlErr) {
      try {
        return await pickViaExpoLibrary(quality);
      } catch (expoErr) {
        const msg =
          expoErr instanceof Error
            ? expoErr.message
            : htmlErr instanceof Error
              ? htmlErr.message
              : "Selecteur photo indisponible.";
        return { status: "error", message: msg };
      }
    }
  }

  if (options?.preferCamera !== false) {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.granted) {
      const shot = await ImagePicker.launchCameraAsync({ quality });
      if (!shot.canceled && shot.assets?.[0]?.uri) {
        return { status: "success", uri: shot.assets[0].uri };
      }
    }
  }

  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!lib.granted) {
    return {
      status: "error",
      message: "Autorisez la camera ou la galerie dans les reglages.",
    };
  }
  try {
    return await pickViaExpoLibrary(quality);
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : "Impossible d'ouvrir la galerie.",
    };
  }
}

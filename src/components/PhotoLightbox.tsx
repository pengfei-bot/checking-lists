import React from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
  /** Task / context title shown under the photo (day-specific). */
  title?: string | null;
  /** Secondary line: date, “Done at …”, child, etc. */
  subtitle?: string | null;
};

/**
 * Full-screen proof photo viewer. Tap backdrop, ✕, or Android back to dismiss.
 * On iOS, ScrollView maximumZoomScale enables simple pinch zoom.
 * Optional title/subtitle keep day/task metadata visible so history photos
 * from different days are not ambiguous.
 */
export function PhotoLightbox({ uri, visible, onClose, title, subtitle }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (!uri) return null;

  const image = (
    <Image
      source={{ uri }}
      style={styles.image}
      resizeMode="contain"
      accessibilityLabel={title ? `${t("photo.title")}: ${title}` : t("photo.title")}
    />
  );

  const hasCaption = !!(title || subtitle);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("photo.close")}
        />
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[styles.closeBtn, { top: Math.max(insets.top, 12) + 4 }]}
          accessibilityRole="button"
          accessibilityLabel={t("photo.close")}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <View style={styles.imageWrap} pointerEvents="box-none">
          {Platform.OS === "ios" ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              bouncesZoom
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              {image}
            </ScrollView>
          ) : (
            image
          )}
        </View>

        {hasCaption ? (
          <View
            style={[styles.caption, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
            pointerEvents="none"
            accessibilityRole="summary"
          >
            {title ? (
              <Text style={styles.captionTitle} numberOfLines={2}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={styles.captionSubtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: -1,
  },
  imageWrap: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 56,
  },
  scroll: { flex: 1, width: "100%" },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
    maxWidth: 900,
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  captionTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  captionSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
});

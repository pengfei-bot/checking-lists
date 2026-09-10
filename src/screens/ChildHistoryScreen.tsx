import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import { dateLocaleTag } from "../i18n";
import {
  daysInMonth,
  isoFromParts,
  mondayFirstOffset,
  todayISO,
} from "../utils/dates";
import {
  DayAggregateStatus,
  buildDayOverview,
  statusColor,
  statusEmoji,
} from "../utils/calendarStatus";

type Props = NativeStackScreenProps<RootStackParamList, "ChildHistory">;

export function ChildHistoryScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { currentProfile, state, setCurrentProfileId } = useApp();
  const { width } = useWindowDimensions();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const today = todayISO();
  const childId = currentProfile?.role === "child" ? currentProfile.id : null;
  const children = useMemo(
    () => (currentProfile?.role === "child" ? [currentProfile] : []),
    [currentProfile]
  );

  const weekdayLabels = useMemo(
    () => [
      t("weekdays.mon"),
      t("weekdays.tue"),
      t("weekdays.wed"),
      t("weekdays.thu"),
      t("weekdays.fri"),
      t("weekdays.sat"),
      t("weekdays.sun"),
    ],
    [t, i18n.language]
  );

  const monthTitle = useMemo(() => {
    const date = new Date(year, monthIndex, 1);
    return date.toLocaleDateString(dateLocaleTag(i18n.language), {
      month: "long",
      year: "numeric",
    });
  }, [year, monthIndex, i18n.language]);

  if (!currentProfile || currentProfile.role !== "child" || !childId) {
    return (
      <View style={styles.center}>
        <Text>{t("roles.childRequired")}</Text>
        <PrimaryButton
          label={t("common.changeProfile")}
          onPress={() => {
            setCurrentProfileId(null);
            navigation.replace("ProfilePicker");
          }}
          style={{ marginTop: 12 }}
        />
      </View>
    );
  }

  const goPrev = () => {
    if (monthIndex === 0) {
      setYear((y) => y - 1);
      setMonthIndex(11);
    } else {
      setMonthIndex((m) => m - 1);
    }
  };

  const goNext = () => {
    if (monthIndex === 11) {
      setYear((y) => y + 1);
      setMonthIndex(0);
    } else {
      setMonthIndex((m) => m + 1);
    }
  };

  const cells = useMemo(() => {
    const totalDays = daysInMonth(year, monthIndex);
    const offset = mondayFirstOffset(year, monthIndex);
    const out: Array<{ day: number | null; iso: string | null; status: DayAggregateStatus }> =
      [];
    for (let i = 0; i < offset; i++) {
      out.push({ day: null, iso: null, status: "empty" });
    }
    for (let day = 1; day <= totalDays; day++) {
      const iso = isoFromParts(year, monthIndex, day);
      const overview = buildDayOverview(
        iso,
        state.tasks,
        state.completions,
        children,
        today
      );
      out.push({ day, iso, status: overview.status });
    }
    while (out.length % 7 !== 0) {
      out.push({ day: null, iso: null, status: "empty" });
    }
    return out;
  }, [year, monthIndex, state.tasks, state.completions, children, today]);

  const gap = 6;
  const gridPad = 16;
  const cellSize = Math.min(
    56,
    Math.floor((Math.min(width, 720) - gridPad * 2 - gap * 6) / 7)
  );

  const statusLabel = (status: DayAggregateStatus) => t(`calendar.status.${status}`);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <View
          style={[styles.hero, { backgroundColor: currentProfile.color + "22" }]}
        >
          <Text style={styles.heroEmoji}>{currentProfile.emoji}</Text>
          <Text style={styles.heroTitle}>{t("childHistory.title")}</Text>
          <Text style={styles.heroSub}>
            {t("childHistory.subtitle", { name: currentProfile.name })}
          </Text>
        </View>

        <View style={styles.navRow}>
          <Pressable
            onPress={goPrev}
            style={styles.navBtn}
            accessibilityLabel={t("childHistory.prevMonth")}
          >
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{monthTitle}</Text>
          <Pressable
            onPress={goNext}
            style={styles.navBtn}
            accessibilityLabel={t("childHistory.nextMonth")}
          >
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {weekdayLabels.map((label) => (
            <View key={label} style={[styles.weekdayCell, { width: cellSize }]}>
              <Text style={styles.weekdayText}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.grid, { width: cellSize * 7 + gap * 6 }]}>
          {cells.map((cell, idx) => {
            if (!cell.iso || cell.day == null) {
              return (
                <View
                  key={`e-${idx}`}
                  style={[styles.cell, { width: cellSize, height: cellSize }]}
                />
              );
            }
            const isToday = cell.iso === today;
            const bg = cell.status === "empty" ? colors.card : statusColor(cell.status);
            const fg = cell.status === "empty" ? colors.textMuted : "#fff";
            return (
              <Pressable
                key={cell.iso}
                onPress={() =>
                  navigation.navigate("ChildDayDetail", { date: cell.iso! })
                }
                style={[
                  styles.cell,
                  styles.cellFilled,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: bg,
                    borderWidth: isToday ? 2 : 1,
                    borderColor: isToday ? colors.text : colors.border,
                  },
                ]}
                accessibilityLabel={`${cell.day}, ${statusLabel(cell.status)}`}
              >
                <Text style={[styles.dayNum, { color: fg }]}>{cell.day}</Text>
                <Text style={styles.statusEmoji}>{statusEmoji(cell.status)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legend}>
          <Text style={styles.legendTitle}>{t("childHistory.legend")}</Text>
          {(
            [
              ["all_done", "calendar.allDone"],
              ["partial", "calendar.partial"],
              ["missed", "calendar.missedPast"],
              ["pending", "calendar.pendingToday"],
              ["empty", "calendar.empty"],
            ] as Array<[DayAggregateStatus, string]>
          ).map(([status, key]) => (
            <View key={status} style={styles.legendRow}>
              <View
                style={[
                  styles.legendSwatch,
                  {
                    backgroundColor:
                      status === "empty" ? colors.card : statusColor(status),
                    borderWidth: status === "empty" ? 1 : 0,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={styles.legendEmoji}>{statusEmoji(status)}</Text>
              </View>
              <Text style={styles.legendLabel}>
                {statusEmoji(status)} {t(key)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.hint}>{t("childHistory.hint")}</Text>

        <PrimaryButton
          label={t("common.back")}
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16, alignSelf: "stretch" }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.kidBg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  container: { padding: 16, paddingBottom: 48, alignItems: "center" },
  hero: {
    alignSelf: "stretch",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  heroEmoji: { fontSize: 36 },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  heroSub: { color: colors.textMuted, marginTop: 4, fontWeight: "600" },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 720,
    marginBottom: 16,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primary,
    lineHeight: 32,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    textTransform: "capitalize",
    flex: 1,
    textAlign: "center",
  },
  weekdayRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  weekdayCell: { alignItems: "center" },
  weekdayText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cell: { borderRadius: 12 },
  cellFilled: { alignItems: "center", justifyContent: "center" },
  dayNum: { fontWeight: "800", fontSize: 14 },
  statusEmoji: {
    fontSize: 11,
    marginTop: 1,
    lineHeight: 14,
  },
  legend: {
    alignSelf: "stretch",
    maxWidth: 720,
    marginTop: 24,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendTitle: { fontWeight: "800", marginBottom: 8, color: colors.text },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  legendSwatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  legendEmoji: { fontSize: 14 },
  legendLabel: { color: colors.text, fontSize: 14 },
  hint: {
    marginTop: 16,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 400,
  },
});

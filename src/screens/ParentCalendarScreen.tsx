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
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import {
  WEEKDAY_LABELS_FR,
  daysInMonth,
  formatFrenchMonthYear,
  isoFromParts,
  mondayFirstOffset,
  todayISO,
} from "../utils/dates";
import {
  DayAggregateStatus,
  buildDayOverview,
  statusColor,
  statusLabelFr,
} from "../utils/calendarStatus";

type Props = NativeStackScreenProps<RootStackParamList, "ParentCalendar">;

export function ParentCalendarScreen({ navigation }: Props) {
  const { currentProfile, childrenProfiles, state, setCurrentProfileId } = useApp();
  const { width } = useWindowDimensions();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const today = todayISO();

  if (!currentProfile || currentProfile.role !== "parent") {
    return (
      <View style={styles.center}>
        <Text>Profil parent requis.</Text>
        <PrimaryButton
          label="Changer de profil"
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
    const out: Array<{ day: number | null; iso: string | null; status: DayAggregateStatus }> = [];
    for (let i = 0; i < offset; i++) {
      out.push({ day: null, iso: null, status: "empty" });
    }
    for (let day = 1; day <= totalDays; day++) {
      const iso = isoFromParts(year, monthIndex, day);
      const overview = buildDayOverview(
        iso,
        state.tasks,
        state.completions,
        childrenProfiles,
        today
      );
      out.push({ day, iso, status: overview.status });
    }
    while (out.length % 7 !== 0) {
      out.push({ day: null, iso: null, status: "empty" });
    }
    return out;
  }, [year, monthIndex, state.tasks, state.completions, childrenProfiles, today]);

  const gridPad = 16;
  const gap = 6;
  const cellSize = Math.min(56, Math.floor((Math.min(width, 720) - gridPad * 2 - gap * 6) / 7));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.navRow}>
          <Pressable onPress={goPrev} style={styles.navBtn} accessibilityLabel="Mois précédent">
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{formatFrenchMonthYear(year, monthIndex)}</Text>
          <Pressable onPress={goNext} style={styles.navBtn} accessibilityLabel="Mois suivant">
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS_FR.map((label) => (
            <View key={label} style={[styles.weekdayCell, { width: cellSize }]}>
              <Text style={styles.weekdayText}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.grid, { width: cellSize * 7 + gap * 6 }]}>
          {cells.map((cell, idx) => {
            if (!cell.iso || cell.day == null) {
              return <View key={`e-${idx}`} style={[styles.cell, { width: cellSize, height: cellSize }]} />;
            }
            const isToday = cell.iso === today;
            const bg = cell.status === "empty" ? colors.card : statusColor(cell.status);
            const fg = cell.status === "empty" ? colors.textMuted : "#fff";
            return (
              <Pressable
                key={cell.iso}
                onPress={() => navigation.navigate("ParentDayDetail", { date: cell.iso! })}
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
                accessibilityLabel={`${cell.day}, ${statusLabelFr(cell.status)}`}
              >
                <Text style={[styles.dayNum, { color: fg }]}>{cell.day}</Text>
                {cell.status !== "empty" ? (
                  <View style={[styles.dot, { backgroundColor: "#fff" }]} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Légende</Text>
          {(
            [
              ["all_done", "Tout fait"],
              ["partial", "Partiel"],
              ["missed", "Manqué (jour passé)"],
              ["pending", "En cours / à faire (aujourd'hui)"],
              ["empty", "Aucune tâche"],
            ] as Array<[DayAggregateStatus, string]>
          ).map(([status, label]) => (
            <View key={status} style={styles.legendRow}>
              <View
                style={[
                  styles.legendSwatch,
                  {
                    backgroundColor: status === "empty" ? colors.card : statusColor(status),
                    borderWidth: status === "empty" ? 1 : 0,
                    borderColor: colors.border,
                  },
                ]}
              />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.hint}>
          Touchez un jour pour voir le détail par enfant et les tâches.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.parentBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 48, alignItems: "center" },
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
  navBtnText: { fontSize: 28, fontWeight: "700", color: colors.primary, lineHeight: 32 },
  monthTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    textTransform: "capitalize",
    flex: 1,
    textAlign: "center",
  },
  weekdayRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  weekdayCell: { alignItems: "center" },
  weekdayText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cell: {
    borderRadius: 12,
  },
  cellFilled: {
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: { fontWeight: "800", fontSize: 14 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    opacity: 0.85,
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
  legendSwatch: { width: 18, height: 18, borderRadius: 6, marginRight: 10 },
  legendLabel: { color: colors.text, fontSize: 14 },
  hint: {
    marginTop: 16,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 400,
  },
});

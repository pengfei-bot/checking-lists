import { Linking } from "react-native";

const REPORT_EMAIL = "dongpf@hotmail.com";

export interface PhotoReportContext {
  taskId: string;
  date: string;
  familyId?: string | null;
  completionId?: string;
}

/** Open mailto to developer for App Store UGC photo report (Guideline 2.1). */
export async function openPhotoReportMail(ctx: PhotoReportContext): Promise<void> {
  const lines = [
    "Famlist photo report",
    "",
    `taskId: ${ctx.taskId}`,
    `date: ${ctx.date}`,
    ...(ctx.completionId ? [`completionId: ${ctx.completionId}`] : []),
    ...(ctx.familyId ? [`familyId: ${ctx.familyId}`] : []),
    "",
    "Please review this photo proof.",
  ];
  const body = encodeURIComponent(lines.join("\n"));
  const url = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent("Famlist photo report")}&body=${body}`;
  await Linking.openURL(url);
}

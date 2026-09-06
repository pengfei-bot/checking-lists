export type RootStackParamList = {
  ProfilePicker: undefined;
  ChildHome: undefined;
  ParentDashboard: undefined;
  ParentCalendar: undefined;
  ParentDayDetail: { date: string };
  TaskForm: { taskId?: string; childId?: string };
  TaskDetail: { taskId: string };
};

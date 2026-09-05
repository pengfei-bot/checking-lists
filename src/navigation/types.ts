export type RootStackParamList = {
  ProfilePicker: undefined;
  ChildHome: undefined;
  ParentDashboard: undefined;
  TaskForm: { taskId?: string; childId?: string };
  TaskDetail: { taskId: string };
};

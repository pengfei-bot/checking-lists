export type RootStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  SignIn: undefined;
  ForgotPassword: undefined;
  RedeemInvite: undefined;
  FamilyShare: undefined;
  ProfilePicker: undefined;
  ChildHome: undefined;
  ChildHistory: undefined;
  ChildDayDetail: { date: string };
  ParentDashboard: undefined;
  ParentCalendar: undefined;
  ParentDayDetail: { date: string };
  TaskForm: { taskId?: string; childId?: string };
  TaskDetail: { taskId: string; date?: string };
  ChildForm: { childId?: string };
  LanguageSettings: undefined;
};

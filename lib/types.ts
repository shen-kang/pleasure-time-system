export const categories = ["投资", "套利", "健身", "羽毛球", "阅读"] as const;

export type Category = (typeof categories)[number];

export type ActivityRecord = {
  id: string;
  profile_id: string;
  category: Category;
  hours: number;
  minutes: number;
  decimal_hours: number;
  focus_score: number;
  points: number;
  earned_minutes: number;
  created_at: string;
};

export type EntertainmentSpend = {
  id: string;
  profile_id: string;
  minutes: number;
  created_at: string;
};

export type Period = "week" | "month" | "year";

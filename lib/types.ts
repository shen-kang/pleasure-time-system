 // Default categories for new users
 export const defaultCategories = ["投资", "套利", "健身", "羽毛球", "阅读"] as const;
 
 // Predefined color palette for user-created categories
 export const colorPalette = [
   "#0EA5A4", "#F9735B", "#16A34A", "#2563EB", "#D9467A",
   "#EAB308", "#8B5CF6", "#EC4899", "#14B8A6", "#F59E0B",
   "#6366F1", "#84CC16", "#06B6D4", "#A855F7", "#EF4444",
 ] as const;
 
 export type UserCategory = {
   id: string;
   name: string;
   color: string;
   created_at: string;
 };
 
 export type ActivityRecord = {
   id: string;
   user_id?: string;
   profile_id: string;
   category: string;
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
   user_id?: string;
   profile_id: string;
   minutes: number;
   created_at: string;
 };
 
 export type Period = "week" | "month" | "year";

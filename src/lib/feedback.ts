import { supabase } from "@/lib/supabase";

export interface FeedbackItem {
  id: string;
  user_id: string;
  page: string;
  message: string;
  resolved: boolean;
  created_at: string;
}

export async function submitFeedback(
  userId: string,
  page: string,
  message: string,
): Promise<void> {
  const { error } = await supabase.from("feedback").insert({
    user_id: userId,
    page,
    message: message.slice(0, 150),
  });
  if (error) throw error;
}

export async function getAllFeedback(): Promise<FeedbackItem[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function setFeedbackResolved(
  id: string,
  resolved: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("feedback")
    .update({ resolved })
    .eq("id", id);
  if (error) throw error;
}

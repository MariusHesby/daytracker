// Chat/messaging functions for DayTracker
import { supabase } from './supabase';

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
}

// Send a message to a friend
export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string
): Promise<{ data: ChatMessage | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapMessage(data), error: null };
  } catch (e) {
    console.error('sendMessage failed:', e);
    return { data: null, error: 'Failed to send message' };
  }
}

// Get messages between two users
export async function getMessages(
  userId: string,
  friendId: string,
  limit = 50
): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !data) return [];
    return data.map(mapMessage);
  } catch (e) {
    console.warn('getMessages failed:', e);
    return [];
  }
}

// Mark all messages from a friend as read
export async function markMessagesAsRead(
  userId: string,
  friendId: string
): Promise<void> {
  try {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', friendId)
      .eq('receiver_id', userId)
      .eq('read', false);
  } catch (e) {
    console.warn('markMessagesAsRead failed:', e);
  }
}

// Get unread message counts per sender
export async function getUnreadCounts(
  userId: string
): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', userId)
      .eq('read', false);

    if (error || !data) return {};

    const counts: Record<string, number> = {};
    data.forEach((msg: { sender_id: string }) => {
      counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
    });
    return counts;
  } catch (e) {
    console.warn('getUnreadCounts failed:', e);
    return {};
  }
}

// Get latest unread messages for notification creation
export async function getLatestUnreadMessages(
  userId: string
): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) return [];
    return data.map(mapMessage);
  } catch (e) {
    console.warn('getLatestUnreadMessages failed:', e);
    return [];
  }
}

function mapMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as string,
    senderId: row.sender_id as string,
    receiverId: row.receiver_id as string,
    content: row.content as string,
    read: row.read as boolean,
    createdAt: row.created_at as string,
  };
}

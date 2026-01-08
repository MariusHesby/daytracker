// Sharing functions for DayTracker
import { supabase, DbShareRequest, DbShare, DbActivityType, DbLogEntry } from './supabase';
import { ActivityType, LogEntry } from '@/types';

// Convert DB types to app types
function dbToActivityType(db: DbActivityType): ActivityType {
  return {
    id: db.id,
    name: db.name,
    icon: db.icon || undefined,
    valueType: db.value_type,
    unit: db.unit || undefined,
    order: db.sort_order || undefined,
    isDefault: db.is_default,
    hidden: db.hidden,
    createdAt: new Date(db.created_at),
  };
}

function dbToLogEntry(db: DbLogEntry): LogEntry {
  return {
    id: db.id,
    date: db.date,
    activityTypeId: db.activity_type_id,
    value: db.value,
    note: db.note || undefined,
    imdbId: db.imdb_id || undefined,
    poster: db.poster || undefined,
    imdbRating: db.imdb_rating || undefined,
    year: db.year || undefined,
    userRating: db.user_rating || undefined,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

export interface ShareRequest {
  id: string;
  fromUserId: string;
  fromEmail: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface Share {
  id: string;
  ownerId: string;
  viewerId: string;
  activityTypeIds: string[];
  createdAt: Date;
}

export interface SharedUser {
  id: string;
  email: string;
  activityTypes: ActivityType[];
  activityTypeIds?: string[];
}

// Send a share request to another user
export async function sendShareRequest(
  fromUserId: string,
  fromEmail: string,
  toEmail: string
): Promise<{ error: Error | null }> {
  // Check if request already exists
  const { data: existing } = await supabase
    .from('share_requests')
    .select('id, status')
    .eq('from_user_id', fromUserId)
    .eq('to_email', toEmail)
    .single();

  if (existing) {
    if (existing.status === 'pending') {
      return { error: new Error('Request already sent') };
    }
    // Update existing rejected request to pending
    const { error } = await supabase
      .from('share_requests')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return { error: error as Error | null };
  }

  const { error } = await supabase
    .from('share_requests')
    .insert({
      from_user_id: fromUserId,
      from_email: fromEmail,
      to_email: toEmail,
    });

  return { error: error as Error | null };
}

// Get incoming share requests
export async function getIncomingRequests(userEmail: string): Promise<ShareRequest[]> {
  const { data, error } = await supabase
    .from('share_requests')
    .select('*')
    .eq('to_email', userEmail)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((r: DbShareRequest) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    fromEmail: r.from_email,
    toEmail: r.to_email,
    status: r.status,
    createdAt: new Date(r.created_at),
  }));
}

// Get outgoing share requests
export async function getOutgoingRequests(userId: string): Promise<ShareRequest[]> {
  const { data, error } = await supabase
    .from('share_requests')
    .select('*')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((r: DbShareRequest) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    fromEmail: r.from_email,
    toEmail: r.to_email,
    status: r.status,
    createdAt: new Date(r.created_at),
  }));
}

// Accept a share request with selected activity types
export async function acceptShareRequest(
  requestId: string,
  ownerId: string,
  viewerUserId: string,
  activityTypeIds: string[]
): Promise<{ error: Error | null }> {
  // Update request status
  const { error: updateError } = await supabase
    .from('share_requests')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (updateError) return { error: updateError as Error };

  // Create or update share
  const { error: upsertError } = await supabase
    .from('shares')
    .upsert({
      owner_id: ownerId,
      viewer_id: viewerUserId,
      activity_type_ids: activityTypeIds,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'owner_id,viewer_id',
    });

  return { error: upsertError as Error | null };
}

// Reject a share request
export async function rejectShareRequest(requestId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('share_requests')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', requestId);

  return { error: error as Error | null };
}

// Update share permissions
export async function updateSharePermissions(
  shareId: string,
  activityTypeIds: string[]
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('shares')
    .update({ 
      activity_type_ids: activityTypeIds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shareId);

  return { error: error as Error | null };
}

// Remove a share
export async function removeShare(shareId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('shares')
    .delete()
    .eq('id', shareId);

  return { error: error as Error | null };
}

// Get users who share with me (I can view their data)
export async function getSharedWithMe(viewerId: string): Promise<SharedUser[]> {
  const { data: shares, error: sharesError } = await supabase
    .from('shares')
    .select('*')
    .eq('viewer_id', viewerId);

  if (sharesError) throw sharesError;
  if (!shares || shares.length === 0) return [];

  const sharedUsers: SharedUser[] = [];

  for (const share of shares as DbShare[]) {
    // Get owner email from share_requests - the viewer sent a request TO the owner
    // So we need to find a request where from_user_id = viewerId and the owner accepted
    const { data: requestData } = await supabase
      .from('share_requests')
      .select('to_email, from_email')
      .or(`and(from_user_id.eq.${viewerId},status.eq.accepted),and(from_user_id.eq.${share.owner_id})`)
      .limit(5);

    // Find the email - it could be in to_email (if we sent request) or from_email (if they sent)
    let ownerEmail = 'Unknown';
    if (requestData && requestData.length > 0) {
      // Check if any request has our owner_id's email
      for (const req of requestData) {
        // If we sent the request, owner email is in to_email
        // Actually, let's just use from_email from the share_requests where from_user_id = owner_id
        if (req.from_email) {
          ownerEmail = req.from_email;
          break;
        }
      }
    }

    // If still unknown, try another approach
    if (ownerEmail === 'Unknown') {
      const { data: ownerRequest } = await supabase
        .from('share_requests')
        .select('from_email')
        .eq('from_user_id', share.owner_id)
        .limit(1);
      
      if (ownerRequest && ownerRequest.length > 0) {
        ownerEmail = ownerRequest[0].from_email || 'Unknown';
      }
    }

    // Get shared activity types - need to use RPC or service role for cross-user access
    // For now, we'll store activity type info differently
    // Actually, we need to query activity_types with the owner's permission via shares
    const activityTypeIds = share.activity_type_ids || [];

    sharedUsers.push({
      id: share.owner_id,
      email: ownerEmail,
      activityTypes: [], // We'll load these when viewing the user's data
      activityTypeIds: activityTypeIds, // Store the IDs for later use
    });
  }

  return sharedUsers;
}

// Get my shares (who I share with)
export async function getMyShares(ownerId: string): Promise<{
  share: Share;
  viewerEmail: string;
}[]> {
  const { data: shares, error } = await supabase
    .from('shares')
    .select('*')
    .eq('owner_id', ownerId);

  if (error) throw error;
  if (!shares || shares.length === 0) return [];

  const result: { share: Share; viewerEmail: string }[] = [];

  for (const share of shares as DbShare[]) {
    // Get viewer email from share_requests
    const { data: requestData } = await supabase
      .from('share_requests')
      .select('from_email')
      .eq('from_user_id', share.viewer_id)
      .limit(1);

    result.push({
      share: {
        id: share.id,
        ownerId: share.owner_id,
        viewerId: share.viewer_id,
        activityTypeIds: share.activity_type_ids,
        createdAt: new Date(share.created_at),
      },
      viewerEmail: requestData?.[0]?.from_email || 'Unknown',
    });
  }

  return result;
}

// Get shared entries for a specific user
export async function getSharedEntries(
  ownerId: string,
  activityTypeIds: string[],
  startDate: string,
  endDate: string
): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('log_entries')
    .select('*')
    .eq('user_id', ownerId)
    .in('activity_type_id', activityTypeIds)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []).map(dbToLogEntry);
}

// Sharing functions for DayTracker
import { supabase, DbShareRequest, DbShare, DbActivityType, DbLogEntry, DbProfile } from './supabase';
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

export interface UserProfile {
  fullName: string;
  avatar: string | null;
}

export interface ShareRequest {
  id: string;
  fromUserId: string;
  fromEmail: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  profile?: UserProfile;
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
  profile?: UserProfile;
}

// Helper function to get profile by user ID
async function getProfileByUserId(userId: string): Promise<UserProfile | undefined> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, avatar')
    .eq('user_id', userId)
    .single();
  
  if (!data) return undefined;
  
  const profile = data as DbProfile;
  return {
    fullName: profile.full_name,
    avatar: profile.avatar,
  };
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
  
  const requests: ShareRequest[] = [];
  for (const r of (data || []) as DbShareRequest[]) {
    const profile = await getProfileByUserId(r.from_user_id);
    requests.push({
      id: r.id,
      fromUserId: r.from_user_id,
      fromEmail: r.from_email,
      toEmail: r.to_email,
      status: r.status,
      createdAt: new Date(r.created_at),
      profile,
    });
  }
  return requests;
}

// Get outgoing share requests
export async function getOutgoingRequests(userId: string): Promise<ShareRequest[]> {
  const { data, error } = await supabase
    .from('share_requests')
    .select('*')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // For outgoing requests, we want to look up the recipient's profile by their email
  // But since we don't have their user_id directly, we'll need to find it
  const requests: ShareRequest[] = [];
  for (const r of (data || []) as DbShareRequest[]) {
    // Try to find profile via share if accepted
    let profile: UserProfile | undefined;
    if (r.status === 'accepted') {
      // Find the share to get viewer_id, then get their profile
      const { data: shareData } = await supabase
        .from('shares')
        .select('viewer_id')
        .eq('owner_id', userId)
        .single();
      
      if (shareData) {
        profile = await getProfileByUserId(shareData.viewer_id);
      }
    }
    
    requests.push({
      id: r.id,
      fromUserId: r.from_user_id,
      fromEmail: r.from_email,
      toEmail: r.to_email,
      status: r.status,
      createdAt: new Date(r.created_at),
      profile,
    });
  }
  return requests;
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

  console.log('getSharedWithMe - viewerId:', viewerId);
  console.log('getSharedWithMe - shares:', shares);
  console.log('getSharedWithMe - error:', sharesError);

  if (sharesError) throw sharesError;
  if (!shares || shares.length === 0) return [];

  const sharedUsers: SharedUser[] = [];

  for (const share of shares as DbShare[]) {
    // Get owner email - the owner accepted our request, so their email is in from_email
    // where they sent a request to us, OR we sent a request to them (to_email)
    let ownerEmail = 'Unknown';

    // First try: Check if we sent a request to the owner (our fromUserId, their email in to_email)
    const { data: sentByUs } = await supabase
      .from('share_requests')
      .select('to_email')
      .eq('from_user_id', viewerId)
      .eq('status', 'accepted');

    console.log('Requests sent by us:', sentByUs);

    // Second try: Check requests where owner sent to us (we're the to_email)
    const { data: sentByOwner } = await supabase
      .from('share_requests')
      .select('from_email, from_user_id')
      .eq('from_user_id', share.owner_id)
      .eq('status', 'accepted');

    console.log('Requests sent by owner:', sentByOwner);

    // Get email from either source
    if (sentByOwner && sentByOwner.length > 0) {
      ownerEmail = sentByOwner[0].from_email || 'Unknown';
    } else if (sentByUs && sentByUs.length > 0) {
      ownerEmail = sentByUs[0].to_email || 'Unknown';
    }

    const activityTypeIds = share.activity_type_ids || [];
    
    // Get owner's profile
    const profile = await getProfileByUserId(share.owner_id);

    sharedUsers.push({
      id: share.owner_id,
      email: ownerEmail,
      activityTypes: [],
      activityTypeIds: activityTypeIds,
      profile,
    });
  }

  return sharedUsers;
}

// Get my shares (who I share with)
export async function getMyShares(ownerId: string): Promise<{
  share: Share;
  viewerEmail: string;
  viewerProfile?: UserProfile;
}[]> {
  const { data: shares, error } = await supabase
    .from('shares')
    .select('*')
    .eq('owner_id', ownerId);

  if (error) throw error;
  if (!shares || shares.length === 0) return [];

  const result: { share: Share; viewerEmail: string; viewerProfile?: UserProfile }[] = [];

  for (const share of shares as DbShare[]) {
    // Get viewer email from share_requests
    const { data: requestData } = await supabase
      .from('share_requests')
      .select('from_email')
      .eq('from_user_id', share.viewer_id)
      .limit(1);
    
    // Get viewer's profile
    const viewerProfile = await getProfileByUserId(share.viewer_id);

    result.push({
      share: {
        id: share.id,
        ownerId: share.owner_id,
        viewerId: share.viewer_id,
        activityTypeIds: share.activity_type_ids,
        createdAt: new Date(share.created_at),
      },
      viewerEmail: requestData?.[0]?.from_email || 'Unknown',
      viewerProfile,
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

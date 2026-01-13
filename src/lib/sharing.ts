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
  email?: string;
}

export interface ShareRequest {
  id: string;
  fromUserId: string;
  fromEmail: string;
  toEmail: string;
  toUserId?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  profile?: UserProfile;
  toProfile?: UserProfile;
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
  lastActivityDates?: Record<string, string>; // activityTypeId -> last entry date ISO string
}

export interface SearchResult {
  userId: string;
  email: string;
  fullName: string;
  avatar: string | null;
}

// Search for users by name or email
export async function searchUsers(
  query: string,
  currentUserId: string
): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const searchTerm = `%${query.toLowerCase()}%`;

  // Search profiles by full_name or email
  const { data: profileResults, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, avatar')
    .or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
    .neq('user_id', currentUserId)
    .limit(10);

  if (profileError) {
    console.error('Profile search error:', profileError);
  }

  // Also search by email in share_requests for users who haven't set up their profile yet
  const { data: emailResults, error: emailError } = await supabase
    .from('share_requests')
    .select('from_user_id, from_email')
    .ilike('from_email', searchTerm)
    .neq('from_user_id', currentUserId)
    .limit(10);

  if (emailError) {
    console.error('Email search error:', emailError);
  }

  // Combine results, avoiding duplicates
  const results: SearchResult[] = [];
  const seenUserIds = new Set<string>();

  // Add profile results
  if (profileResults) {
    for (const profile of profileResults) {
      if (!seenUserIds.has(profile.user_id)) {
        seenUserIds.add(profile.user_id);
        results.push({
          userId: profile.user_id,
          email: profile.email || '',
          fullName: profile.full_name,
          avatar: profile.avatar,
        });
      }
    }
  }

  // Add email search results (for users without email in profile)
  if (emailResults) {
    for (const req of emailResults) {
      if (!seenUserIds.has(req.from_user_id)) {
        seenUserIds.add(req.from_user_id);
        // Get profile for this user
        const profile = await getProfileByUserId(req.from_user_id);
        results.push({
          userId: req.from_user_id,
          email: req.from_email,
          fullName: profile?.fullName || req.from_email.split('@')[0],
          avatar: profile?.avatar || null,
        });
      }
    }
  }

  return results;
}

// Helper function to get profile by user ID
async function getProfileByUserId(userId: string): Promise<UserProfile | undefined> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, avatar, email')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (!data || error) return undefined;
  
  return {
    fullName: data.full_name,
    avatar: data.avatar,
    email: data.email || undefined,
  };
}

// Helper function to get profile by email
async function getProfileByEmail(email: string): Promise<UserProfile | undefined> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, avatar, email')
    .eq('email', email)
    .maybeSingle();
  
  if (!data || error) return undefined;
  
  return {
    fullName: data.full_name,
    avatar: data.avatar,
    email: data.email || undefined,
  };
}

// Send a share request to another user by email
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
    .maybeSingle();

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

// Send a share request to another user by their user ID (from search results)
export async function sendShareRequestByUserId(
  fromUserId: string,
  fromEmail: string,
  toUserId: string,
  toEmail?: string
): Promise<{ error: Error | null }> {
  try {
    // We need the target user's email for the share_requests table
    // If not provided, try to get it from their profile or existing requests
    let targetEmail = toEmail;
    
    if (!targetEmail) {
      // Try to get email from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', toUserId)
        .maybeSingle();
      
      if (profileData?.email) {
        targetEmail = profileData.email;
      }
    }
    
    if (!targetEmail) {
      // Try to get email from share_requests where they were the sender
      const { data: reqData } = await supabase
        .from('share_requests')
        .select('from_email')
        .eq('from_user_id', toUserId)
        .limit(1)
        .maybeSingle();
      
      if (reqData?.from_email) {
        targetEmail = reqData.from_email;
      }
    }
    
    if (!targetEmail) {
      // As a last resort, use a placeholder with user ID
      // The target user can still see and accept the request based on their user ID
      targetEmail = `user_${toUserId}@daytracker.local`;
    }

    // Check if request already exists (by user ID - more reliable)
    const { data: existing } = await supabase
      .from('share_requests')
      .select('id, status')
      .eq('from_user_id', fromUserId)
      .eq('to_user_id', toUserId)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'pending') {
        return { error: new Error('Request already sent') };
      }
      // Update existing rejected request to pending
      const { error } = await supabase
        .from('share_requests')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) {
        return { error: new Error(error.message) };
      }
      return { error: null };
    }

    const { error } = await supabase
      .from('share_requests')
      .insert({
        from_user_id: fromUserId,
        from_email: fromEmail,
        to_email: targetEmail,
        to_user_id: toUserId,
      });

    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (e) {
    console.error('sendShareRequestByUserId error:', e);
    return { error: e instanceof Error ? e : new Error('Unknown error') };
  }
}

// Get incoming share requests (by email or user ID)
export async function getIncomingRequests(userEmail: string, userId?: string): Promise<ShareRequest[]> {
  // Get requests by email
  const { data: emailData, error: emailError } = await supabase
    .from('share_requests')
    .select('*')
    .eq('to_email', userEmail)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (emailError) throw new Error(emailError.message || 'Failed to get incoming requests');
  
  // Also get requests by user ID if provided
  let userIdData: DbShareRequest[] = [];
  if (userId) {
    const { data, error } = await supabase
      .from('share_requests')
      .select('*')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      userIdData = data as DbShareRequest[];
    }
  }
  
  // Combine and deduplicate
  const allData = [...(emailData || []), ...userIdData] as DbShareRequest[];
  const seen = new Set<string>();
  const uniqueData = allData.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  
  const requests: ShareRequest[] = [];
  for (const r of uniqueData) {
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

  if (error) throw new Error(error.message || 'Failed to get outgoing requests');
  
  const requests: ShareRequest[] = [];
  for (const r of (data || []) as DbShareRequest[]) {
    // Get recipient's profile using to_user_id, or look up by email
    let toProfile: UserProfile | undefined;
    if (r.to_user_id) {
      toProfile = await getProfileByUserId(r.to_user_id);
    } else if (r.to_email && !r.to_email.includes('@daytracker.local')) {
      // Try to find user by email if no to_user_id
      toProfile = await getProfileByEmail(r.to_email);
    }
    
    // For accepted requests, also get profile from share
    let profile: UserProfile | undefined;
    if (r.status === 'accepted') {
      const { data: shareData } = await supabase
        .from('shares')
        .select('viewer_id')
        .eq('owner_id', userId)
        .maybeSingle();
      
      if (shareData) {
        profile = await getProfileByUserId(shareData.viewer_id);
      }
    }
    
    requests.push({
      id: r.id,
      fromUserId: r.from_user_id,
      fromEmail: r.from_email,
      toEmail: r.to_email,
      toUserId: r.to_user_id || undefined,
      status: r.status,
      createdAt: new Date(r.created_at),
      profile,
      toProfile,
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

// Remove a shared connection (stop viewing someone's data)
export async function removeSharedConnection(ownerId: string, viewerId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('shares')
    .delete()
    .eq('owner_id', ownerId)
    .eq('viewer_id', viewerId);

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

  if (sharesError) throw new Error(sharesError.message || 'Failed to get shared users');
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

    // Get owner's activity types to show their icons
    const { data: ownerActivityTypes } = await supabase
      .from('activity_types')
      .select('*')
      .eq('user_id', share.owner_id)
      .in('id', activityTypeIds.length > 0 ? activityTypeIds : ['__none__']);

    const activityTypes: ActivityType[] = (ownerActivityTypes || []).map((at: DbActivityType) => ({
      id: at.id,
      name: at.name,
      icon: at.icon || undefined,
      valueType: at.value_type,
      unit: at.unit || undefined,
      order: at.sort_order || undefined,
      isDefault: at.is_default,
      hidden: at.hidden,
      createdAt: new Date(at.created_at),
    }));

    // Get the latest entry update time for each shared activity type using RPC function
    const lastActivityDates: Record<string, string> = {};
    if (activityTypeIds.length > 0) {
      const { data: latestEntries, error: rpcError } = await supabase
        .rpc('get_shared_activity_dates', {
          p_owner_id: share.owner_id,
          p_viewer_id: viewerId,
          p_activity_type_ids: activityTypeIds,
        });

      if (rpcError) {
        console.warn('RPC get_shared_activity_dates not available, activity notifications disabled:', rpcError.message);
      } else if (latestEntries) {
        for (const entry of latestEntries as { activity_type_id: string; last_updated: string }[]) {
          lastActivityDates[entry.activity_type_id] = entry.last_updated;
        }
      }
    }

    sharedUsers.push({
      id: share.owner_id,
      email: ownerEmail,
      activityTypes: activityTypes,
      activityTypeIds: activityTypeIds,
      profile,
      lastActivityDates,
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

  if (error) throw new Error(error.message || 'Failed to get my shares');
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

  if (error) throw new Error(error.message || 'Failed to get shared entries');
  return (data || []).map(dbToLogEntry);
}

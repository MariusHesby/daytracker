"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useNotifications } from "@/context/NotificationContext";
import { cn } from "@/lib/utils";
import {
  sendShareRequestByUserId,
  getSharedWithMe,
  getMyShares,
  getIncomingRequests,
  getOutgoingRequests,
  acceptShareRequest,
  rejectShareRequest,
  cancelShareRequest,
  removeFriendship,
  updateSharePermissions,
  searchUsers,
  SharedUser,
  Share,
  ShareRequest,
  UserProfile,
  SearchResult,
} from "@/lib/sharing";
import { IOSModal } from "@/components/ios";
import { Avatar } from "@/components/ProfileSetup";
import { Icon, IconName, icons } from "@/components/Icons";

export default function FriendsPage() {
  const { user } = useAuth();
  const { activityTypes, setViewingUser } = useApp();
  const { isSubscribed, addSubscription, removeSubscription } =
    useNotifications();
  const router = useRouter();

  const [sharedWithMe, setSharedWithMe] = useState<SharedUser[]>([]);
  const [myShares, setMyShares] = useState<
    { share: Share; viewerEmail: string; viewerProfile?: UserProfile }[]
  >([]);
  const [incomingRequests, setIncomingRequests] = useState<ShareRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ShareRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showSendRequest, setShowSendRequest] = useState(false);
  const [showEditShare, setShowEditShare] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [userToRemove, setUserToRemove] = useState<SharedUser | null>(null);
  const [selectedShare, setSelectedShare] = useState<{
    share: Share;
    viewerEmail: string;
    viewerProfile?: UserProfile;
  } | null>(null);
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>(
    [],
  );
  const [message, setMessage] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Last viewed timestamps for notification system
  const [lastViewedTimes, setLastViewedTimes] = useState<
    Record<string, Record<string, string>>
  >({});

  // Favorite friends for Movies & TV filtering
  const [favoriteFriends, setFavoriteFriends] = useState<string[]>([]);

  // Modal for managing activity notifications
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedUserForNotifications, setSelectedUserForNotifications] =
    useState<SharedUser | null>(null);

  // Load last viewed times and favorites from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("friendActivityLastViewed");
      if (stored) {
        try {
          setLastViewedTimes(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse last viewed times:", e);
        }
      }

      const favorites = localStorage.getItem("favoriteFriends");
      if (favorites) {
        try {
          setFavoriteFriends(JSON.parse(favorites));
        } catch (e) {
          console.error("Failed to parse favorite friends:", e);
        }
      }
    }
  }, []);

  const toggleFavorite = (userId: string) => {
    setFavoriteFriends((prev) => {
      const newFavorites = prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId];
      localStorage.setItem("favoriteFriends", JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  // Load cached data from localStorage on mount for instant display
  useEffect(() => {
    if (typeof window !== "undefined" && user?.id) {
      const cached = localStorage.getItem(`friends-cache-${user.id}`);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          // Only use cache if it's less than 5 minutes old
          if (data.timestamp && Date.now() - data.timestamp < 5 * 60 * 1000) {
            if (data.sharedWithMe) setSharedWithMe(data.sharedWithMe);
            if (data.myShares) setMyShares(data.myShares);
            setIsLoading(false); // Show cached data immediately
          }
        } catch (e) {
          console.error("Failed to parse friends cache:", e);
        }
      }
    }
  }, [user?.id]);

  const loadData = useCallback(async () => {
    if (!user?.email) return;

    // Only show loading if we don't have any cached data
    const hasCachedData = sharedWithMe.length > 0 || myShares.length > 0;
    if (!hasCachedData) {
      setIsLoading(true);
    }

    try {
      // Load all data in parallel for faster loading
      const [shared, shares, incoming, outgoing] = await Promise.all([
        getSharedWithMe(user.id).catch((e: unknown) => {
          const err = e as {
            message?: string;
            code?: string;
            details?: string;
          };
          console.error(
            "Failed to load shared with me:",
            err?.message || err?.code || JSON.stringify(e),
          );
          return [] as SharedUser[];
        }),
        getMyShares(user.id).catch((e: unknown) => {
          const err = e as {
            message?: string;
            code?: string;
            details?: string;
          };
          console.error(
            "Failed to load my shares:",
            err?.message || err?.code || JSON.stringify(e),
          );
          return [] as { share: Share; viewerEmail: string }[];
        }),
        getIncomingRequests(user.email, user.id).catch((e: unknown) => {
          console.error("Failed to load incoming requests:", e);
          return [] as ShareRequest[];
        }),
        getOutgoingRequests(user.id).catch((e: unknown) => {
          console.error("Failed to load outgoing requests:", e);
          return [] as ShareRequest[];
        }),
      ]);

      setSharedWithMe(shared);
      setMyShares(shares);
      setIncomingRequests(incoming.filter((r) => r.status === "pending"));
      setOutgoingRequests(outgoing.filter((r) => r.status === "pending"));

      // Cache the data for instant loading next time
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `friends-cache-${user.id}`,
          JSON.stringify({
            timestamp: Date.now(),
            sharedWithMe: shared,
            myShares: shares,
          }),
        );
      }
    } catch (error) {
      console.error("Failed to load sharing data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, sharedWithMe.length, myShares.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Search for users with debounce
  useEffect(() => {
    if (!user?.id || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchUsers(searchQuery, user.id);
        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, user?.id]);

  const handleSendRequestToUser = async (result: SearchResult) => {
    if (!user?.email) return;

    const { error } = await sendShareRequestByUserId(
      user.id,
      user.email,
      result.userId,
      result.email || undefined,
    );
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Friend request sent!");
      setSearchQuery("");
      setSearchResults([]);
      setShowSendRequest(false);
      loadData();
    }
  };

  const handleAcceptRequest = async (request: ShareRequest) => {
    if (!user) return;
    const { error } = await acceptShareRequest(
      request.id,
      request.fromUserId,
      user.id,
      [],
    );
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        `You are now friends with ${request.profile?.fullName || request.fromEmail}!`,
      );
      loadData();
    }
  };

  const handleRejectRequest = async (request: ShareRequest) => {
    const { error } = await rejectShareRequest(request.id);
    if (!error) {
      loadData();
    }
  };

  const handleCancelRequest = async (request: ShareRequest) => {
    const { error } = await cancelShareRequest(request.id);
    if (!error) {
      loadData();
    }
  };

  const handleRemoveFriend = async () => {
    if (!userToRemove || !user) return;

    const { error } = await removeFriendship(user.id, userToRemove.id);
    if (!error) {
      setShowRemoveConfirm(false);
      setUserToRemove(null);
      loadData();
    }
  };

  const handleUpdateShare = async () => {
    if (!selectedShare) return;

    const { error } = await updateSharePermissions(
      selectedShare.share.id,
      selectedActivityTypes,
    );

    if (!error) {
      setShowEditShare(false);
      setSelectedShare(null);
      loadData();
    }
  };

  const handleViewUserData = (sharedUser: SharedUser) => {
    // Update last viewed times for all activities of this user
    if (sharedUser.lastActivityDates && typeof window !== "undefined") {
      const newLastViewed = { ...lastViewedTimes };
      if (!newLastViewed[sharedUser.id]) {
        newLastViewed[sharedUser.id] = {};
      }
      // Mark all activities as viewed with current timestamp
      for (const activityId of Object.keys(sharedUser.lastActivityDates)) {
        newLastViewed[sharedUser.id][activityId] = new Date().toISOString();
      }
      setLastViewedTimes(newLastViewed);
      localStorage.setItem(
        "friendActivityLastViewed",
        JSON.stringify(newLastViewed),
      );
    }

    // Set the viewing user in AppContext and navigate to home
    setViewingUser({
      id: sharedUser.id,
      email: sharedUser.email,
      fullName: sharedUser.profile?.fullName,
      activityTypeIds:
        sharedUser.activityTypeIds || sharedUser.activityTypes.map((a) => a.id),
      avatar: sharedUser.profile?.avatar || null,
    });
    router.push("/");
  };

  if (!user) {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <p className='text-gray-500 text-center'>
          Please log in to use the sharing feature
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='w-6 h-6 border-2 border-ios-blue border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  return (
    <div className='pb-16'>
      <main className='max-w-lg mx-auto px-4 pt-6 pb-4 space-y-6'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
            Friends
          </h1>
          <button
            onClick={() => setShowSendRequest(true)}
            className='relative px-4 py-2.5 bg-ios-blue text-white rounded-full text-[14px] font-medium shadow-lg shadow-ios-blue/30'>
            + Add Friend
            {incomingRequests.length > 0 && (
              <span className='absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center'>
                {incomingRequests.length}
              </span>
            )}
          </button>
        </div>

        {message && (
          <div className='p-3 bg-ios-blue/10 rounded-lg'>
            <p className='text-sm text-ios-blue'>{message}</p>
          </div>
        )}

        {/* Incoming Friend Requests */}
        {incomingRequests.length > 0 && (
          <>
            <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1'>
              Friend Requests
            </h2>
            <div className='space-y-2'>
              {incomingRequests.map((request) => (
                <div
                  key={request.id}
                  className='p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl'>
                  <div className='flex items-center gap-3'>
                    <Avatar
                      avatar={request.profile?.avatar || null}
                      size='md'
                    />
                    <div className='min-w-0 flex-1'>
                      <p className='font-medium text-gray-900 dark:text-white truncate'>
                        {request.profile?.fullName ||
                          request.fromEmail.split("@")[0]}
                      </p>
                      <p className='text-sm text-gray-500 truncate'>
                        {request.fromEmail}
                      </p>
                    </div>
                  </div>
                  <div className='flex gap-2 mt-3'>
                    <button
                      onClick={() => handleAcceptRequest(request)}
                      className='flex-1 py-2 rounded-full bg-ios-blue text-white text-[14px] font-medium shadow-lg shadow-ios-blue/30'>
                      Accept
                    </button>
                    <button
                      onClick={() => handleRejectRequest(request)}
                      className='flex-1 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-[14px] font-medium'>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Outgoing Pending Requests */}
        {outgoingRequests.length > 0 && (
          <>
            <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1'>
              Pending Requests
            </h2>
            <div className='space-y-2'>
              {outgoingRequests.map((request) => (
                <div
                  key={request.id}
                  className='p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl'>
                  <div className='flex items-center gap-3'>
                    <Avatar
                      avatar={request.toProfile?.avatar || null}
                      size='md'
                    />
                    <div className='min-w-0 flex-1'>
                      <p className='font-medium text-gray-900 dark:text-white truncate'>
                        {request.toProfile?.fullName ||
                          request.toEmail.split("@")[0]}
                      </p>
                      <p className='text-xs text-gray-400'>
                        Waiting for approval
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancelRequest(request)}
                      className='px-3 py-1.5 text-red-500 text-[13px] font-medium'>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* My Friends Section Header */}
        <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1'>
          My Friends
        </h2>

        {/* Friends List */}
        <div className='space-y-3'>
          {sharedWithMe.length === 0 ? (
            <div className='text-center py-8'>
              <div className='flex justify-center mb-4'>
                <svg
                  className='w-12 h-12 text-gray-400 dark:text-gray-500'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={1.5}
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z'
                  />
                </svg>
              </div>
              <p className='text-gray-500'>No friends yet</p>
              <p className='text-sm text-gray-400 mt-1'>
                Tap &quot;+ Add Friend&quot; to get started
              </p>
            </div>
          ) : (
            <div className='space-y-2'>
              {sharedWithMe.map((sharedUser) => {
                // Get the activity types with icons
                const sharedActivities = (
                  sharedUser.activityTypes || []
                ).filter((at) => at.icon && at.icon in icons);

                // Find myShare for this friend (what I share with them)
                const myShareToFriend = myShares.find(
                  (s) => s.share.viewerId === sharedUser.id,
                );

                // Helper to check if activity has new updates
                const hasNewActivity = (activityId: string) => {
                  const lastActivityDate =
                    sharedUser.lastActivityDates?.[activityId];
                  if (!lastActivityDate) return false;

                  const lastViewed =
                    lastViewedTimes[sharedUser.id]?.[activityId];
                  if (!lastViewed) return true; // Never viewed = new

                  // Compare dates - if last activity is newer than last viewed, show dot
                  return new Date(lastActivityDate) > new Date(lastViewed);
                };

                return (
                  <div
                    key={sharedUser.id}
                    onClick={() => handleViewUserData(sharedUser)}
                    className='relative p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors'>
                    {/* Remove button - top right corner */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserToRemove(sharedUser);
                        setShowRemoveConfirm(true);
                      }}
                      className='absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors'>
                      <svg
                        viewBox='0 0 24 24'
                        className='w-4 h-4'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'>
                        <path d='M6 18L18 6M6 6l12 12' />
                      </svg>
                    </button>

                    <div className='flex items-center gap-3 pr-6'>
                      <Avatar
                        avatar={sharedUser.profile?.avatar || null}
                        size='md'
                      />
                      <div className='min-w-0 flex-1'>
                        <p className='font-medium text-gray-900 dark:text-white truncate'>
                          {sharedUser.profile?.fullName ||
                            sharedUser.email.split("@")[0]}
                        </p>
                        <p className='text-sm text-gray-500 truncate'>
                          {sharedUser.email}
                        </p>
                      </div>
                    </div>

                    {/* Activity icons they share with me */}
                    {sharedActivities.length > 0 && (
                      <div className='flex flex-wrap gap-3 mt-3'>
                        {sharedActivities.map((activity) => (
                          <div
                            key={activity.id}
                            className={`w-4 h-4 ${
                              hasNewActivity(activity.id)
                                ? "text-green-500"
                                : "text-gray-400 dark:text-gray-500"
                            }`}
                            title={activity.name}>
                            <Icon
                              name={activity.icon as IconName}
                              className='w-4 h-4'
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bottom row: Edit what I share + Heart + Bell */}
                    <div className='flex items-center justify-between mt-3'>
                      {myShareToFriend ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShare({
                              share: myShareToFriend.share,
                              viewerEmail: myShareToFriend.viewerEmail,
                              viewerProfile: myShareToFriend.viewerProfile,
                            });
                            setSelectedActivityTypes(
                              myShareToFriend.share.activityTypeIds,
                            );
                            setShowEditShare(true);
                          }}
                          className='text-sm text-ios-blue'>
                          {myShareToFriend.share.activityTypeIds.length === 0
                            ? "Share activities"
                            : `${myShareToFriend.share.activityTypeIds.length} shared`}
                        </button>
                      ) : (
                        <span className='text-sm text-gray-400'>
                          Not sharing
                        </span>
                      )}
                      <div className='flex items-center gap-1'>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(sharedUser.id);
                          }}
                          className='p-1.5'>
                          <svg
                            viewBox='0 0 24 24'
                            className={`w-5 h-5 transition-colors ${
                              favoriteFriends.includes(sharedUser.id)
                                ? "text-red-500 fill-red-500"
                                : "text-gray-300 dark:text-gray-600 hover:text-red-400 hover:fill-red-400"
                            }`}
                            fill={
                              favoriteFriends.includes(sharedUser.id)
                                ? "currentColor"
                                : "none"
                            }
                            stroke='currentColor'
                            strokeWidth='2'>
                            <path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUserForNotifications(sharedUser);
                            setShowNotificationModal(true);
                          }}
                          className='p-1.5'
                          title='Manage activity notifications'>
                          <svg
                            viewBox='0 0 24 24'
                            className={`w-4 h-4 transition-colors ${
                              sharedActivities.some((a) =>
                                isSubscribed(sharedUser.id, a.id),
                              )
                                ? "text-ios-blue fill-ios-blue/20"
                                : "text-gray-300 dark:text-gray-600 hover:text-ios-blue"
                            }`}
                            fill={
                              sharedActivities.some((a) =>
                                isSubscribed(sharedUser.id, a.id),
                              )
                                ? "currentColor"
                                : "none"
                            }
                            stroke='currentColor'
                            strokeWidth='2'>
                            <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                            <path d='M13.73 21a2 2 0 0 1-3.46 0' />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Send Request Modal */}
      <IOSModal
        isOpen={showSendRequest}
        onClose={() => {
          setShowSendRequest(false);
          setSearchQuery("");
          setSearchResults([]);
        }}
        title='Add Friend'>
        <div className='space-y-4'>
          {/* Search Section */}
          <div>
            <p className='text-sm text-gray-500 mb-2'>
              Search for a user to add as a friend
            </p>
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search by name or email...'
              className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white'
            />
            {searchQuery.length > 0 && searchQuery.length < 2 && (
              <p className='text-xs text-gray-400 mt-1'>
                Type at least 2 characters to search
              </p>
            )}
          </div>

          {/* Search Results */}
          {isSearching && (
            <div className='flex justify-center py-4'>
              <div className='w-5 h-5 border-2 border-ios-blue border-t-transparent rounded-full animate-spin' />
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className='space-y-2 max-h-64 overflow-y-auto'>
              {searchResults.map((result) => {
                const isFriend = sharedWithMe.some(
                  (s) => s.id === result.userId,
                );
                const isPending = outgoingRequests.some(
                  (r) => r.toUserId === result.userId,
                );
                const hasIncoming = incomingRequests.some(
                  (r) => r.fromUserId === result.userId,
                );

                return (
                  <div
                    key={result.userId}
                    className='flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg'>
                    <Avatar avatar={result.avatar} size='sm' />
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium text-gray-900 dark:text-white truncate'>
                        {result.fullName}
                      </p>
                      {result.email && (
                        <p className='text-xs text-gray-500 truncate'>
                          {result.email}
                        </p>
                      )}
                    </div>
                    {isFriend ? (
                      <span className='px-3 py-1.5 text-gray-400 text-[13px] font-medium'>
                        Friends
                      </span>
                    ) : isPending ? (
                      <span className='px-3 py-1.5 text-orange-500 text-[13px] font-medium'>
                        Pending
                      </span>
                    ) : hasIncoming ? (
                      <button
                        onClick={() => {
                          const req = incomingRequests.find(
                            (r) => r.fromUserId === result.userId,
                          );
                          if (req) handleAcceptRequest(req);
                        }}
                        className='px-3 py-1.5 bg-ios-green text-white rounded-full text-[13px] font-medium'>
                        Accept
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendRequestToUser(result)}
                        className='px-3 py-1.5 bg-ios-blue text-white rounded-full text-[13px] font-medium shadow-md shadow-ios-blue/30'>
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!isSearching &&
            searchQuery.length >= 2 &&
            searchResults.length === 0 && (
              <p className='text-sm text-gray-500 text-center py-4'>
                No users found
              </p>
            )}
        </div>
      </IOSModal>

      {/* Edit Share Modal */}
      <IOSModal
        isOpen={showEditShare}
        onClose={() => setShowEditShare(false)}
        title='Share Activities'>
        <div className='space-y-4'>
          <p className='text-sm text-gray-500'>
            Choose which of your activities{" "}
            {selectedShare?.viewerProfile?.fullName ||
              selectedShare?.viewerEmail}{" "}
            can see
          </p>
          <div className='space-y-2 max-h-60 overflow-y-auto'>
            {activityTypes.map((type) => (
              <label
                key={type.id}
                className='flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer'>
                <input
                  type='checkbox'
                  checked={selectedActivityTypes.includes(type.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedActivityTypes([
                        ...selectedActivityTypes,
                        type.id,
                      ]);
                    } else {
                      setSelectedActivityTypes(
                        selectedActivityTypes.filter((id) => id !== type.id),
                      );
                    }
                  }}
                  className='w-5 h-5 rounded text-ios-blue'
                />
                {type.icon && (
                  <Icon
                    name={type.icon as IconName}
                    className='w-5 h-5 text-gray-600 dark:text-gray-300'
                  />
                )}
                <span className='text-gray-900 dark:text-white'>
                  {type.name}
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={handleUpdateShare}
            className='w-full py-2.5 rounded-full bg-ios-blue text-white text-[14px] font-medium shadow-lg shadow-ios-blue/30'>
            Save
          </button>
        </div>
      </IOSModal>

      {/* Remove Friend Confirmation Modal */}
      <IOSModal
        isOpen={showRemoveConfirm}
        onClose={() => {
          setShowRemoveConfirm(false);
          setUserToRemove(null);
        }}
        title='Remove Friend'>
        <div className='space-y-4'>
          <div className='flex flex-col items-center py-4'>
            <Avatar avatar={userToRemove?.profile?.avatar || null} size='lg' />
            <p className='mt-3 font-medium text-gray-900 dark:text-white'>
              {userToRemove?.profile?.fullName || userToRemove?.email}
            </p>
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400 text-center'>
            You will no longer be able to see their activities. They would need
            to share with you again if you want to reconnect.
          </p>
          <div className='flex gap-3'>
            <button
              onClick={() => {
                setShowRemoveConfirm(false);
                setUserToRemove(null);
              }}
              className='flex-1 py-2.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-[14px] font-medium'>
              Cancel
            </button>
            <button
              onClick={handleRemoveFriend}
              className='flex-1 py-2.5 rounded-full bg-red-500 text-white text-[14px] font-medium shadow-lg shadow-red-500/30'>
              Remove
            </button>
          </div>
        </div>
      </IOSModal>

      {/* Activity Notifications Modal */}
      <IOSModal
        isOpen={showNotificationModal}
        onClose={() => {
          setShowNotificationModal(false);
          setSelectedUserForNotifications(null);
        }}
        title='Activity Notifications'>
        <div className='space-y-4'>
          {selectedUserForNotifications && (
            <>
              <div className='flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700'>
                <Avatar
                  avatar={selectedUserForNotifications.profile?.avatar || null}
                  size='md'
                />
                <div>
                  <p className='font-medium text-gray-900 dark:text-white'>
                    {selectedUserForNotifications.profile?.fullName ||
                      selectedUserForNotifications.email.split("@")[0]}
                  </p>
                  <p className='text-sm text-gray-500'>
                    Get notified when activities update
                  </p>
                </div>
              </div>
              <div className='space-y-2'>
                {(selectedUserForNotifications.activityTypes || []).map(
                  (activity) => {
                    const subscribed = isSubscribed(
                      selectedUserForNotifications.id,
                      activity.id,
                    );
                    return (
                      <button
                        key={activity.id}
                        onClick={() => {
                          if (subscribed) {
                            removeSubscription(
                              selectedUserForNotifications.id,
                              activity.id,
                            );
                          } else {
                            addSubscription(
                              selectedUserForNotifications.id,
                              activity.id,
                            );
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                          subscribed
                            ? "bg-ios-blue/10 dark:bg-ios-blue/20"
                            : "bg-gray-100 dark:bg-gray-700",
                        )}>
                        <div className='w-8 h-8 flex items-center justify-center'>
                          {activity.icon && activity.icon in icons ? (
                            <Icon
                              name={activity.icon as IconName}
                              className='w-6 h-6 text-gray-600 dark:text-gray-300'
                            />
                          ) : (
                            <span className='text-xl'>📊</span>
                          )}
                        </div>
                        <span className='flex-1 text-left text-[15px] text-gray-900 dark:text-white'>
                          {activity.name}
                        </span>
                        <svg
                          viewBox='0 0 24 24'
                          className={cn(
                            "w-5 h-5 transition-colors",
                            subscribed
                              ? "text-ios-blue fill-ios-blue"
                              : "text-gray-400",
                          )}
                          fill={subscribed ? "currentColor" : "none"}
                          stroke='currentColor'
                          strokeWidth='2'>
                          <path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' />
                          <path d='M13.73 21a2 2 0 0 1-3.46 0' />
                        </svg>
                      </button>
                    );
                  },
                )}
              </div>
              {(selectedUserForNotifications.activityTypes || []).length ===
                0 && (
                <p className='text-center text-gray-500 py-4'>
                  No activities shared
                </p>
              )}
            </>
          )}
        </div>
      </IOSModal>
    </div>
  );
}

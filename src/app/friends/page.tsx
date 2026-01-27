"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePeriodAlert } from "@/context/PeriodAlertContext";
import { cn } from "@/lib/utils";
import {
  sendShareRequest,
  sendShareRequestByUserId,
  getIncomingRequests,
  getOutgoingRequests,
  acceptShareRequest,
  rejectShareRequest,
  getSharedWithMe,
  getMyShares,
  removeShare,
  removeSharedConnection,
  updateSharePermissions,
  searchUsers,
  ShareRequest,
  SharedUser,
  Share,
  UserProfile,
  SearchResult,
} from "@/lib/sharing";
import { IOSModal } from "@/components/ios";
import { Avatar } from "@/components/ProfileSetup";
import { Icon, IconName, icons } from "@/components/Icons";

export default function FriendsPage() {
  const { user } = useAuth();
  const { activityTypes, setViewingUser } = useApp();
  const { t } = useLanguage();
  const { checkNow } = usePeriodAlert();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "shared" | "requests" | "myShares"
  >("shared");
  const [incomingRequests, setIncomingRequests] = useState<ShareRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ShareRequest[]>([]);
  const [showAllOutgoing, setShowAllOutgoing] = useState(false);
  const [sharedWithMe, setSharedWithMe] = useState<SharedUser[]>([]);
  const [myShares, setMyShares] = useState<
    { share: Share; viewerEmail: string; viewerProfile?: UserProfile }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showSendRequest, setShowSendRequest] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showEditShare, setShowEditShare] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [userToRemove, setUserToRemove] = useState<SharedUser | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ShareRequest | null>(
    null,
  );
  const [selectedShare, setSelectedShare] = useState<{
    share: Share;
    viewerEmail: string;
    viewerProfile?: UserProfile;
  } | null>(null);
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>(
    [],
  );
  const [requestEmail, setRequestEmail] = useState("");
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

  // Period alert friends - alert when their Period mood changes
  const [periodAlertFriends, setPeriodAlertFriends] = useState<string[]>([]);

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

      const periodAlerts = localStorage.getItem("periodAlertFriendsList");
      if (periodAlerts) {
        try {
          setPeriodAlertFriends(JSON.parse(periodAlerts));
        } catch (e) {
          console.error("Failed to parse period alert friends:", e);
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

  const togglePeriodAlert = (userId: string) => {
    setPeriodAlertFriends((prev) => {
      const isEnabling = !prev.includes(userId);
      const newAlerts = isEnabling
        ? [...prev, userId]
        : prev.filter((id) => id !== userId);
      localStorage.setItem("periodAlertFriendsList", JSON.stringify(newAlerts));

      // If enabling, trigger immediate check with force alert
      if (isEnabling) {
        // Small delay to ensure localStorage is updated
        setTimeout(() => {
          checkNow(userId);
        }, 100);
      }

      return newAlerts;
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
            if (data.incomingRequests)
              setIncomingRequests(data.incomingRequests);
            if (data.outgoingRequests)
              setOutgoingRequests(data.outgoingRequests);
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
    const hasCachedData =
      incomingRequests.length > 0 ||
      outgoingRequests.length > 0 ||
      sharedWithMe.length > 0 ||
      myShares.length > 0;
    if (!hasCachedData) {
      setIsLoading(true);
    }

    try {
      // Load all data in parallel for faster loading
      const [incoming, outgoing, shared, shares] = await Promise.all([
        getIncomingRequests(user.email, user.id).catch((e: unknown) => {
          const err = e as {
            message?: string;
            code?: string;
            details?: string;
          };
          console.error(
            "Failed to load incoming requests:",
            err?.message || err?.code || JSON.stringify(e),
          );
          return [] as ShareRequest[];
        }),
        getOutgoingRequests(user.id).catch((e: unknown) => {
          const err = e as {
            message?: string;
            code?: string;
            details?: string;
          };
          console.error(
            "Failed to load outgoing requests:",
            err?.message || err?.code || JSON.stringify(e),
          );
          return [] as ShareRequest[];
        }),
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
      ]);

      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
      setSharedWithMe(shared);
      setMyShares(shares);

      // Cache the data for instant loading next time
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `friends-cache-${user.id}`,
          JSON.stringify({
            timestamp: Date.now(),
            incomingRequests: incoming,
            outgoingRequests: outgoing,
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
  }, [
    user,
    incomingRequests.length,
    outgoingRequests.length,
    sharedWithMe.length,
    myShares.length,
  ]);

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

  const handleSendRequest = async (email?: string) => {
    const targetEmail = email || requestEmail.trim().toLowerCase();
    if (!user?.email || !targetEmail) return;

    const { error } = await sendShareRequest(user.id, user.email, targetEmail);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(t("friends.requestSent"));
      setRequestEmail("");
      setSearchQuery("");
      setSearchResults([]);
      setShowSendRequest(false);
      loadData();
    }
  };

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
      setMessage(t("friends.requestSent"));
      setSearchQuery("");
      setSearchResults([]);
      setShowSendRequest(false);
      loadData();
    }
  };

  const handleAcceptRequest = async () => {
    if (!selectedRequest || !user) return;

    const { error } = await acceptShareRequest(
      selectedRequest.id,
      user.id,
      selectedRequest.fromUserId,
      selectedActivityTypes,
    );

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(t("friends.requestAccepted"));
      setShowAcceptModal(false);
      setSelectedRequest(null);
      setSelectedActivityTypes([]);
      loadData();
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const { error } = await rejectShareRequest(requestId);
    if (!error) {
      loadData();
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    if (confirm(t("friends.confirmRemove"))) {
      const { error } = await removeShare(shareId);
      if (!error) {
        loadData();
      }
    }
  };

  const handleRemoveFriend = async () => {
    if (!userToRemove || !user) return;

    const { error } = await removeSharedConnection(userToRemove.id, user.id);
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
      activityTypeIds:
        sharedUser.activityTypeIds || sharedUser.activityTypes.map((a) => a.id),
    });
    router.push("/");
  };

  if (!user) {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <p className='text-gray-500 text-center'>
          {t("friends.loginRequired")}
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
            {t("friends.title")}
          </h1>
          <button
            onClick={() => setShowSendRequest(true)}
            className='px-4 py-2.5 bg-ios-blue text-white rounded-full text-[14px] font-medium shadow-lg shadow-ios-blue/30'>
            + {t("friends.addFriend")}
          </button>
        </div>

        {message && (
          <div className='p-3 bg-ios-blue/10 rounded-lg'>
            <p className='text-sm text-ios-blue'>{message}</p>
          </div>
        )}

        {/* Tabs */}
        <div className='flex gap-2'>
          {[
            {
              id: "shared",
              label: t("friends.sharedWithMe"),
              count: sharedWithMe.length,
            },
            {
              id: "requests",
              label: t("friends.requests"),
              count: incomingRequests.length,
            },
            {
              id: "myShares",
              label: t("friends.myShares"),
              count: myShares.length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex-1 px-3 py-2.5 rounded-full text-[14px] font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-ios-blue text-white shadow-lg shadow-ios-blue/30"
                  : "bg-white/80 dark:bg-ios-card-dark text-gray-700 dark:text-gray-300",
              )}>
              {tab.label}
              {tab.count > 0 && (
                <span className='ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs'>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Shared With Me Tab */}
        {activeTab === "shared" && (
          <div className='space-y-3'>
            {sharedWithMe.length === 0 ? (
              <div className='text-center py-8'>
                <p className='text-4xl mb-4'>👥</p>
                <p className='text-gray-500'>{t("friends.noSharedData")}</p>
              </div>
            ) : (
              <div className='space-y-2'>
                {sharedWithMe.map((sharedUser) => {
                  // Get the activity types with icons
                  const sharedActivities = (
                    sharedUser.activityTypes || []
                  ).filter((at) => at.icon && at.icon in icons);

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

                      {/* Activity icons - left side */}
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

                      {/* Heart and Bell buttons - bottom right corner */}
                      <div className='absolute bottom-2 right-2 flex items-center gap-1'>
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
                            togglePeriodAlert(sharedUser.id);
                          }}
                          className='p-1.5'
                          title={t("friends.alertLovedOne")}>
                          <svg
                            viewBox='0 0 24 24'
                            className={`w-4 h-4 transition-colors ${
                              periodAlertFriends.includes(sharedUser.id)
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-300 dark:text-gray-600 hover:text-yellow-400"
                            }`}
                            fill={
                              periodAlertFriends.includes(sharedUser.id)
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
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div className='space-y-4'>
            {/* Incoming */}
            <div>
              <h3 className='text-sm font-medium text-gray-500 mb-2'>
                {t("friends.incoming")}
              </h3>
              {incomingRequests.length === 0 ? (
                <p className='text-sm text-gray-400 py-4 text-center'>
                  {t("friends.noIncoming")}
                </p>
              ) : (
                <div className='space-y-2'>
                  {incomingRequests.map((req) => (
                    <div
                      key={req.id}
                      className='p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl flex items-center justify-between'>
                      <div className='flex items-center gap-3 min-w-0 flex-1'>
                        <Avatar
                          avatar={req.profile?.avatar || null}
                          size='md'
                        />
                        <div className='min-w-0'>
                          <p className='font-medium text-gray-900 dark:text-white truncate'>
                            {req.profile?.fullName || req.fromEmail}
                          </p>
                          <p className='text-sm text-gray-500 truncate'>
                            {req.fromEmail}
                          </p>
                        </div>
                      </div>
                      <div className='flex gap-2 flex-shrink-0'>
                        <button
                          onClick={() => {
                            setSelectedRequest(req);
                            setSelectedActivityTypes([]);
                            setShowAcceptModal(true);
                          }}
                          className='px-3 py-1.5 bg-ios-blue text-white rounded-full text-[13px] font-medium shadow-md shadow-ios-blue/30'>
                          {t("friends.accept")}
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className='px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-[13px] font-medium'>
                          {t("friends.reject")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing */}
            <div>
              <h3 className='text-sm font-medium text-gray-500 mb-2'>
                {t("friends.outgoing")}
              </h3>
              {outgoingRequests.length === 0 ? (
                <p className='text-sm text-gray-400 py-4 text-center'>
                  {t("friends.noOutgoing")}
                </p>
              ) : (
                <>
                  <div className='space-y-2'>
                    {[...outgoingRequests]
                      .sort((a, b) => {
                        // Sort by status: accepted first, then pending, then rejected
                        const statusOrder = {
                          accepted: 0,
                          pending: 1,
                          rejected: 2,
                        };
                        return (
                          (statusOrder[a.status] || 2) -
                          (statusOrder[b.status] || 2)
                        );
                      })
                      .slice(0, showAllOutgoing ? undefined : 10)
                      .map((req) => (
                        <div
                          key={req.id}
                          className='p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl flex items-center gap-3'>
                          <Avatar
                            avatar={req.toProfile?.avatar || null}
                            size='md'
                          />
                          <div className='min-w-0 flex-1'>
                            <p className='font-medium text-gray-900 dark:text-white truncate'>
                              {req.toProfile?.fullName || req.toEmail}
                            </p>
                            {req.toProfile?.email && (
                              <p className='text-sm text-gray-500 truncate'>
                                {req.toProfile.email}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-xs px-2 py-1 rounded-full shrink-0",
                              req.status === "pending" &&
                                "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                              req.status === "accepted" &&
                                "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                              req.status === "rejected" &&
                                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                            )}>
                            {req.status === "pending"
                              ? t("friends.pending")
                              : req.status === "accepted"
                                ? t("friends.accepted")
                                : t("friends.rejected")}
                          </span>
                        </div>
                      ))}
                  </div>
                  {outgoingRequests.length > 10 && (
                    <button
                      onClick={() => setShowAllOutgoing(!showAllOutgoing)}
                      className='w-full mt-3 py-2 text-sm text-ios-blue font-medium'>
                      {showAllOutgoing
                        ? "Show less"
                        : `View all (${outgoingRequests.length})`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* My Shares Tab */}
        {activeTab === "myShares" && (
          <div className='space-y-3'>
            {myShares.length === 0 ? (
              <div className='text-center py-8'>
                <p className='text-4xl mb-4'>🔒</p>
                <p className='text-gray-500'>{t("friends.noShares")}</p>
              </div>
            ) : (
              myShares.map(({ share, viewerEmail, viewerProfile }) => (
                <div
                  key={share.id}
                  className='relative p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl'>
                  {/* Remove button - top right corner */}
                  <button
                    onClick={() => handleRemoveShare(share.id)}
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
                    <Avatar avatar={viewerProfile?.avatar || null} size='md' />
                    <div className='min-w-0 flex-1'>
                      <p className='font-medium text-gray-900 dark:text-white'>
                        {viewerProfile?.fullName || viewerEmail}
                      </p>
                      <p className='text-sm text-gray-500 truncate'>
                        {viewerEmail}
                      </p>
                    </div>
                  </div>

                  {/* Bottom row with activity count and edit */}
                  <div className='flex items-center justify-between mt-3'>
                    <p className='text-sm text-gray-500'>
                      {share.activityTypeIds.length}{" "}
                      {share.activityTypeIds.length === 1
                        ? "activity"
                        : "activities"}{" "}
                      shared
                    </p>
                    <button
                      onClick={() => {
                        setSelectedShare({
                          share,
                          viewerEmail,
                          viewerProfile,
                        });
                        setSelectedActivityTypes(share.activityTypeIds);
                        setShowEditShare(true);
                      }}
                      className='text-sm text-ios-blue'>
                      {t("friends.edit")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Send Request Modal */}
      <IOSModal
        isOpen={showSendRequest}
        onClose={() => {
          setShowSendRequest(false);
          setSearchQuery("");
          setSearchResults([]);
          setRequestEmail("");
        }}
        title={t("friends.addFriend")}>
        <div className='space-y-4'>
          {/* Search Section */}
          <div>
            <p className='text-sm text-gray-500 mb-2'>
              {t("friends.searchUsers")}
            </p>
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("friends.searchPlaceholder")}
              className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white'
            />
            {searchQuery.length > 0 && searchQuery.length < 2 && (
              <p className='text-xs text-gray-400 mt-1'>
                {t("friends.searchHint")}
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
            <div className='space-y-2 max-h-48 overflow-y-auto'>
              {searchResults.map((result) => (
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
                  <button
                    onClick={() => handleSendRequestToUser(result)}
                    className='px-3 py-1.5 bg-ios-blue text-white rounded-full text-[13px] font-medium shadow-md shadow-ios-blue/30'>
                    {t("friends.send")}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!isSearching &&
            searchQuery.length >= 2 &&
            searchResults.length === 0 && (
              <p className='text-sm text-gray-500 text-center py-4'>
                {t("friends.noResults")}
              </p>
            )}

          {/* Divider */}
          <div className='flex items-center gap-3'>
            <div className='flex-1 h-px bg-gray-200 dark:bg-gray-600' />
            <span className='text-xs text-gray-400'>or</span>
            <div className='flex-1 h-px bg-gray-200 dark:bg-gray-600' />
          </div>

          {/* Direct Email Input */}
          <div>
            <p className='text-sm text-gray-500 mb-2'>
              {t("friends.sendRequestDesc")}
            </p>
            <input
              type='email'
              value={requestEmail}
              onChange={(e) => setRequestEmail(e.target.value)}
              placeholder={t("friends.emailPlaceholder")}
              className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white'
            />
          </div>
          <button
            onClick={() => handleSendRequest()}
            disabled={!requestEmail.trim()}
            className='w-full py-2.5 rounded-full bg-ios-blue text-white text-[14px] font-medium shadow-lg shadow-ios-blue/30 disabled:opacity-50 disabled:shadow-none'>
            {t("friends.send")}
          </button>
        </div>
      </IOSModal>

      {/* Accept Request Modal */}
      <IOSModal
        isOpen={showAcceptModal}
        onClose={() => setShowAcceptModal(false)}
        title={t("friends.selectActivities")}>
        <div className='space-y-4'>
          <p className='text-sm text-gray-500'>
            {t("friends.selectActivitiesDesc")} {selectedRequest?.fromEmail}
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
            onClick={handleAcceptRequest}
            disabled={selectedActivityTypes.length === 0}
            className='w-full py-2.5 rounded-full bg-ios-blue text-white text-[14px] font-medium shadow-lg shadow-ios-blue/30 disabled:opacity-50 disabled:shadow-none'>
            {t("friends.acceptAndShare")}
          </button>
        </div>
      </IOSModal>

      {/* Edit Share Modal */}
      <IOSModal
        isOpen={showEditShare}
        onClose={() => setShowEditShare(false)}
        title={t("friends.editPermissions")}>
        <div className='space-y-4'>
          <p className='text-sm text-gray-500'>
            {t("friends.editPermissionsDesc")} {selectedShare?.viewerEmail}
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
            {t("friends.saveChanges")}
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
        title={t("friends.removeFriend") || "Remove Friend"}>
        <div className='space-y-4'>
          <div className='flex flex-col items-center py-4'>
            <Avatar avatar={userToRemove?.profile?.avatar || null} size='lg' />
            <p className='mt-3 font-medium text-gray-900 dark:text-white'>
              {userToRemove?.profile?.fullName || userToRemove?.email}
            </p>
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400 text-center'>
            {t("friends.removeFriendWarning") ||
              "You will no longer be able to see their activities. They would need to share with you again if you want to reconnect."}
          </p>
          <div className='flex gap-3'>
            <button
              onClick={() => {
                setShowRemoveConfirm(false);
                setUserToRemove(null);
              }}
              className='flex-1 py-2.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-[14px] font-medium'>
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              onClick={handleRemoveFriend}
              className='flex-1 py-2.5 rounded-full bg-red-500 text-white text-[14px] font-medium shadow-lg shadow-red-500/30'>
              {t("common.remove") || "Remove"}
            </button>
          </div>
        </div>
      </IOSModal>
    </div>
  );
}

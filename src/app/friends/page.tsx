"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCounts,
  ChatMessage,
} from "@/lib/chat";

export default function FriendsPage() {
  const { user, profile: myProfile } = useAuth();
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

  // Info mode
  const [infoMode, setInfoMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("info_mode") === "true";
  });
  const [showInfoPopup, setShowInfoPopup] = useState(false);

  useEffect(() => {
    const handler = () =>
      setInfoMode(localStorage.getItem("info_mode") === "true");
    window.addEventListener("infoModeUpdated", handler);
    return () => window.removeEventListener("infoModeUpdated", handler);
  }, []);

  // Modal for managing activity notifications
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedUserForNotifications, setSelectedUserForNotifications] =
    useState<SharedUser | null>(null);

  // Tooltip state for icon explanations
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Expanded card info (shows extra icons row)
  const [expandedCardInfo, setExpandedCardInfo] = useState<string | null>(null);

  // Friends list filter
  const [friendsFilter, setFriendsFilter] = useState("");

  // Sharing overview modal
  const [showSharingOverview, setShowSharingOverview] = useState(false);
  const [sharingOverviewUser, setSharingOverviewUser] =
    useState<SharedUser | null>(null);

  // Chat state
  const [expandedChat, setExpandedChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [chatInput, setChatInput] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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

  // Auto-dismiss tooltips
  useEffect(() => {
    if (activeTooltip) {
      const timer = setTimeout(() => setActiveTooltip(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [activeTooltip]);

  // Load unread message counts
  useEffect(() => {
    if (!user) return;
    const loadUnread = async () => {
      try {
        const counts = await getUnreadCounts(user.id);
        setUnreadCounts(counts);
      } catch (e) {
        console.warn("Failed to load unread counts:", e);
      }
    };
    loadUnread();
    const interval = setInterval(loadUnread, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Poll for new messages when chat is expanded
  useEffect(() => {
    if (!expandedChat || !user) return;
    const poll = async () => {
      try {
        const msgs = await getMessages(user.id, expandedChat);
        setChatMessages((prev) => ({ ...prev, [expandedChat]: msgs }));
        await markMessagesAsRead(user.id, expandedChat);
        // Clear unread count for this friend
        setUnreadCounts((prev) => {
          const next = { ...prev };
          delete next[expandedChat];
          return next;
        });
      } catch (e) {
        console.warn("Chat poll failed:", e);
      }
    };
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [expandedChat, user]);

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (chatScrollRef.current) {
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [chatMessages, expandedChat]);

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
      await loadData();
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

  const handleToggleChat = async (sharedUser: SharedUser) => {
    if (expandedChat === sharedUser.id) {
      setExpandedChat(null);
      setChatInput("");
      return;
    }
    setExpandedChat(sharedUser.id);
    setChatInput("");
    // Load messages
    if (user) {
      try {
        const msgs = await getMessages(user.id, sharedUser.id);
        setChatMessages((prev) => ({ ...prev, [sharedUser.id]: msgs }));
        await markMessagesAsRead(user.id, sharedUser.id);
        setUnreadCounts((prev) => {
          const next = { ...prev };
          delete next[sharedUser.id];
          return next;
        });
      } catch (e) {
        console.warn("Failed to load chat:", e);
      }
    }
  };

  const handleSendMessage = async (sharedUser: SharedUser) => {
    if (!chatInput.trim() || !user || isSendingMessage) return;
    const content = chatInput.trim();
    setChatInput("");
    setIsSendingMessage(true);
    try {
      const { data, error } = await sendMessage(
        user.id,
        sharedUser.id,
        content,
      );
      if (!error && data) {
        setChatMessages((prev) => ({
          ...prev,
          [sharedUser.id]: [...(prev[sharedUser.id] || []), data],
        }));
        // Create notification for recipient via context
        // (this only adds locally - the recipient will see it when they poll)
      }
    } catch (e) {
      console.warn("Failed to send message:", e);
      setChatInput(content); // Restore input on failure
    } finally {
      setIsSendingMessage(false);
    }
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
      {/* Info mode banner */}
      {infoMode && (
        <div className='bg-ios-blue text-white px-4 py-2.5 flex items-center justify-between max-w-lg mx-auto'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-semibold italic w-5 h-5 rounded-full border-2 border-white/60 flex items-center justify-center text-[11px] leading-none'>
              i
            </span>
            <p className='text-sm font-medium'>Info Mode</p>
          </div>
          <button
            data-info-button
            onClick={() => {
              setInfoMode(false);
              localStorage.setItem("info_mode", "false");
              window.dispatchEvent(new Event("infoModeUpdated"));
            }}
            className='px-3 py-1.5 bg-white/20 rounded-full text-[13px] font-medium hover:bg-white/30 transition-colors'>
            Turn off
          </button>
        </div>
      )}

      <main className='max-w-lg mx-auto px-4 pt-6 pb-4 space-y-6'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
            Friends
          </h1>
          <button
            onClick={() => setShowSendRequest(true)}
            data-info='Add Friend. Send a friend request by entering their email address.'
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
                      data-info='Accept. Approve this friend request to start sharing data.'
                      onClick={() => handleAcceptRequest(request)}
                      className='flex-1 py-2 rounded-full bg-ios-blue text-white text-[14px] font-medium shadow-lg shadow-ios-blue/30'>
                      Accept
                    </button>
                    <button
                      data-info='Decline. Reject this friend request.'
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
                      data-info='Cancel. Withdraw your pending friend request.'
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

        {/* Friends search bar + info toggle */}
        <div className='flex items-center gap-2'>
          <div className='flex-1 relative'>
            <svg
              viewBox='0 0 24 24'
              className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'>
              <circle cx='11' cy='11' r='8' />
              <line x1='21' y1='21' x2='16.65' y2='16.65' />
            </svg>
            <input
              type='text'
              value={friendsFilter}
              onChange={(e) => setFriendsFilter(e.target.value)}
              placeholder='Search friends...'
              className='w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-[14px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-ios-blue/30 transition-shadow'
            />
          </div>
          <button
            data-info='Toggle info. Show or hide sharing details on each friend card.'
            onClick={() =>
              setExpandedCardInfo(expandedCardInfo ? null : "__all__")
            }
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all active:scale-95 ${
              expandedCardInfo
                ? "bg-ios-blue text-white shadow-sm"
                : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}>
            <svg
              viewBox='0 0 24 24'
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'>
              <circle cx='12' cy='5' r='1' />
              <circle cx='12' cy='12' r='1' />
              <circle cx='12' cy='19' r='1' />
            </svg>
            Info
          </button>
        </div>

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
            <div className='space-y-1.5'>
              {[...sharedWithMe]
                .filter((u) => {
                  if (!friendsFilter.trim()) return true;
                  const q = friendsFilter.toLowerCase();
                  const name = (u.profile?.fullName || "").toLowerCase();
                  const email = u.email.toLowerCase();
                  return name.includes(q) || email.includes(q);
                })
                .sort((a, b) => {
                  const aUnread = unreadCounts[a.id] || 0;
                  const bUnread = unreadCounts[b.id] || 0;
                  if (aUnread > 0 && bUnread === 0) return -1;
                  if (aUnread === 0 && bUnread > 0) return 1;
                  return 0;
                })
                .map((sharedUser) => {
                  // Get the activity types with icons
                  const sharedActivities = (
                    sharedUser.activityTypes || []
                  ).filter((at) => at.icon && at.icon in icons);

                  // Find myShare for this friend (what I share with them)
                  const myShareToFriend = myShares.find(
                    (s) => s.share.viewerId === sharedUser.id,
                  );

                  const isInfoExpanded =
                    expandedCardInfo === "__all__" ||
                    expandedCardInfo === sharedUser.id;

                  return (
                    <div
                      key={sharedUser.id}
                      data-info='Friend card. Tap to open chat. Use the eye icon to view their data.'
                      className='relative bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden cursor-pointer active:bg-gray-50 dark:active:bg-gray-800/60 transition-colors'
                      onClick={() => {
                        handleToggleChat(sharedUser);
                      }}>
                      {/* Main row: avatar, name, unread badge, spy icon */}
                      <div className='flex items-center gap-2.5 px-3 py-2'>
                        <Avatar
                          avatar={sharedUser.profile?.avatar || null}
                          size='sm'
                        />
                        <p className='font-medium text-[15px] text-gray-900 dark:text-white truncate flex-1 min-w-0'>
                          {sharedUser.profile?.fullName ||
                            sharedUser.email.split("@")[0]}
                        </p>

                        {/* Unread badge (no button, just indicator) */}
                        {(unreadCounts[sharedUser.id] || 0) > 0 &&
                          expandedChat !== sharedUser.id && (
                            <span className='min-w-[20px] h-[20px] bg-ios-green text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 flex-shrink-0'>
                              {unreadCounts[sharedUser.id]}
                            </span>
                          )}

                        {/* Spy icon */}
                        <button
                          data-info="View data. Browse this friend's daily log and activities."
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewUserData(sharedUser);
                          }}
                          className='p-1.5 flex-shrink-0 active:scale-95 transition-transform'>
                          <svg
                            viewBox='0 0 24 24'
                            className='w-[20px] h-[20px] text-gray-500 dark:text-gray-400 transition-colors'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='1.8'
                            strokeLinecap='round'
                            strokeLinejoin='round'>
                            <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                            <circle cx='12' cy='12' r='3' />
                          </svg>
                        </button>
                      </div>

                      {/* Expandable info row */}
                      {isInfoExpanded && (
                        <div className='flex items-center gap-0.5 px-3 pb-2 border-t border-gray-100 dark:border-gray-700/40 pt-1.5'>
                          {/* Sharing overview */}
                          <button
                            data-info='Sharing. View and edit what activities you share with this friend.'
                            onClick={(e) => {
                              e.stopPropagation();
                              setSharingOverviewUser(sharedUser);
                              setShowSharingOverview(true);
                            }}
                            className='p-1.5'>
                            <svg
                              viewBox='0 0 24 24'
                              className={`w-[17px] h-[17px] transition-colors ${
                                sharedActivities.length > 0 ||
                                (myShareToFriend &&
                                  myShareToFriend.share.activityTypeIds.length >
                                    0)
                                  ? "text-ios-blue"
                                  : "text-gray-300 dark:text-gray-600"
                              }`}
                              fill='none'
                              stroke='currentColor'
                              strokeWidth='2'
                              strokeLinecap='round'
                              strokeLinejoin='round'>
                              <path d='M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' />
                              <polyline points='16 6 12 2 8 6' />
                              <line x1='12' y1='2' x2='12' y2='15' />
                            </svg>
                          </button>

                          {/* Heart (favorite) */}
                          <div className='relative'>
                            <button
                              data-info="Favorite. Mark as favorite to see this friend's movie and TV ratings."
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(sharedUser.id);
                                setActiveTooltip(
                                  activeTooltip === `${sharedUser.id}-favorite`
                                    ? null
                                    : `${sharedUser.id}-favorite`,
                                );
                              }}
                              className='p-1.5'>
                              <svg
                                viewBox='0 0 24 24'
                                className={`w-[17px] h-[17px] transition-colors ${
                                  favoriteFriends.includes(sharedUser.id)
                                    ? "text-red-500 fill-red-500"
                                    : "text-gray-300 dark:text-gray-600"
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
                            {activeTooltip === `${sharedUser.id}-favorite` && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className='absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-xl shadow-lg whitespace-nowrap z-10 animate-in fade-in zoom-in-95 duration-150'>
                                Favorite for Movies & TV ratings
                                <div className='absolute top-full left-3 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45 -mt-1' />
                              </div>
                            )}
                          </div>

                          {/* Bell (notifications) */}
                          <button
                            data-info='Notifications. Subscribe to get notified when this friend logs specific activities.'
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUserForNotifications(sharedUser);
                              setShowNotificationModal(true);
                            }}
                            className='p-1.5'>
                            <svg
                              viewBox='0 0 24 24'
                              className={`w-[17px] h-[17px] transition-colors ${
                                sharedActivities.some((a) =>
                                  isSubscribed(sharedUser.id, a.id),
                                )
                                  ? "text-ios-blue fill-ios-blue/20"
                                  : "text-gray-300 dark:text-gray-600"
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

                          <div className='flex-1' />

                          {/* Remove friend */}
                          <button
                            data-info='Remove friend. Unfriend this person and stop sharing data.'
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserToRemove(sharedUser);
                              setShowRemoveConfirm(true);
                            }}
                            className='p-1.5 text-red-500 dark:text-red-400 transition-colors'>
                            <svg
                              viewBox='0 0 24 24'
                              className='w-[17px] h-[17px]'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth='2'
                              strokeLinecap='round'
                              strokeLinejoin='round'>
                              <path d='M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2' />
                              <circle cx='9' cy='7' r='4' />
                              <line x1='17' y1='11' x2='22' y2='11' />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* Expandable Chat */}
                      {expandedChat === sharedUser.id && (
                        <div
                          className='border-t border-gray-200/60 dark:border-gray-700/60'
                          onClick={(e) => e.stopPropagation()}>
                          {/* Messages */}
                          <div
                            ref={chatScrollRef}
                            data-scrollable
                            className='max-h-72 overflow-y-auto px-3 py-3 space-y-1'>
                            {(chatMessages[sharedUser.id] || []).length ===
                            0 ? (
                              <p className='text-center text-gray-400 dark:text-gray-500 text-[13px] py-8'>
                                No messages yet. Say hi! 👋
                              </p>
                            ) : (
                              (chatMessages[sharedUser.id] || []).map(
                                (msg, i) => {
                                  const isMe = msg.senderId === user?.id;
                                  const time = new Date(
                                    msg.createdAt,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  });
                                  const msgs =
                                    chatMessages[sharedUser.id] || [];
                                  const showDate =
                                    i === 0 ||
                                    new Date(msg.createdAt).toDateString() !==
                                      new Date(
                                        msgs[i - 1].createdAt,
                                      ).toDateString();
                                  return (
                                    <div key={msg.id}>
                                      {showDate && (
                                        <p className='text-center text-[11px] text-gray-400 dark:text-gray-500 my-2 font-medium'>
                                          {new Date(
                                            msg.createdAt,
                                          ).toLocaleDateString([], {
                                            month: "short",
                                            day: "numeric",
                                          })}
                                        </p>
                                      )}
                                      <div
                                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                        <div
                                          className={cn(
                                            "max-w-[75%] px-3 py-2 text-[14px] leading-snug",
                                            isMe
                                              ? "bg-ios-blue text-white rounded-2xl rounded-br-md"
                                              : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl rounded-bl-md",
                                          )}>
                                          <p className='break-words'>
                                            {msg.content}
                                          </p>
                                          <p
                                            className={`text-[10px] mt-0.5 text-right ${isMe ? "text-white/60" : "text-gray-400 dark:text-gray-500"}`}>
                                            {time}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                },
                              )
                            )}
                          </div>
                          {/* Input */}
                          <div className='px-3 pb-3 pt-1'>
                            <div className='flex items-end gap-2'>
                              <input
                                type='text'
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(sharedUser);
                                  }
                                }}
                                placeholder='Message...'
                                className='flex-1 px-3.5 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-[14px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-ios-blue/30 transition-shadow'
                              />
                              <button
                                onClick={() => handleSendMessage(sharedUser)}
                                disabled={!chatInput.trim() || isSendingMessage}
                                className='w-8 h-8 flex items-center justify-center bg-ios-blue rounded-full disabled:opacity-40 transition-all active:scale-95 flex-shrink-0'>
                                <svg
                                  viewBox='0 0 24 24'
                                  className='w-4 h-4 text-white'
                                  fill='none'
                                  stroke='currentColor'
                                  strokeWidth='2.5'
                                  strokeLinecap='round'
                                  strokeLinejoin='round'>
                                  <line x1='12' y1='19' x2='12' y2='5' />
                                  <polyline points='5 12 12 5 19 12' />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
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

      {/* Sharing Overview Modal */}
      <IOSModal
        isOpen={showSharingOverview}
        onClose={() => {
          setShowSharingOverview(false);
          setSharingOverviewUser(null);
        }}
        title='Shared Activities'>
        {sharingOverviewUser &&
          (() => {
            const overviewSharedActivities = (
              sharingOverviewUser.activityTypes || []
            ).filter((at) => at.icon && at.icon in icons);
            const overviewMyShare = myShares.find(
              (s) => s.share.viewerId === sharingOverviewUser.id,
            );
            const mySharedActivityTypes = overviewMyShare
              ? activityTypes.filter((at) =>
                  overviewMyShare.share.activityTypeIds.includes(at.id),
                )
              : [];
            const friendName = (
              sharingOverviewUser.profile?.fullName ||
              sharingOverviewUser.email.split("@")[0]
            ).split(" ")[0];
            const myName = (
              myProfile?.fullName ||
              user?.email?.split("@")[0] ||
              "You"
            ).split(" ")[0];

            // Assign consistent colors to each user
            const myColor = "#007AFF"; // iOS blue
            const friendColor = "#FF9500"; // iOS orange

            // Build merged activity list deduplicated by name
            const allActivitiesMap = new Map<
              string,
              {
                name: string;
                icon?: string;
                sharedByFriend: boolean;
                sharedByMe: boolean;
              }
            >();
            overviewSharedActivities.forEach((a) => {
              const key = a.name.toLowerCase();
              const existing = allActivitiesMap.get(key);
              if (existing) {
                existing.sharedByFriend = true;
                if (!existing.icon && a.icon) existing.icon = a.icon;
              } else {
                allActivitiesMap.set(key, {
                  name: a.name,
                  icon: a.icon,
                  sharedByFriend: true,
                  sharedByMe: false,
                });
              }
            });
            mySharedActivityTypes.forEach((a) => {
              const key = a.name.toLowerCase();
              const existing = allActivitiesMap.get(key);
              if (existing) {
                existing.sharedByMe = true;
                if (!existing.icon && a.icon) existing.icon = a.icon;
              } else {
                allActivitiesMap.set(key, {
                  name: a.name,
                  icon: a.icon,
                  sharedByFriend: false,
                  sharedByMe: true,
                });
              }
            });
            const mergedActivities = Array.from(allActivitiesMap.entries());

            return (
              <div className='space-y-4'>
                {/* Color-coded name header */}
                <div className='flex items-center justify-center gap-3 py-1 max-w-full px-4'>
                  <span
                    className='text-[16px] font-semibold truncate max-w-[45%]'
                    style={{ color: myColor }}>
                    {myName}
                  </span>
                  <span className='text-[14px] text-gray-400 dark:text-gray-500 font-light shrink-0'>
                    :
                  </span>
                  <span
                    className='text-[16px] font-semibold truncate max-w-[45%]'
                    style={{ color: friendColor }}>
                    {friendName}
                  </span>
                </div>

                {/* Merged activity list */}
                {mergedActivities.length > 0 ? (
                  <div className='bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden'>
                    {mergedActivities.map(([id, activity], i) => (
                      <div
                        key={id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5",
                          i < mergedActivities.length - 1 &&
                            "border-b border-gray-200/60 dark:border-gray-700/60",
                        )}>
                        <div className='w-7 h-7 flex items-center justify-center'>
                          {activity.icon && activity.icon in icons ? (
                            <Icon
                              name={activity.icon as IconName}
                              className='w-5 h-5 text-gray-600 dark:text-gray-300'
                            />
                          ) : (
                            <span className='text-lg'>📊</span>
                          )}
                        </div>
                        <span className='text-[15px] text-gray-900 dark:text-white flex-1'>
                          {activity.name}
                        </span>
                        {/* Colored bullets: user1 · user2 in same order as header */}
                        <div className='flex items-center gap-1.5'>
                          <span
                            className='w-[10px] h-[10px] rounded-full transition-opacity'
                            style={{
                              backgroundColor: myColor,
                              opacity: activity.sharedByMe ? 1 : 0.15,
                            }}
                          />
                          <span className='text-[10px] text-gray-400 dark:text-gray-500 font-light'>
                            :
                          </span>
                          <span
                            className='w-[10px] h-[10px] rounded-full transition-opacity'
                            style={{
                              backgroundColor: friendColor,
                              opacity: activity.sharedByFriend ? 1 : 0,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-sm text-gray-400 dark:text-gray-500 text-center py-4'>
                    No activities shared yet
                  </p>
                )}

                {/* Edit button */}
                <button
                  onClick={() => {
                    if (overviewMyShare) {
                      setSelectedShare({
                        share: overviewMyShare.share,
                        viewerEmail: overviewMyShare.viewerEmail,
                        viewerProfile: overviewMyShare.viewerProfile,
                      });
                      setSelectedActivityTypes(
                        overviewMyShare.share.activityTypeIds,
                      );
                      setShowEditShare(true);
                    }
                  }}
                  className='w-full py-2.5 rounded-xl bg-ios-blue/10 dark:bg-ios-blue/20 text-ios-blue text-[14px] font-semibold active:scale-[0.98] transition-all'>
                  Edit shared activities
                </button>
              </div>
            );
          })()}
      </IOSModal>

      {/* Edit Share Modal */}
      <IOSModal
        isOpen={showEditShare}
        onClose={() => setShowEditShare(false)}
        title='Share Activities'>
        <div className='space-y-4'>
          <p className='text-[13px] text-gray-500 dark:text-gray-400 text-center'>
            Choose which activities{" "}
            <span className='font-medium text-gray-700 dark:text-gray-300'>
              {selectedShare?.viewerProfile?.fullName ||
                selectedShare?.viewerEmail}
            </span>{" "}
            can see
          </p>
          <div className='space-y-1.5 max-h-72 overflow-y-auto'>
            {activityTypes.map((type) => {
              const isSelected = selectedActivityTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedActivityTypes(
                        selectedActivityTypes.filter((id) => id !== type.id),
                      );
                    } else {
                      setSelectedActivityTypes([
                        ...selectedActivityTypes,
                        type.id,
                      ]);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all active:scale-[0.98]",
                    isSelected
                      ? "bg-ios-blue/15 dark:bg-ios-blue/25 ring-1.5 ring-ios-blue/40"
                      : "bg-gray-100 dark:bg-gray-800/60",
                  )}>
                  {type.icon && type.icon in icons && (
                    <Icon
                      name={type.icon as IconName}
                      className={cn(
                        "w-5 h-5 transition-colors",
                        isSelected
                          ? "text-ios-blue"
                          : "text-gray-500 dark:text-gray-400",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "text-[15px] font-medium transition-colors",
                      isSelected
                        ? "text-ios-blue"
                        : "text-gray-700 dark:text-gray-300",
                    )}>
                    {type.name}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={handleUpdateShare}
            className='w-full py-3 rounded-xl bg-ios-blue text-white text-[15px] font-semibold active:scale-[0.98] transition-all shadow-sm'>
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

      {/* Info Popup */}
      <IOSModal
        isOpen={showInfoPopup}
        onClose={() => setShowInfoPopup(false)}
        title='Friends'
        size='small'>
        <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden -mx-1'>
          {/* Add Friend */}
          <div className='flex items-center gap-3 px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
            <div className='w-8 h-8 flex items-center justify-center shrink-0'>
              <svg
                className='w-6 h-6 text-blue-400'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'
                />
              </svg>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                Add Friend
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                Search by name or email. Send a friend request.
              </p>
            </div>
          </div>
          {/* View Data */}
          <div className='flex items-center gap-3 px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
            <div className='w-8 h-8 flex items-center justify-center shrink-0'>
              <svg
                className='w-6 h-6 text-green-500'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                />
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                />
              </svg>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                View Data
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                Tap a friend to see their entries on your Today page.
              </p>
            </div>
          </div>
          {/* Chat */}
          <div className='flex items-center gap-3 px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
            <div className='w-8 h-8 flex items-center justify-center shrink-0'>
              <svg
                className='w-6 h-6 text-purple-400'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                />
              </svg>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                Chat
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                Message friends directly. Blue dot = unread messages.
              </p>
            </div>
          </div>
          {/* Favorites */}
          <div className='flex items-center gap-3 px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
            <div className='w-8 h-8 flex items-center justify-center shrink-0'>
              <svg
                className='w-6 h-6 text-red-400'
                fill='currentColor'
                viewBox='0 0 24 24'>
                <path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' />
              </svg>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                Favorites
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                Heart a friend to see their movies in the Favorites tab.
              </p>
            </div>
          </div>
          {/* Notifications */}
          <div className='flex items-center gap-3 px-4 py-3'>
            <div className='w-8 h-8 flex items-center justify-center shrink-0'>
              <svg
                className='w-6 h-6 text-amber-500'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
                />
              </svg>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                Notifications
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                Bell icon to get alerts when a friend logs activities.
              </p>
            </div>
          </div>
        </div>
      </IOSModal>
    </div>
  );
}

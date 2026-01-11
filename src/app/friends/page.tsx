"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import {
  sendShareRequest,
  getIncomingRequests,
  getOutgoingRequests,
  acceptShareRequest,
  rejectShareRequest,
  getSharedWithMe,
  getMyShares,
  removeShare,
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

export default function FriendsPage() {
  const { user } = useAuth();
  const { activityTypes, setViewingUser } = useApp();
  const { t } = useLanguage();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "shared" | "requests" | "myShares"
  >("shared");
  const [incomingRequests, setIncomingRequests] = useState<ShareRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ShareRequest[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedUser[]>([]);
  const [myShares, setMyShares] = useState<
    { share: Share; viewerEmail: string; viewerProfile?: UserProfile }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showSendRequest, setShowSendRequest] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showEditShare, setShowEditShare] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ShareRequest | null>(
    null
  );
  const [selectedShare, setSelectedShare] = useState<{
    share: Share;
    viewerEmail: string;
    viewerProfile?: UserProfile;
  } | null>(null);
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>(
    []
  );
  const [requestEmail, setRequestEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.email) return;

    setIsLoading(true);
    try {
      // Load each query separately to identify which one fails
      let incoming: ShareRequest[] = [];
      let outgoing: ShareRequest[] = [];
      let shared: SharedUser[] = [];
      let shares: { share: Share; viewerEmail: string }[] = [];

      try {
        incoming = await getIncomingRequests(user.email);
      } catch (e: unknown) {
        const err = e as { message?: string; code?: string; details?: string };
        console.error(
          "Failed to load incoming requests:",
          err?.message || err?.code || JSON.stringify(e)
        );
      }

      try {
        outgoing = await getOutgoingRequests(user.id);
      } catch (e: unknown) {
        const err = e as { message?: string; code?: string; details?: string };
        console.error(
          "Failed to load outgoing requests:",
          err?.message || err?.code || JSON.stringify(e)
        );
      }

      try {
        shared = await getSharedWithMe(user.id);
      } catch (e: unknown) {
        const err = e as { message?: string; code?: string; details?: string };
        console.error(
          "Failed to load shared with me:",
          err?.message || err?.code || JSON.stringify(e)
        );
      }

      try {
        shares = await getMyShares(user.id);
      } catch (e: unknown) {
        const err = e as { message?: string; code?: string; details?: string };
        console.error(
          "Failed to load my shares:",
          err?.message || err?.code || JSON.stringify(e)
        );
      }

      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
      setSharedWithMe(shared);
      setMyShares(shares);
    } catch (error) {
      console.error("Failed to load sharing data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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

  const handleAcceptRequest = async () => {
    if (!selectedRequest || !user) return;

    const { error } = await acceptShareRequest(
      selectedRequest.id,
      user.id,
      selectedRequest.fromUserId,
      selectedActivityTypes
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

  const handleUpdateShare = async () => {
    if (!selectedShare) return;

    const { error } = await updateSharePermissions(
      selectedShare.share.id,
      selectedActivityTypes
    );

    if (!error) {
      setShowEditShare(false);
      setSelectedShare(null);
      loadData();
    }
  };

  const handleViewUserData = (sharedUser: SharedUser) => {
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
            className='px-4 py-2 bg-ios-blue text-white rounded-lg text-sm font-medium'>
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
                "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-ios-blue text-white"
                  : "bg-white/80 dark:bg-ios-card-dark text-gray-700 dark:text-gray-300"
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
              sharedWithMe.map((sharedUser) => (
                <button
                  key={sharedUser.id}
                  onClick={() => handleViewUserData(sharedUser)}
                  className='w-full p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl text-left flex items-center gap-3'>
                  <Avatar
                    avatar={sharedUser.profile?.avatar || null}
                    size='md'
                  />
                  <div className='flex-1 min-w-0'>
                    <p className='font-medium text-gray-900 dark:text-white truncate'>
                      {sharedUser.profile?.fullName || sharedUser.email}
                    </p>
                    <p className='text-sm text-gray-500 truncate'>
                      {sharedUser.email}
                    </p>
                  </div>
                  <div className='flex-shrink-0 w-8 h-8 bg-ios-blue/10 rounded-full flex items-center justify-center'>
                    <span className='text-sm font-medium text-ios-blue'>
                      {sharedUser.activityTypeIds?.length ||
                        sharedUser.activityTypes.length}
                    </span>
                  </div>
                </button>
              ))
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
                          className='px-3 py-1.5 bg-ios-blue text-white rounded-lg text-sm'>
                          {t("friends.accept")}
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className='px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm'>
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
                <div className='space-y-2'>
                  {outgoingRequests.map((req) => (
                    <div
                      key={req.id}
                      className='p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl flex items-center gap-3'>
                      <Avatar avatar={req.profile?.avatar || null} size='md' />
                      <div className='min-w-0 flex-1'>
                        <p className='font-medium text-gray-900 dark:text-white truncate'>
                          {req.profile?.fullName || req.toEmail}
                        </p>
                        <p className='text-sm text-gray-500 truncate'>
                          {req.toEmail}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full flex-shrink-0",
                          req.status === "pending" &&
                            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                          req.status === "accepted" &&
                            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                          req.status === "rejected" &&
                            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
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
                  className='p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl'>
                  <div className='flex items-center gap-3'>
                    <Avatar avatar={viewerProfile?.avatar || null} size='md' />
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium text-gray-900 dark:text-white truncate'>
                        {viewerProfile?.fullName || viewerEmail}
                      </p>
                      <p className='text-sm text-gray-500 truncate'>
                        {viewerEmail}
                      </p>
                    </div>
                    <div className='flex items-center gap-2 flex-shrink-0'>
                      <div className='w-8 h-8 bg-ios-blue/10 rounded-full flex items-center justify-center'>
                        <span className='text-sm font-medium text-ios-blue'>
                          {share.activityTypeIds.length}
                        </span>
                      </div>
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
                        className='px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm'>
                        {t("friends.edit")}
                      </button>
                      <button
                        onClick={() => handleRemoveShare(share.id)}
                        className='px-3 py-1.5 bg-ios-red/10 text-ios-red rounded-lg text-sm'>
                        {t("friends.remove")}
                      </button>
                    </div>
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
                    onClick={() => handleSendRequest(result.email)}
                    disabled={!result.email}
                    className='px-3 py-1.5 bg-ios-blue text-white rounded-lg text-sm font-medium disabled:opacity-50'>
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
            className='w-full px-4 py-3 bg-ios-blue text-white rounded-lg font-medium disabled:opacity-50'>
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
                        selectedActivityTypes.filter((id) => id !== type.id)
                      );
                    }
                  }}
                  className='w-5 h-5 rounded text-ios-blue'
                />
                <span className='text-gray-900 dark:text-white'>
                  {type.icon} {type.name}
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={handleAcceptRequest}
            disabled={selectedActivityTypes.length === 0}
            className='w-full px-4 py-3 bg-ios-blue text-white rounded-lg font-medium disabled:opacity-50'>
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
                        selectedActivityTypes.filter((id) => id !== type.id)
                      );
                    }
                  }}
                  className='w-5 h-5 rounded text-ios-blue'
                />
                <span className='text-gray-900 dark:text-white'>
                  {type.icon} {type.name}
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={handleUpdateShare}
            className='w-full px-4 py-3 bg-ios-blue text-white rounded-lg font-medium'>
            {t("friends.saveChanges")}
          </button>
        </div>
      </IOSModal>
    </div>
  );
}

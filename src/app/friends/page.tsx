"use client";

import { useState, useEffect, useCallback } from "react";
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
  getSharedEntries,
  ShareRequest,
  SharedUser,
  Share,
} from "@/lib/sharing";
import { IOSModal } from "@/components/ios";
import { LogEntry, ActivityType } from "@/types";

export default function FriendsPage() {
  const { user } = useAuth();
  const { activityTypes } = useApp();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<
    "shared" | "requests" | "myShares"
  >("shared");
  const [incomingRequests, setIncomingRequests] = useState<ShareRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ShareRequest[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedUser[]>([]);
  const [myShares, setMyShares] = useState<
    { share: Share; viewerEmail: string }[]
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
  } | null>(null);
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>(
    []
  );
  const [requestEmail, setRequestEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // View shared data
  const [viewingUser, setViewingUser] = useState<SharedUser | null>(null);
  const [sharedEntries, setSharedEntries] = useState<LogEntry[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.email) return;

    setIsLoading(true);
    try {
      const [incoming, outgoing, shared, shares] = await Promise.all([
        getIncomingRequests(user.email),
        getOutgoingRequests(user.id),
        getSharedWithMe(user.id),
        getMyShares(user.id),
      ]);

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

  const handleSendRequest = async () => {
    if (!user?.email || !requestEmail.trim()) return;

    const { error } = await sendShareRequest(
      user.id,
      user.email,
      requestEmail.trim().toLowerCase()
    );
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(t("friends.requestSent"));
      setRequestEmail("");
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

  const handleViewUserData = async (sharedUser: SharedUser) => {
    setViewingUser(sharedUser);
    try {
      const entries = await getSharedEntries(
        sharedUser.id,
        sharedUser.activityTypes.map((a) => a.id),
        "2000-01-01",
        "2100-01-01"
      );
      setSharedEntries(entries);
    } catch (error) {
      console.error("Failed to load shared entries:", error);
    }
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
    <div className='min-h-screen pb-16'>
      <main className='max-w-lg mx-auto px-4 py-3 space-y-4'>
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
                  className='w-full p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl text-left'>
                  <p className='font-medium text-gray-900 dark:text-white'>
                    {sharedUser.email}
                  </p>
                  <p className='text-sm text-gray-500 mt-1'>
                    {sharedUser.activityTypes.length} {t("friends.activities")}
                  </p>
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
                      <div>
                        <p className='font-medium text-gray-900 dark:text-white'>
                          {req.fromEmail}
                        </p>
                        <p className='text-xs text-gray-500'>
                          {t("friends.wantsAccess")}
                        </p>
                      </div>
                      <div className='flex gap-2'>
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
                      className='p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl flex items-center justify-between'>
                      <div>
                        <p className='font-medium text-gray-900 dark:text-white'>
                          {req.toEmail}
                        </p>
                        <p className='text-xs text-gray-500'>
                          {req.status === "pending"
                            ? t("friends.pending")
                            : req.status === "accepted"
                            ? t("friends.accepted")
                            : t("friends.rejected")}
                        </p>
                      </div>
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
              myShares.map(({ share, viewerEmail }) => (
                <div
                  key={share.id}
                  className='p-4 bg-white/80 dark:bg-ios-card-dark rounded-xl'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='font-medium text-gray-900 dark:text-white'>
                        {viewerEmail}
                      </p>
                      <p className='text-sm text-gray-500 mt-1'>
                        {share.activityTypeIds.length} {t("friends.activities")}
                      </p>
                    </div>
                    <div className='flex gap-2'>
                      <button
                        onClick={() => {
                          setSelectedShare({ share, viewerEmail });
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
        onClose={() => setShowSendRequest(false)}
        title={t("friends.sendRequest")}>
        <div className='space-y-4'>
          <p className='text-sm text-gray-500'>
            {t("friends.sendRequestDesc")}
          </p>
          <input
            type='email'
            value={requestEmail}
            onChange={(e) => setRequestEmail(e.target.value)}
            placeholder={t("friends.emailPlaceholder")}
            className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white'
          />
          <button
            onClick={handleSendRequest}
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

      {/* View Shared Data Modal */}
      <IOSModal
        isOpen={!!viewingUser}
        onClose={() => {
          setViewingUser(null);
          setSharedEntries([]);
        }}
        title={viewingUser?.email || ""}>
        <div className='space-y-4 max-h-[60vh] overflow-y-auto'>
          {viewingUser?.activityTypes.map((type) => {
            const typeEntries = sharedEntries.filter(
              (e) => e.activityTypeId === type.id
            );
            return (
              <div key={type.id} className='space-y-2'>
                <h4 className='font-medium text-gray-900 dark:text-white'>
                  {type.icon} {type.name}
                </h4>
                {typeEntries.length === 0 ? (
                  <p className='text-sm text-gray-500'>
                    {t("friends.noEntries")}
                  </p>
                ) : (
                  <div className='space-y-1'>
                    {typeEntries.slice(0, 10).map((entry) => (
                      <div
                        key={entry.id}
                        className='flex justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm'>
                        <span className='text-gray-500'>{entry.date}</span>
                        <span className='text-gray-900 dark:text-white'>
                          {String(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </IOSModal>
    </div>
  );
}

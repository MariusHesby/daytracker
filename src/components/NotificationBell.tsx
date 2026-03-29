"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useNotifications,
  ActivityNotification,
} from "@/context/NotificationContext";
import { cn, formatDate } from "@/lib/utils";
import { Avatar } from "./ProfileSetup";
import { useApp } from "@/context/AppContext";

const formatNotificationDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
};

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    checkForUpdates,
  } = useNotifications();
  const [showModal, setShowModal] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckNow = async () => {
    setIsChecking(true);
    await checkForUpdates();
    setIsChecking(false);
  };

  return (
    <>
      {/* Bell Button */}
      <button
        data-info='Notifications. Tap to see friend requests and activity updates from your friends.'
        onClick={() => setShowModal(true)}
        className='relative p-2 active:opacity-60 transition-opacity'>
        <svg
          className='w-6 h-6 text-gray-500 dark:text-gray-400'
          fill='none'
          viewBox='0 0 24 24'
          strokeWidth={1.5}
          stroke='currentColor'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'
          />
        </svg>
        {/* Badge */}
        {unreadCount > 0 && (
          <span className='absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-ios-red text-white text-[11px] font-semibold rounded-full flex items-center justify-center px-1'>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Modal */}
      {showModal && (
        <div className='fixed inset-0 z-50 flex items-start justify-center pt-16'>
          {/* Backdrop */}
          <div
            className='absolute inset-0 bg-black/50 backdrop-blur-sm'
            onClick={() => setShowModal(false)}
          />
          {/* Modal */}
          <div className='relative bg-white dark:bg-ios-card-dark rounded-2xl w-[calc(100%-2rem)] sm:max-w-md max-h-[70vh] flex flex-col animate-in fade-in slide-in-from-top-4 duration-200 mx-4 shadow-xl'>
            {/* Header */}
            <div className='flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700'>
              <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
                Notifications
              </h2>
              <div className='flex items-center gap-1'>
                {/* Refresh/Check now */}
                <button
                  data-info='Check now for new notifications from friends.'
                  onClick={handleCheckNow}
                  disabled={isChecking}
                  className='p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50'
                  title='Check now'>
                  <svg
                    className={cn(
                      "w-5 h-5 text-ios-blue",
                      isChecking && "animate-spin",
                    )}
                    fill='none'
                    viewBox='0 0 24 24'
                    strokeWidth={2}
                    stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99'
                    />
                  </svg>
                </button>
                {notifications.length > 0 && (
                  <>
                    {/* Mark all read */}
                    <button
                      data-info='Mark all notifications as read.'
                      onClick={markAllAsRead}
                      className='p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'
                      title='Mark all read'>
                      <svg
                        className='w-5 h-5 text-ios-blue'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={2}
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                    </button>
                    {/* Clear all */}
                    <button
                      data-info='Delete all notifications permanently.'
                      onClick={clearAllNotifications}
                      className='p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'
                      title='Clear all'>
                      <svg
                        className='w-5 h-5 text-ios-red'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={2}
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'
                        />
                      </svg>
                    </button>
                  </>
                )}
                {/* Close */}
                <button
                  onClick={() => setShowModal(false)}
                  className='p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'>
                  <svg
                    className='w-5 h-5 text-gray-500'
                    fill='none'
                    viewBox='0 0 24 24'
                    strokeWidth={2}
                    stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className='flex-1 overflow-y-auto'>
              {notifications.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 px-4'>
                  <svg
                    className='w-12 h-12 text-gray-300 dark:text-gray-600 mb-3'
                    fill='none'
                    viewBox='0 0 24 24'
                    strokeWidth={1}
                    stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'
                    />
                  </svg>
                  <p className='text-gray-500 dark:text-gray-400 text-[15px]'>
                    No notifications yet
                  </p>
                  <p className='text-gray-400 dark:text-gray-500 text-[13px] mt-1 text-center'>
                    Subscribe to friends&apos; activities to receive updates
                  </p>
                </div>
              ) : (
                <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={() => markAsRead(notification.id)}
                      onClear={() => clearNotification(notification.id)}
                      onClose={() => setShowModal(false)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
  onClear,
  onClose,
  compact = false,
}: {
  notification: ActivityNotification;
  onMarkRead: () => void;
  onClear: () => void;
  onClose: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const { setSelectedDate, setViewingUser } = useApp();

  const isChat = notification.type === "chat";

  // Check if this is a movie or TV series activity
  const isMediaActivity =
    !isChat &&
    (notification.activityName.toLowerCase().includes("movie") ||
      notification.activityName.toLowerCase().includes("tv") ||
      notification.activityName.toLowerCase().includes("series") ||
      notification.activityName.toLowerCase().includes("film"));

  const handleClick = async () => {
    onMarkRead();
    onClose();

    // Chat notifications navigate to friends page
    if (isChat) {
      router.push("/friends");
      return;
    }

    // Fetch friend's shared activity types from the shares table
    const { supabase } = await import("@/lib/supabase");

    try {
      // Get the share record for this friend
      const { data: shareData } = await supabase
        .from("shares")
        .select("activity_type_ids")
        .eq("owner_id", notification.friendId)
        .single();

      const activityTypeIds = shareData?.activity_type_ids || [
        notification.activityId,
      ];

      // Set viewing user with all their shared activity types
      setViewingUser({
        id: notification.friendId,
        email: "",
        fullName: notification.friendName,
        activityTypeIds: activityTypeIds,
        avatar: notification.friendAvatar,
      });
    } catch {
      // Fallback to just the notification's activity
      setViewingUser({
        id: notification.friendId,
        email: "",
        fullName: notification.friendName,
        activityTypeIds: [notification.activityId],
        avatar: notification.friendAvatar,
      });
    }

    if (isMediaActivity) {
      // Navigate to movies & TV page
      router.push("/movies-tv");
    } else {
      // Navigate to the date the entry was posted
      setSelectedDate(notification.date);
      router.push("/");
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 relative cursor-pointer",
        compact ? "px-4 py-2.5" : "px-4 py-3",
        !notification.read && "bg-ios-blue/5 dark:bg-ios-blue/10",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
      )}
      onClick={handleClick}>
      {/* Avatar */}
      <div className='flex-shrink-0'>
        <Avatar avatar={notification.friendAvatar} size='sm' />
      </div>

      {/* Content */}
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2'>
          <span
            className={cn(
              "font-medium text-gray-900 dark:text-white truncate",
              compact ? "text-[14px]" : "text-[15px]",
            )}>
            {notification.friendName}
          </span>
          {!notification.read && (
            <span className='w-2 h-2 rounded-full bg-ios-blue flex-shrink-0' />
          )}
        </div>
        <p
          className={cn(
            "text-gray-600 dark:text-gray-300 mt-0.5",
            compact ? "text-[13px]" : "text-[14px]",
          )}>
          {isChat ? (
            <span className='font-medium'>
              {notification.messagePreview || notification.value}
            </span>
          ) : (
            <>
              {notification.activityName}:{" "}
              <span className='font-medium'>{notification.value}</span>
            </>
          )}
        </p>
        <p
          className={cn(
            "text-gray-400 dark:text-gray-500 mt-0.5",
            compact ? "text-[11px]" : "text-[12px]",
          )}>
          {formatNotificationDate(notification.createdAt)}
        </p>
      </div>

      {/* Clear button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className='flex-shrink-0 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'>
        <svg
          className='w-4 h-4 text-gray-400'
          fill='none'
          viewBox='0 0 24 24'
          strokeWidth={2}
          stroke='currentColor'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M6 18L18 6M6 6l12 12'
          />
        </svg>
      </button>
    </div>
  );
}

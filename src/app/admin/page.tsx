"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components";

const ADMIN_EMAIL = "marius.r.hesby@gmail.com";

interface UserStats {
  userId: string;
  email: string;
  fullName: string;
  avatar: string | null;
  createdAt: string;
  totalEntries: number;
  totalActivityTypes: number;
  lockedDays: number;
  lastActiveDate: string | null;
  daysActive: number;
}

interface AppStats {
  totalUsers: number;
  totalEntries: number;
  totalActivityTypes: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
}

function UserRow({
  userStats,
  isLast,
  isAdmin,
  showDetails,
  swipedUserId,
  setSwipedUserId,
  onDelete,
  formatDate,
  formatDateShort,
}: {
  userStats: UserStats;
  isLast: boolean;
  isAdmin: boolean;
  showDetails: boolean;
  swipedUserId: string | null;
  setSwipedUserId: (id: string | null) => void;
  onDelete: () => void;
  formatDate: (d: string) => string;
  formatDateShort: (d: string | null) => string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  // Reset position when another row is swiped
  useEffect(() => {
    if (swipedUserId !== userStats.userId && rowRef.current) {
      rowRef.current.style.transform = "translateX(0)";
    }
  }, [swipedUserId, userStats.userId]);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        !isLast && "border-b border-gray-200/80 dark:border-gray-700/80",
      )}>
      {/* Delete button behind the row */}
      {!isAdmin && (
        <button
          onClick={onDelete}
          className='absolute right-0 top-0 bottom-0 w-20 bg-ios-red flex items-center justify-center'>
          <svg
            className='w-5 h-5 text-white'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth={2}>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
            />
          </svg>
        </button>
      )}
      {/* Swipeable content */}
      <div
        ref={rowRef}
        className='relative bg-white dark:bg-ios-card-dark swipe-row-bg px-4 py-3 transition-transform duration-200'
        onTouchStart={(e) => {
          if (isAdmin) return;
          if (swipedUserId && swipedUserId !== userStats.userId) {
            setSwipedUserId(null);
          }
          touchStartX.current = e.touches[0].clientX;
          touchCurrentX.current = e.touches[0].clientX;
        }}
        onTouchMove={(e) => {
          if (isAdmin || !rowRef.current) return;
          touchCurrentX.current = e.touches[0].clientX;
          const diff = touchStartX.current - touchCurrentX.current;
          if (diff > 0) {
            rowRef.current.style.transition = "none";
            rowRef.current.style.transform = `translateX(-${Math.min(diff, 80)}px)`;
          } else {
            rowRef.current.style.transition = "none";
            rowRef.current.style.transform = "translateX(0)";
          }
        }}
        onTouchEnd={() => {
          if (isAdmin || !rowRef.current) return;
          rowRef.current.style.transition = "transform 0.2s ease";
          const diff = touchStartX.current - touchCurrentX.current;
          if (diff > 60) {
            rowRef.current.style.transform = "translateX(-80px)";
            setSwipedUserId(userStats.userId);
          } else {
            rowRef.current.style.transform = "translateX(0)";
            if (swipedUserId === userStats.userId) setSwipedUserId(null);
          }
        }}
        onClick={() => {
          if (swipedUserId === userStats.userId && rowRef.current) {
            rowRef.current.style.transform = "translateX(0)";
            setSwipedUserId(null);
          }
        }}>
        <div className='flex items-center gap-3'>
          <Avatar avatar={userStats.avatar} size='md' />
          <div className='flex-1 min-w-0'>
            <p className='text-[17px] font-semibold text-gray-900 dark:text-white truncate'>
              {userStats.fullName}
            </p>
            <p className='text-[13px] text-gray-500 dark:text-gray-400 truncate'>
              {userStats.email}
            </p>
            {showDetails && (
              <div className='flex flex-wrap gap-x-3 mt-0.5'>
                <span className='text-[11px] text-gray-400 dark:text-gray-500'>
                  Joined {formatDate(userStats.createdAt)}
                </span>
                <span className='text-[11px] text-gray-400 dark:text-gray-500'>
                  Last active {formatDateShort(userStats.lastActiveDate)}
                </span>
              </div>
            )}
          </div>
          <div className='text-right shrink-0 pl-2'>
            <p className='text-[20px] font-semibold tabular-nums text-gray-900 dark:text-white leading-tight'>
              {userStats.totalEntries}
            </p>
            <p className='text-[11px] text-gray-400 dark:text-gray-500'>
              {userStats.daysActive}d
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserStats[]>([]);
  const [appStats, setAppStats] = useState<AppStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"created" | "lastActive" | "entries">(
    "lastActive",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [userToDelete, setUserToDelete] = useState<UserStats | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [swipedUserId, setSwipedUserId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Check if current user is admin
  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    if (!user) {
      router.push("/settings");
      return;
    }

    if (!isAdmin) {
      router.push("/");
      return;
    }

    loadAdminData();
  }, [user, isAdmin, router, authLoading]);

  const loadAdminData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get entry counts per user
      const { data: entryCounts, error: entryError } = await supabase
        .from("log_entries")
        .select("user_id, date")
        .order("date", { ascending: false });

      if (entryError) throw entryError;

      // Get activity type counts per user
      const { data: activityCounts, error: activityError } = await supabase
        .from("activity_types")
        .select("user_id");

      if (activityError) throw activityError;

      // Get locked days counts per user
      const { data: lockedDays, error: lockedError } = await supabase
        .from("locked_days")
        .select("user_id");

      // Process data for each user
      const userStatsMap = new Map<string, UserStats>();

      // Initialize from profiles
      for (const profile of profiles || []) {
        userStatsMap.set(profile.user_id, {
          userId: profile.user_id,
          email: profile.email || "Unknown",
          fullName: profile.full_name || "No name",
          avatar: profile.avatar,
          createdAt: profile.created_at,
          totalEntries: 0,
          totalActivityTypes: 0,
          lockedDays: 0,
          lastActiveDate: null,
          daysActive: 0,
        });
      }

      // Count entries and find last active date
      const entryDatesPerUser = new Map<string, Set<string>>();
      for (const entry of entryCounts || []) {
        const stats = userStatsMap.get(entry.user_id);
        if (stats) {
          stats.totalEntries++;
          if (!stats.lastActiveDate || entry.date > stats.lastActiveDate) {
            stats.lastActiveDate = entry.date;
          }
          // Track unique days
          if (!entryDatesPerUser.has(entry.user_id)) {
            entryDatesPerUser.set(entry.user_id, new Set());
          }
          entryDatesPerUser.get(entry.user_id)!.add(entry.date);
        }
      }

      // Calculate days active
      for (const [userId, dates] of entryDatesPerUser) {
        const stats = userStatsMap.get(userId);
        if (stats) {
          stats.daysActive = dates.size;
        }
      }

      // Count activity types
      for (const at of activityCounts || []) {
        const stats = userStatsMap.get(at.user_id);
        if (stats) {
          stats.totalActivityTypes++;
        }
      }

      // Count locked days
      for (const ld of lockedDays || []) {
        const stats = userStatsMap.get(ld.user_id);
        if (stats) {
          stats.lockedDays++;
        }
      }

      const usersList = Array.from(userStatsMap.values());

      // Calculate app stats
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const stats: AppStats = {
        totalUsers: usersList.length,
        totalEntries: usersList.reduce((sum, u) => sum + u.totalEntries, 0),
        totalActivityTypes: usersList.reduce(
          (sum, u) => sum + u.totalActivityTypes,
          0,
        ),
        activeUsersLast7Days: usersList.filter(
          (u) => u.lastActiveDate && u.lastActiveDate >= sevenDaysAgo,
        ).length,
        activeUsersLast30Days: usersList.filter(
          (u) => u.lastActiveDate && u.lastActiveDate >= thirtyDaysAgo,
        ).length,
      };

      setAppStats(stats);
      setUsers(usersList);
    } catch (err) {
      console.error("Admin data error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load admin data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userStats: UserStats) => {
    setIsDeleting(true);
    try {
      const userId = userStats.userId;

      // Delete all user data from Supabase in order (respecting foreign keys)
      // 1. Delete log entries
      const { error: entriesError } = await supabase
        .from("log_entries")
        .delete()
        .eq("user_id", userId);
      if (entriesError) throw entriesError;

      // 2. Delete suggestions
      const { error: suggestionsError } = await supabase
        .from("suggestions")
        .delete()
        .eq("user_id", userId);
      if (suggestionsError) throw suggestionsError;

      // 3. Delete activity types
      const { error: activityError } = await supabase
        .from("activity_types")
        .delete()
        .eq("user_id", userId);
      if (activityError) throw activityError;

      // 4. Delete locked days
      const { error: lockedError } = await supabase
        .from("locked_days")
        .delete()
        .eq("user_id", userId);
      if (lockedError) throw lockedError;

      // 5. Delete shared access (both as sharer and viewer)
      const { error: sharedError1 } = await supabase
        .from("shared_access")
        .delete()
        .eq("owner_id", userId);
      if (sharedError1)
        console.warn("shared_access owner delete:", sharedError1);

      const { error: sharedError2 } = await supabase
        .from("shared_access")
        .delete()
        .eq("viewer_id", userId);
      if (sharedError2)
        console.warn("shared_access viewer delete:", sharedError2);

      // 6. Delete profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", userId);
      if (profileError) throw profileError;

      // Update local state
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
      setUserToDelete(null);

      // Update app stats
      if (appStats) {
        setAppStats({
          ...appStats,
          totalUsers: appStats.totalUsers - 1,
          totalEntries: appStats.totalEntries - userStats.totalEntries,
          totalActivityTypes:
            appStats.totalActivityTypes - userStats.totalActivityTypes,
        });
      }
    } catch (err) {
      console.error("Delete user error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "created":
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "lastActive":
        const aDate = a.lastActiveDate
          ? new Date(a.lastActiveDate).getTime()
          : 0;
        const bDate = b.lastActiveDate
          ? new Date(b.lastActiveDate).getTime()
          : 0;
        comparison = aDate - bDate;
        break;
      case "entries":
        comparison = a.totalEntries - b.totalEntries;
        break;
    }
    return sortOrder === "desc" ? -comparison : comparison;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
  };

  // Show loading while auth is loading or user is not verified yet
  if (authLoading || !user || !isAdmin) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='w-6 h-6 border-2 border-ios-blue border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  return (
    <div className='pb-16'>
      <main className='max-w-4xl mx-auto px-4 pt-6 pb-4 space-y-6'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
            Admin Dashboard
          </h1>
          <button
            onClick={() => router.push("/settings")}
            className='text-ios-blue text-[17px]'>
            Back
          </button>
        </div>

        {error && (
          <div className='bg-ios-red/10 text-ios-red rounded-xl p-4 text-[15px]'>
            {error}
          </div>
        )}

        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <div className='w-6 h-6 border-2 border-ios-blue border-t-transparent rounded-full animate-spin' />
          </div>
        ) : (
          <>
            {/* App Stats */}
            <section>
              <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
                App Statistics
              </h2>
              <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
                <div className='grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-200 dark:bg-gray-700'>
                  <div className='bg-white dark:bg-ios-card-dark p-4'>
                    <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                      Total Users
                    </p>
                    <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                      {appStats?.totalUsers || 0}
                    </p>
                  </div>
                  <div className='bg-white dark:bg-ios-card-dark p-4'>
                    <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                      Total Entries
                    </p>
                    <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                      {appStats?.totalEntries || 0}
                    </p>
                  </div>
                  <div className='bg-white dark:bg-ios-card-dark p-4'>
                    <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                      Activity Types
                    </p>
                    <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                      {appStats?.totalActivityTypes || 0}
                    </p>
                  </div>
                  <div className='bg-white dark:bg-ios-card-dark p-4'>
                    <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                      Active (7d)
                    </p>
                    <p className='text-2xl font-bold text-ios-green'>
                      {appStats?.activeUsersLast7Days || 0}
                    </p>
                  </div>
                  <div className='bg-white dark:bg-ios-card-dark p-4'>
                    <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                      Active (30d)
                    </p>
                    <p className='text-2xl font-bold text-ios-blue'>
                      {appStats?.activeUsersLast30Days || 0}
                    </p>
                  </div>
                  <div className='bg-white dark:bg-ios-card-dark p-4'>
                    <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                      Avg Entries/User
                    </p>
                    <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                      {appStats && appStats.totalUsers > 0
                        ? Math.round(
                            appStats.totalEntries / appStats.totalUsers,
                          )
                        : 0}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Users List */}
            <section>
              <div className='flex items-center justify-between px-4 mb-2'>
                <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide'>
                  Users ({users.length})
                </h2>
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className={cn(
                      "p-1 rounded-md transition-colors",
                      showDetails
                        ? "text-ios-blue"
                        : "text-gray-400 dark:text-gray-500",
                    )}
                    title={showDetails ? "Hide details" : "Show details"}>
                    <svg
                      className='w-4.5 h-4.5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={2}>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                      />
                    </svg>
                  </button>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className='text-[13px] bg-transparent text-ios-blue border-none outline-none'>
                    <option value='lastActive'>Last Active</option>
                    <option value='created'>Sign Up</option>
                    <option value='entries'>Entries</option>
                  </select>
                  <button
                    onClick={() =>
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    }
                    className='text-ios-blue'>
                    {sortOrder === "desc" ? "↓" : "↑"}
                  </button>
                </div>
              </div>
              <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
                {sortedUsers.map((userStats, index) => (
                  <UserRow
                    key={userStats.userId}
                    userStats={userStats}
                    isLast={index === sortedUsers.length - 1}
                    isAdmin={userStats.email === ADMIN_EMAIL}
                    showDetails={showDetails}
                    swipedUserId={swipedUserId}
                    setSwipedUserId={setSwipedUserId}
                    onDelete={() => setUserToDelete(userStats)}
                    formatDate={formatDate}
                    formatDateShort={formatDateShort}
                  />
                ))}
              </div>
            </section>

            {/* Refresh button */}
            <button
              onClick={loadAdminData}
              className='w-full py-3 bg-ios-blue text-white rounded-xl text-[17px] font-medium active:opacity-80'>
              Refresh Data
            </button>
          </>
        )}
      </main>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div
          className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4'
          onClick={() => !isDeleting && setUserToDelete(null)}>
          <div
            className='bg-white dark:bg-ios-card-dark rounded-2xl w-full max-w-[300px] overflow-hidden'
            style={{ animation: "scale-in 0.2s ease-out" }}
            onClick={(e) => e.stopPropagation()}>
            <div className='p-6 text-center'>
              <h3 className='text-[17px] font-semibold text-gray-900 dark:text-white mb-2'>
                Delete User?
              </h3>
              <p className='text-[14px] text-gray-500 dark:text-gray-400'>
                This will permanently delete{" "}
                <span className='font-medium text-gray-900 dark:text-white'>
                  {userToDelete.fullName}
                </span>{" "}
                and all their data ({userToDelete.totalEntries} entries,{" "}
                {userToDelete.totalActivityTypes} activity types).
              </p>
              <p className='text-[13px] text-ios-red mt-2'>
                This action cannot be undone.
              </p>
            </div>
            <div className='border-t border-gray-200 dark:border-gray-700 flex'>
              <button
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className='flex-1 py-3 text-[17px] text-ios-blue font-normal border-r border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800 disabled:opacity-50'>
                Cancel
              </button>
              <button
                onClick={() => deleteUser(userToDelete)}
                disabled={isDeleting}
                className='flex-1 py-3 text-[17px] text-ios-red font-semibold active:bg-gray-100 dark:active:bg-gray-800 disabled:opacity-50'>
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

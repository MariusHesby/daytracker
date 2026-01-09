"use client";

import { useAuth } from "@/context/AuthContext";
import { ProfileSetup } from "./ProfileSetup";

export function ProfileSetupWrapper() {
  const { user, needsProfileSetup, isLoading } = useAuth();

  // Only show profile setup if user is logged in and needs to set up profile
  if (isLoading || !user || !needsProfileSetup) {
    return null;
  }

  return <ProfileSetup />;
}

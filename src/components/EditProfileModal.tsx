"use client";

import { useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";

// iOS-style gradient avatars with SF Symbols-inspired icons
const AVATARS = [
  { id: "avatar1", gradient: "from-blue-400 to-blue-600", icon: "person" },
  { id: "avatar2", gradient: "from-purple-400 to-purple-600", icon: "star" },
  { id: "avatar3", gradient: "from-green-400 to-green-600", icon: "leaf" },
  { id: "avatar4", gradient: "from-orange-400 to-orange-600", icon: "sun" },
  { id: "avatar5", gradient: "from-pink-400 to-pink-600", icon: "heart" },
  { id: "avatar6", gradient: "from-cyan-400 to-cyan-600", icon: "bolt" },
];

// SF Symbols-inspired icons
function AvatarIcon({
  icon,
  className = "",
}: {
  icon: string;
  className?: string;
}) {
  const iconPaths: Record<string, ReactNode> = {
    person: (
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'
      />
    ),
    star: (
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'
      />
    ),
    leaf: (
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M12 21c-4.97 0-9-4.03-9-9 0-4.97 9-12 9-12s9 7.03 9 12c0 4.97-4.03 9-9 9z M12 21V9 M8 13c2-2 6-2 8 0'
      />
    ),
    sun: (
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'
      />
    ),
    heart: (
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z'
      />
    ),
    bolt: (
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z'
      />
    ),
  };

  return (
    <svg
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={1.5}
      stroke='currentColor'>
      {iconPaths[icon]}
    </svg>
  );
}

// Image Cropper Component
interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageSize({ width: img.width, height: img.height });

      // Calculate initial scale to fit image in crop area
      const cropSize = 280;
      const minDimension = Math.min(img.width, img.height);
      const initialScale = cropSize / minDimension;
      setScale(Math.max(initialScale, 0.1));
      setPosition({ x: 0, y: 0 });
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setPosition({
        x: clientX - dragStart.x,
        y: clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleMouseMove);
      window.addEventListener("touchend", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleMouseMove);
        window.removeEventListener("touchend", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleCrop = () => {
    if (!imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const outputSize = 400; // Output image size
    canvas.width = outputSize;
    canvas.height = outputSize;

    const cropSize = 280;
    const img = imageRef.current;

    // Calculate what part of the image to draw
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    // Center of crop area is at container center
    const cropCenterX = cropSize / 2;
    const cropCenterY = cropSize / 2;

    // Image center relative to crop area
    const imageCenterX = cropSize / 2 + position.x;
    const imageCenterY = cropSize / 2 + position.y;

    // Source coordinates (in original image space)
    const sourceX =
      (cropCenterX - imageCenterX + scaledWidth / 2) / scale -
      img.width / 2 +
      img.width / 2;
    const sourceY =
      (cropCenterY - imageCenterY + scaledHeight / 2) / scale -
      img.height / 2 +
      img.height / 2;

    // Draw the cropped portion
    ctx.drawImage(
      img,
      (cropCenterX - imageCenterX) / scale +
        img.width / 2 -
        cropSize / scale / 2,
      (cropCenterY - imageCenterY) / scale +
        img.height / 2 -
        cropSize / scale / 2,
      cropSize / scale,
      cropSize / scale,
      0,
      0,
      outputSize,
      outputSize
    );

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCropComplete(blob);
        }
      },
      "image/jpeg",
      0.85
    );
  };

  return (
    <div
      className='fixed inset-0 bg-black z-[60] flex flex-col'
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 bg-black/80'>
        <button
          onClick={onCancel}
          className='text-white text-[17px] px-2 py-1 active:opacity-60'>
          {t("common.cancel")}
        </button>
        <span className='text-white text-[17px] font-semibold'>
          {t("profile.adjustPhoto") || "Adjust Photo"}
        </span>
        <button
          onClick={handleCrop}
          className='text-ios-blue text-[17px] font-semibold px-2 py-1 active:opacity-60'>
          {t("profile.choose") || "Choose"}
        </button>
      </div>

      {/* Crop Area */}
      <div className='flex-1 flex items-center justify-center bg-black overflow-hidden'>
        <div
          ref={containerRef}
          className='relative'
          style={{ width: 280, height: 280 }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}>
          {/* Image */}
          {imageLoaded && imageRef.current && (
            <div
              className={`absolute ${isDragging ? "" : "transition-transform duration-75"}`}
              style={{
                width: imageSize.width * scale,
                height: imageSize.height * scale,
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                cursor: isDragging ? "grabbing" : "grab",
              }}>
              <img
                src={imageSrc}
                alt='Crop preview'
                className='w-full h-full object-contain pointer-events-none select-none'
                draggable={false}
              />
            </div>
          )}
          {/* Circular mask overlay */}
          <div
            className='absolute inset-0 pointer-events-none'
            style={{
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
              borderRadius: "50%",
            }}
          />
          {/* Circle border */}
          <div className='absolute inset-0 rounded-full border-2 border-white/50 pointer-events-none' />
        </div>
      </div>

      {/* Zoom Slider */}
      <div
        className='px-8 py-6 bg-black/80'
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
        <div className='flex items-center gap-4'>
          <button
            onClick={() => setScale(Math.max(0.1, scale - 0.2))}
            className='p-2 active:opacity-60'>
            <svg
              className='w-5 h-5 text-white/60'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7'
              />
            </svg>
          </button>
          <input
            type='range'
            min='0.1'
            max='3'
            step='0.01'
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className='flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:active:scale-110 [&::-webkit-slider-thumb]:transition-transform'
          />
          <button
            onClick={() => setScale(Math.min(3, scale + 0.2))}
            className='p-2 active:opacity-60'>
            <svg
              className='w-6 h-6 text-white/60'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7'
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Hidden canvas for cropping */}
      <canvas ref={canvasRef} className='hidden' />
    </div>
  );
}

// Compress image function
async function compressImage(
  file: File,
  maxSizeMB: number = 1.5
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Calculate new dimensions (max 1200px on longest side)
      let { width, height } = img;
      const maxDimension = 1200;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels to get under max size
      const tryCompress = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"));
              return;
            }

            const sizeMB = blob.size / (1024 * 1024);
            if (sizeMB <= maxSizeMB || quality <= 0.1) {
              resolve(blob);
            } else {
              // Try lower quality
              tryCompress(quality - 0.1);
            }
          },
          "image/jpeg",
          quality
        );
      };

      tryCompress(0.9);
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { profile, user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cropper state
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // Initialize form with current profile data
  useEffect(() => {
    if (profile && isOpen) {
      setFullName(profile.fullName || "");
      if (profile.avatar?.startsWith("http")) {
        setCustomImageUrl(profile.avatar);
        setSelectedAvatar(null);
      } else {
        setSelectedAvatar(profile.avatar);
        setCustomImageUrl(null);
      }
      setError(null);
      setSuccess(false);
      setShowCropper(false);
      setCropImageSrc(null);
    }
  }, [profile, isOpen]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError(t("profile.invalidImage"));
      return;
    }

    setError(null);

    try {
      // Compress image first if needed
      let imageBlob: Blob = file;
      if (file.size > 2 * 1024 * 1024) {
        imageBlob = await compressImage(file, 1.5);
      }

      // Create URL for cropper
      const imageUrl = URL.createObjectURL(imageBlob);
      setCropImageSrc(imageUrl);
      setShowCropper(true);
    } catch (err) {
      console.error("Image processing error:", err);
      setError(t("profile.uploadFailed"));
    }

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user) return;

    setShowCropper(false);
    setCropImageSrc(null);
    setIsUploading(true);
    setError(null);

    try {
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, {
          contentType: "image/jpeg",
        });

      if (uploadError)
        throw new Error(uploadError.message || "Failed to upload image");

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setCustomImageUrl(publicUrl);
      setSelectedAvatar(null);
    } catch (err) {
      console.error("Upload error:", err);
      setError(t("profile.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
    }
    setCropImageSrc(null);
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError(t("profile.nameRequired"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const avatarValue = customImageUrl || selectedAvatar;

    const { error: submitError } = await updateProfile(
      fullName.trim(),
      avatarValue
    );

    if (submitError) {
      setError(submitError.message);
      setIsSubmitting(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Image Cropper Modal */}
      {showCropper && cropImageSrc && (
        <ImageCropper
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      <div className='fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center pb-20 sm:pb-0'>
        <div
          className='w-full sm:max-w-md bg-white dark:bg-ios-card-dark rounded-t-2xl sm:rounded-2xl p-6 pb-8 space-y-5 shadow-xl max-h-[85vh] overflow-y-auto'
          onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className='flex items-center justify-between'>
            <button
              onClick={onClose}
              className='text-ios-blue text-[17px] active:opacity-60'>
              {t("common.cancel")}
            </button>
            <h2 className='text-[17px] font-semibold text-gray-900 dark:text-white'>
              {t("profile.editProfile")}
            </h2>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !fullName.trim()}
              className='text-ios-blue text-[17px] font-semibold disabled:opacity-50 active:opacity-60'>
              {isSubmitting ? t("profile.saving") : t("profile.save")}
            </button>
          </div>

          {/* Avatar Selection */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
              {t("profile.chooseAvatar")}
            </label>

            {/* Custom Image Upload - larger and more prominent */}
            <div className='flex flex-col items-center gap-3 mb-4'>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`relative w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center transition-all active:scale-95 ${
                  customImageUrl
                    ? "ring-4 ring-ios-blue ring-offset-2 dark:ring-offset-ios-card-dark border-0"
                    : "border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-ios-blue"
                }`}>
                {isUploading ? (
                  <div className='w-8 h-8 border-2 border-ios-blue border-t-transparent rounded-full animate-spin' />
                ) : customImageUrl ? (
                  <>
                    <img
                      src={customImageUrl}
                      alt='Custom avatar'
                      className='w-full h-full rounded-full object-cover'
                    />
                    {/* Edit badge */}
                    <div className='absolute bottom-0 right-0 w-7 h-7 bg-ios-blue rounded-full flex items-center justify-center shadow-lg'>
                      <svg
                        className='w-4 h-4 text-white'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={2}
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z'
                        />
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z'
                        />
                      </svg>
                    </div>
                  </>
                ) : (
                  <div className='text-center p-2'>
                    <svg
                      className='w-8 h-8 mx-auto text-gray-400'
                      fill='none'
                      viewBox='0 0 24 24'
                      strokeWidth={1.5}
                      stroke='currentColor'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z'
                      />
                    </svg>
                  </div>
                )}
              </button>
              {/* Upload button text */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className='text-ios-blue text-[15px] font-medium active:opacity-60'>
                {customImageUrl ? t("profile.changePhoto") : t("profile.upload")}
              </button>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                onChange={handleImageSelect}
                className='hidden'
              />
            </div>

            {/* Preset Avatars */}
            <div className='flex justify-center gap-2 flex-wrap'>
              {AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => {
                    setSelectedAvatar(avatar.id);
                    setCustomImageUrl(null);
                  }}
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${
                    avatar.gradient
                  } flex items-center justify-center transition-all shadow-lg ${
                    selectedAvatar === avatar.id && !customImageUrl
                      ? "ring-4 ring-ios-blue ring-offset-2 dark:ring-offset-ios-card-dark scale-110"
                      : "hover:scale-105 active:scale-95"
                  }`}>
                  <AvatarIcon
                    icon={avatar.icon}
                    className='w-6 h-6 text-white'
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Full Name Input */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              {t("profile.fullName")}
            </label>
            <input
              type='text'
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("profile.fullNamePlaceholder")}
              className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-[17px] text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-ios-blue'
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              {t("settings.email")}
            </label>
            <input
              type='email'
              value={user?.email || ""}
              disabled
              className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-[17px] text-gray-500 dark:text-gray-400 outline-none cursor-not-allowed'
            />
            <p className='text-[12px] text-gray-400 mt-1 px-1'>
              {t("settings.emailCannotChange")}
            </p>
          </div>

          {error && <p className='text-sm text-ios-red text-center'>{error}</p>}

          {success && (
            <p className='text-sm text-green-600 text-center'>
              {t("settings.profileUpdated")}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

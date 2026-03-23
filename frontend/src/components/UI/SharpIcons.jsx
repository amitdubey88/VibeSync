import React from 'react';

/**
 * SharpIcons - A collection of zero-radius, brutalist SVG icons.
 * All icons use stroke-linejoin="miter" and stroke-linecap="square" for maximum sharpness.
 */

const BaseIcon = ({ children, size = 20, className = "", viewBox = "0 0 24 24", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="square"
    strokeLinejoin="miter"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block ${className}`}
    {...props}
  >
    {children}
  </svg>
);

export const PlayIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M5 3L19 12L5 21V3Z" strokeWidth="1.5" />
  </BaseIcon>
);

export const PauseIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M6 4H10V20H6V4Z" fill="currentColor" stroke="none" />
    <path d="M14 4H18V20H14V4Z" fill="currentColor" stroke="none" />
  </BaseIcon>
);

export const VolumeHighIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M11 5L6 9H2V15H6L11 19V5Z" />
    <path d="M15.54 8.46C16.4774 9.39764 17.0041 10.6692 17.0041 11.995C17.0041 13.3208 16.4774 14.5924 15.54 15.53" />
    <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" />
  </BaseIcon>
);

export const VolumeMutedIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M11 5L6 9H2V15H6L11 19V5Z" />
    <path d="M22 9L16 15" />
    <path d="M16 9L22 15" />
  </BaseIcon>
);

export const MaximizeIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M15 3H21V9" />
    <path d="M9 21H3V15" />
    <path d="M21 3L14 10" />
    <path d="M3 21L10 14" />
  </BaseIcon>
);

export const MinimizeIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M4 14H10V20" />
    <path d="M20 10H14V4" />
    <path d="M14 10L21 3" />
    <path d="M10 14L3 21" />
  </BaseIcon>
);

export const MicIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 1C10.3431 1 9 2.34315 9 4V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V4C15 2.34315 13.6569 1 12 1Z" />
    <path d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10" />
    <path d="M12 19V23" />
    <path d="M8 23H16" />
  </BaseIcon>
);

export const MicOffIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M1 1L23 23" />
    <path d="M9 4V5M9 9.42V12C9 13.6569 10.3431 15 12 15C12.58 15 13.11 14.83 13.56 14.55" />
    <path d="M15 9.3V4C15 2.34315 13.6569 1 12 1C10.82 1 9.8 1.68 9.33 2.67" />
    <path d="M19 10V12C19 13.13 18.73 14.2 18.25 15.14M16.1 17.14C14.9 18.3 13.52 18.9 12 19C8.13 19 5 15.87 5 12V10" />
    <path d="M12 19V23" />
    <path d="M8 23H16" />
  </BaseIcon>
);

export const UploadIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M21 15V19H3V15" />
    <path d="M17 8L12 3L7 8" />
    <path d="M12 3V15" />
  </BaseIcon>
);

export const PinIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 2V12L15 15L9 21L6 18L9 15L12 12V2Z" fill="currentColor" stroke="none" />
    <path d="M12 2V12M12 12L15 15M12 12L9 15M15 15L9 21M9 21L6 18M6 18L9 15" />
  </BaseIcon>
);

export const CloseIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M18 6L6 18" />
    <path d="M6 6L18 18" />
  </BaseIcon>
);

export const SettingsIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" />
    <path d="M19.4 15L22 12L19.4 9M15 4.6L12 2L9 4.6M4.6 9L2 12L4.6 15M9 19.4L12 22L15 19.4" />
    <path d="M19.4 15V19.4H15M4.6 15V19.4H9M4.6 9V4.6H9M19.4 9V4.6H15" />
  </BaseIcon>
);

export const UserIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" />
    <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" />
  </BaseIcon>
);

export const MessageIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M21 15H7L3 19V5H21V15Z" />
  </BaseIcon>
);

export const SendIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </BaseIcon>
);

export const StarIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
  </BaseIcon>
);

export const ChevronRightIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M9 18L15 12L9 6" />
  </BaseIcon>
);

export const ChevronDownIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M6 9L12 15L18 9" />
  </BaseIcon>
);

export const AddIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 5V19" />
    <path d="M5 12H19" />
  </BaseIcon>
);

export const EastIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M5 12H19" />
    <path d="M13 6L19 12L13 18" />
  </BaseIcon>
);

export const PublicIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    <path d="M2 12H22" />
    <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2V2Z" />
  </BaseIcon>
);

export const LockIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" />
    <path d="M5 11H19V21H5V11Z" />
    <path d="M12 14V18" />
  </BaseIcon>
);

export const LanguageIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    <path d="M2 12H22" />
    <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2V2Z" />
    <path d="M12 2V22" />
  </BaseIcon>
);

export const ShareIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M4 12V20H20V12" />
    <path d="M16 6L12 2L8 6" />
    <path d="M12 2V15" />
  </BaseIcon>
);

export const SyncIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M23 4V10H17" />
    <path d="M1 20V14H7" />
    <path d="M3.51 9C4.30522 7.00904 5.75333 5.33403 7.60833 4.25141C9.46333 3.16879 11.6217 2.738 13.7151 3.03067C15.8085 3.32333 17.72 4.32338 19.125 5.86L23 10" />
    <path d="M20.49 15C19.6948 16.991 18.2467 18.666 16.3917 19.7486C14.5367 20.8312 12.3783 21.262 10.2849 20.9693C8.19154 20.6767 6.28005 19.6766 4.875 18.14L1 14" />
  </BaseIcon>
);

export const EncryptionIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" />
    <path d="M12 8V15" />
    <path d="M10 10L12 8L14 10" />
  </BaseIcon>
);

export const ForumIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M21 15H7L3 19V5H21V15Z" />
    <path d="M9 10H15" />
    <path d="M9 7H13" />
  </BaseIcon>
);

export const RoomIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M2 7H22V17H2V7Z" />
    <path d="M7 21H17" />
    <path d="M12 17V21" />
  </BaseIcon>
);

export const CopyIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M8 4V16H20V4H8Z" />
    <path d="M4 8V20H16" />
  </BaseIcon>
);

export const ParticipantsIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21" />
    <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" />
    <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" />
    <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" />
  </BaseIcon>
);

export const ChatIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M21 15H7L3 19V5H21V15Z" />
  </BaseIcon>
);

export const BackIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M15 18L9 12L15 6" />
  </BaseIcon>
);

export const ExitIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M9 21H5V3H9" />
    <path d="M16 17L21 12L16 7" />
    <path d="M21 12H9" />
  </BaseIcon>
);

export const DeleteIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M3 6H21" />
    <path d="M19 6L18 20H6L5 6" />
    <path d="M8 6V4H16V6" />
    <path d="M10 11V15" />
    <path d="M14 11V15" />
  </BaseIcon>
);

export const ThemeIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    <path d="M12 3V17" />
  </BaseIcon>
);

export const QueueIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M8 6H21" />
    <path d="M8 12H21" />
    <path d="M8 18H21" />
    <path d="M3 6L3 6.01" />
    <path d="M3 12L3 12.01" />
    <path d="M3 18L3 18.01" />
  </BaseIcon>
);

export const InviteIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M10 13C10.4289 13.5714 11 14 12 14C13 14 13.5711 13.5714 14 13L17 10C17.4289 9.42857 18 9 19 9C20 9 20.5711 9.42857 21 10L17 14L14 17C13.5711 17.4286 13 18 12 18C11 18 10.4289 17.4286 10 17" />
    <path d="M14 11C13.5711 10.4286 13 10 12 10C11 10 10.4289 10.4286 10 11L7 14C6.5711 14.5714 6 15 5 15C4 15 3.4289 14.5714 3 14L7 10L10 7C10.4289 6.57143 11 6 12 6C13 6 13.5711 6.57143 14 7" />
  </BaseIcon>
);

export const MoreIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 5V5.01" />
    <path d="M12 12V12.01" />
    <path d="M12 19V19.01" />
  </BaseIcon>
);

export const ShieldIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" />
  </BaseIcon>
);

export const CrownIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M2 4L5 12L12 6L19 12L22 4L12 2L2 4Z" fill="currentColor" stroke="none" />
    <path d="M22 4L19 12L12 6L5 12L2 4L12 2L22 4Z" />
    <path d="M7 14H17M2 20H22V22H2V20Z" />
  </BaseIcon>
);

export const InfoIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    <path d="M12 16V12" />
    <path d="M12 8V8.01" />
  </BaseIcon>
);

export const ActivityIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M22 12H18L15 21L9 3L6 12H2" />
  </BaseIcon>
);

export const RefreshIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M23 4V10H17" />
    <path d="M1 20V14H7" />
    <path d="M3.51 9C4.30522 7.00904 5.75333 5.33403 7.60833 4.25141C9.46333 3.16879 11.6217 2.738 13.7151 3.03067C15.8085 3.32333 17.72 4.32338 19.125 5.86L23 10" />
    <path d="M20.49 15C19.6948 16.991 18.2467 18.666 16.3917 19.7486C14.5367 20.8312 12.3783 21.262 10.2849 20.9693C8.19154 20.6767 6.28005 19.6766 4.875 18.14L1 14" />
  </BaseIcon>
);

export const PlusIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 5V19" />
    <path d="M5 12H19" />
  </BaseIcon>
);

export const MinusIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M5 12H19" />
  </BaseIcon>
);

export const WifiIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M5 12.55C8.31 9.24 13.69 9.24 17 12.55" />
    <path d="M1 8.55C7.07 2.48 16.93 2.48 23 8.55" />
    <path d="M9 16.55C10.66 14.89 13.34 14.89 15 16.55" />
    <path d="M12 21.55V21.56" />
  </BaseIcon>
);

export const CheckIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M20 6L9 17L4 12" />
  </BaseIcon>
);

export const XIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M18 6L6 18M6 6L18 18" />
  </BaseIcon>
);

export const BellIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M18 8C18 4.686 15.314 2 12 2C8.686 2 6 4.686 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" />
    <path d="M10.3 21C10.61 21.59 11.26 22 12 22C12.74 22 13.39 21.59 13.7 21" />
  </BaseIcon>
);

export const BellOffIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M13.73 21C13.55 21.3 13.3 21.55 13 21.73C12.69 21.9 12.35 22 12 22C11.65 22 11.31 21.9 11 21.73C10.7 21.55 10.45 21.3 10.27 21" />
    <path d="M18 8C18 7.33 17.89 6.7 17.69 6.11" />
    <path d="M16.1 10.6C16.03 12.02 16.34 13.52 17 14.82C17.31 15.42 17.65 16.03 18 17H3.45" />
    <path d="M10.15 4.39C10.72 4.14 11.34 4 12 4C14.21 4 16 5.79 16 8C16 8.35 15.96 11.19 15.54 12.18" />
    <path d="M1 1L23 23" />
  </BaseIcon>
);

export const SmileIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14" />
    <path d="M9 9V9.01" />
    <path d="M15 9V9.01" />
  </BaseIcon>
);

export const LinkIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M10 13C12.7614 13 15 10.7614 15 8C15 5.23858 12.7614 3 10 3H7C4.23858 3 2 5.23858 2 8C2 10.7614 4.23858 13 7 13H10Z" />
    <path d="M14 11C11.2386 11 9 13.2386 9 16C9 18.7614 11.2386 21 14 21H17C19.7614 21 22 18.7614 22 16C22 13.2386 19.7614 11 17 11H14Z" />
    <path d="M8 12H16" />
  </BaseIcon>
);

export const ClockIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    <path d="M12 6V12L16 14" />
  </BaseIcon>
);

export const ReplyIcon = (props) => (
  <BaseIcon {...props}>
    <path d="M10 18L3 11L10 4V8C15 8 19 9 21 14C18 12 15 11 10 11V18Z" />
  </BaseIcon>
);

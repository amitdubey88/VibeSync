import { getInitials, getAvatarColor, formatMessageTime } from '../../utils/helpers';

const MessageBubble = ({ message, isOwn }) => {
  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-text-muted bg-bg-hover px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const avatarBg = message.avatar || getAvatarColor(message.username);

  return (
    <div className={`flex gap-2 items-start animate-fade-in ${isOwn ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className="avatar w-7 h-7 text-xs text-white shrink-0 mt-0.5"
        style={{ backgroundColor: avatarBg }}
      >
        {getInitials(message.username)}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {!isOwn && (
          <span className="text-xs text-text-muted font-medium">{message.username}</span>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
            ${isOwn
              ? 'bg-accent-purple text-white rounded-tr-sm'
              : 'bg-bg-hover text-text-primary rounded-tl-sm'
            }`}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-text-muted">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;

export default function AvatarDisplay({ avatar, emojiClass }: { avatar: string; emojiClass?: string }) {
  if (avatar.startsWith('data:')) {
    return <img src={avatar} alt="" className="w-full h-full object-cover rounded-full" />;
  }
  return <span className={emojiClass}>{avatar}</span>;
}

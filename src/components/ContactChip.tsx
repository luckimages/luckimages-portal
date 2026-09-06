"use client";

import { useState } from "react";
import { avatarUrl as getAvatarUrl } from "@/lib/avatarUrl";

type Props = {
  contactId: string | null;
  name: string;
  email?: string;
  size?: "sm" | "md";
};

export default function ContactChip({ contactId, name, email, size = "md" }: Props) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || email || "?").charAt(0).toUpperCase();
  const avatarUrl = contactId && !imgError ? getAvatarUrl(contactId) : null;

  const href = contactId ? `/admin/contacts/${contactId}` : undefined;

  const avatarSize = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  const nameSize   = size === "sm" ? "text-xs" : "text-sm";

  const inner = (
    <span className={`inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] rounded-full pr-3 hover:border-white/25 hover:bg-white/[0.06] transition-all group ${size === "sm" ? "py-0.5 pl-0.5" : "py-1 pl-1"}`}>
      <span className={`${avatarSize} rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <span className="font-bold text-white/60">{initial}</span>
        )}
      </span>
      <span className={`${nameSize} font-medium text-white truncate max-w-[140px] group-hover:text-white transition-colors`}>
        {name || email || "Unknown"}
      </span>
    </span>
  );

  if (href) {
    return <a href={href} onClick={e => e.stopPropagation()}>{inner}</a>;
  }
  return inner;
}

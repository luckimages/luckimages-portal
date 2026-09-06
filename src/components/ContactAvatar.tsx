"use client";

import { useState } from "react";
import { avatarUrl } from "@/lib/avatarUrl";

interface Props {
  contactId: string | null | undefined;
  name: string;
  size?: number; // px, default 28
}

export default function ContactAvatar({ contactId, name, size = 28 }: Props) {
  const [imgError, setImgError] = useState(false);
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const fontSize = Math.round(size * 0.4);

  if (contactId && !imgError) {
    return (
      <img
        src={avatarUrl(contactId)}
        alt={name}
        width={size}
        height={size}
        onError={() => setImgError(true)}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 font-bold text-white"
      style={{ width: size, height: size, fontSize }}
    >
      {initial}
    </div>
  );
}

import { useEffect, useState } from "react";
import { getCachedAvatarSource, normalizeAvatarUrl, removeCachedAvatar } from "../core/avatarCache";

type RemoteAvatarProps = {
  alt?: string;
  className?: string;
  url: string | null;
};

export function RemoteAvatar({ alt = "", className, url }: RemoteAvatarProps) {
  const safeUrl = url ? normalizeAvatarUrl(url) : null;
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSource(null);
    if (!safeUrl) return () => { active = false; };
    const fallback = window.setTimeout(() => {
      if (active) setSource(current => current ?? safeUrl);
    }, 200);
    void getCachedAvatarSource(safeUrl).then(cached => {
      window.clearTimeout(fallback);
      if (active) {
        setSource(cached ?? safeUrl);
        setFailed(false);
      }
    });
    return () => {
      active = false;
      window.clearTimeout(fallback);
    };
  }, [retry, safeUrl]);

  useEffect(() => {
    const retryOnline = () => setRetry(value => value + 1);
    window.addEventListener("online", retryOnline);
    return () => window.removeEventListener("online", retryOnline);
  }, []);

  if (!safeUrl || !source || failed) return null;
  return <img
    alt={alt}
    className={className}
    key={`${safeUrl}:${retry}:${source.startsWith("data:") ? "cached" : "remote"}`}
    onError={() => {
      if (source.startsWith("data:")) void removeCachedAvatar(safeUrl);
      setFailed(true);
    }}
    src={source}
  />;
}

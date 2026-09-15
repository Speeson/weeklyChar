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
  const [source, setSource] = useState<string | null>(safeUrl);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSource(safeUrl);
    if (!safeUrl) return () => { active = false; };
    void getCachedAvatarSource(safeUrl).then(cached => {
      if (active && cached) {
        setSource(cached);
        setFailed(false);
      }
    });
    return () => { active = false; };
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

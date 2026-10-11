import { useEffect, useMemo, useRef } from "react";
import { resolveMerchantStorefrontMedia } from "../utils/merchantStorefrontMedia";

const LOOP_TAIL_SECONDS = 8;

export default function MerchantAmbientBackdrop({ merchant, className = "" }) {
  const videoRef = useRef(null);
  const media = useMemo(() => resolveMerchantStorefrontMedia(merchant), [merchant]);
  const hasVideo = Boolean(media.videoUrl);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasVideo) return undefined;

    const syncLoopStart = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      video.dataset.loopStart = String(Math.max(0, video.duration - LOOP_TAIL_SECONDS));
      video.play().catch(() => {});
    };

    const loopTail = () => {
      const loopStart = Number(video.dataset.loopStart || 0);
      if (!Number.isFinite(video.duration) || loopStart <= 0) return;
      if (video.currentTime >= video.duration - 0.08) {
        video.currentTime = loopStart;
        video.play().catch(() => {});
      }
    };

    video.addEventListener("loadedmetadata", syncLoopStart);
    video.addEventListener("timeupdate", loopTail);
    return () => {
      video.removeEventListener("loadedmetadata", syncLoopStart);
      video.removeEventListener("timeupdate", loopTail);
    };
  }, [hasVideo, media.videoUrl]);

  return <div className={`merchant-ambient-backdrop is-${media.theme || "general"} ${media.imageUrl ? "has-image" : "is-neutral-fallback"} ${className}`} aria-hidden="true">
    {media.imageUrl ? <img className="merchant-ambient-backdrop__image" src={media.imageUrl} alt="" loading="lazy" /> : <div className="merchant-ambient-backdrop__fallback">
      <span>{String(media.theme || "general").replace(/-/g, " ")}</span>
    </div>}
    {hasVideo ? <video
      ref={videoRef}
      key={media.videoUrl}
      className="merchant-ambient-backdrop__video"
      src={media.videoUrl}
      poster={media.imageUrl || undefined}
      muted
      playsInline
      preload="metadata"
    /> : null}
    <div className="merchant-ambient-backdrop__shade" />
    <div className="merchant-ambient-backdrop__vignette" />
  </div>;
}

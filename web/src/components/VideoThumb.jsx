import Icon from './Icon.jsx';

// Pull the 11-char video id out of any common YouTube URL shape.
function youtubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// A clickable YouTube thumbnail with a play overlay. Uses the public img.youtube.com
// thumbnail (no API key). Renders nothing if the URL isn't a recognizable YouTube link.
export default function VideoThumb({ url, className = '' }) {
  const id = youtubeId(url);
  if (!id) return null;
  // mqdefault = clean 16:9 320×180 (no letterboxing), always available.
  const thumb = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Watch the tutorial"
      className={`relative block w-24 h-[54px] rounded-lg overflow-hidden border border-outline-variant shrink-0 group ${className}`}
    >
      <img src={thumb} loading="lazy" alt="" className="w-full h-full object-cover" />
      <span className="absolute inset-0 grid place-items-center bg-black/15 group-hover:bg-black/30 transition-colors">
        <span className="w-7 h-7 rounded-full bg-white/90 grid place-items-center shadow group-hover:scale-110 transition-transform">
          <Icon name="play_arrow" filled className="text-error text-lg leading-none" />
        </span>
      </span>
    </a>
  );
}

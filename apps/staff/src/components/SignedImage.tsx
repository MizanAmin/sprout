import { useSignedUrl } from '../features/uploads/useUpload';

// Renders a private-bucket image by resolving its stored path to a signed URL.
export function SignedImage({
  path,
  alt = '',
  className,
}: {
  path: string | null | undefined;
  alt?: string;
  className?: string;
}) {
  const { data } = useSignedUrl(path);
  if (!path) return null;
  if (!data?.url) return <div className={`${className ?? ''} bg-gray-100`} aria-hidden />;
  return <img src={data.url} alt={alt} className={className} />;
}

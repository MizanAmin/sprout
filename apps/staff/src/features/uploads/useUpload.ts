import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api';

export type UploadKind = 'logo' | 'observation' | 'generic';

// Upload a file to the private bucket via the API; returns the stored path
// (store it in a *_url column, then read it back with useSignedUrl to display).
export function useUpload() {
  return useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: UploadKind }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      return api.upload<{ path: string }>('/uploads', fd);
    },
  });
}

// Resolve a stored path to a short-lived signed URL for display.
export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', path],
    queryFn: () => api.get<{ url: string }>(`/uploads/url?path=${encodeURIComponent(path!)}`),
    enabled: !!path,
    staleTime: 50 * 60 * 1000, // refresh before the 1h signed URL expires
  });
}

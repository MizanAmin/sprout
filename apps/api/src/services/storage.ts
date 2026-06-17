import { supabaseAdmin } from '../db';

// Single private bucket. All access goes through the API via short-lived signed
// URLs — the frontend never constructs storage URLs directly.
export const STORAGE_BUCKET = 'sprout-files';

export async function uploadFile(
  path: string,
  data: ArrayBuffer | Uint8Array | Blob,
  contentType: string,
  upsert = true,
): Promise<{ path: string }> {
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, data, { contentType, upsert });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { path };
}

export async function getSignedUrl(
  path: string,
  expiresIn = 3600,
): Promise<{ url: string; expiresAt: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`);
  return { url: data.signedUrl, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
}

export async function deleteFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(paths);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

export async function listFiles(prefix: string): Promise<{ name: string }[]> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(`Storage list failed: ${error.message}`);
  return data ?? [];
}

// Canonical path builders — keep every caller consistent with the bucket layout.
export const storagePaths = {
  nurseryLogo: (n: number, ext: string) => `nursery-${n}/logo.${ext}`,
  childPhoto: (n: number, childId: number, ext: string) =>
    `nursery-${n}/children/${childId}/photo.${ext}`,
  childDocument: (n: number, childId: number, docId: number, filename: string) =>
    `nursery-${n}/children/${childId}/documents/${docId}-${filename}`,
  observationPhoto: (n: number, obsId: number, filename: string) =>
    `nursery-${n}/observations/${obsId}-${filename}`,
  staffTraining: (n: number, staffId: number, trainingId: number, ext: string) =>
    `nursery-${n}/staff/${staffId}/training/${trainingId}-certificate.${ext}`,
  policy: (n: number, policyId: number, filename: string) =>
    `nursery-${n}/policies/${policyId}-${filename}.pdf`,
  riskAssessment: (n: number, raId: number, filename: string) =>
    `nursery-${n}/risk-assessments/${raId}-${filename}.pdf`,
  // System DB backups are cross-tenant, so they live at the bucket root, not under a nursery.
  backup: (date: string, table: string) => `backups/${date}/${table}.json`,
};

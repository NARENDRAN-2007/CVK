export type UploadedClaimDocument = {
  id: number;
  claimId: string;
  filename: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export async function uploadClaimDocument(file: File, claimId: string): Promise<UploadedClaimDocument> {
  const response = await fetch(`/api/claim-documents/upload?claimId=${encodeURIComponent(claimId)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-File-Name": file.name,
      "X-File-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || `Upload failed with status ${response.status}`);
  }

  return response.json() as Promise<UploadedClaimDocument>;
}

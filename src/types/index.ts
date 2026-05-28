export const AGE_CATEGORIES = ["3-6", "7-10", "11-16"] as const;

export type AgeCategory = (typeof AGE_CATEGORIES)[number];

export type Drawing = {
  id: string;
  title: string;
  child_name: string | null;
  age_category: AgeCategory;
  image_url: string;
  created_at: string;
};

export type AdminDrawingResult = Drawing & {
  vote_count: number;
};

export type VoteIdentity = {
  localDeviceId?: string;
  cookieDeviceId?: string;
  fingerprintHash?: string;
};

export type VoteResult = {
  status: "success" | "already_voted" | "error";
  message: string;
};

export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type DrawingUploadInput = {
  title: string;
  childName?: string;
  ageCategory: string;
  fileName: string;
  contentType: string;
  size: number;
};

export type PreparedDrawingUpload = ActionState & {
  upload?: {
    path: string;
    token: string;
    cacheControl: string;
  };
};

export type FinalizeDrawingUploadInput = {
  title: string;
  childName?: string;
  ageCategory: string;
  filePath: string;
};

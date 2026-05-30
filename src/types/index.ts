export const AGE_CATEGORIES = ["4–7 нас", "8–11 нас", "12–16 нас"] as const;
export const EMPLOYEE_STATUSES = ["active", "inactive", "blocked"] as const;

export type AgeCategory = (typeof AGE_CATEGORIES)[number];
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export type Drawing = {
  id: string;
  title: string;
  child_name: string | null;
  age_category: AgeCategory;
  image_url: string;
  created_at: string;
  vote_count: number;
};

export type AdminDrawingResult = Drawing;

export type Employee = {
  id: string;
  sap_code: string;
  first_name: string;
  last_name: string;
  status: EmployeeStatus;
  created_at: string;
  updated_at: string;
};

export type EmployeeAccess = Pick<Employee, "id" | "sap_code" | "first_name" | "last_name" | "status"> & {
  votedCategories: Partial<Record<AgeCategory, string>>;
};

export type AdminEmployeeRow = Employee & {
  votes_used: number;
  last_vote_date: string | null;
};

export type AdminVoteRecord = {
  id: string;
  created_at: string;
  deleted_at: string | null;
  sap_code: string;
  employee_first_name: string | null;
  employee_last_name: string | null;
  age_category: AgeCategory;
  browser_summary: string | null;
  drawing_title: string;
  drawing_child_name: string | null;
};

export type VoteIdentity = {
  localDeviceId?: string;
  cookieDeviceId?: string;
  fingerprintHash?: string;
  browserSummary?: string;
};

export type VoteResult = {
  status: "success" | "already_voted" | "already_voted_category" | "error";
  message: string;
  ageCategory?: AgeCategory;
  voteCount?: number;
};

export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type SapValidationResult =
  | {
      status: "success";
      message: string;
      employee: EmployeeAccess;
    }
  | {
      status: "invalid" | "inactive" | "error";
      message: string;
    };

export type EmployeeImportSummary = ActionState & {
  totalRows?: number;
  imported?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
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

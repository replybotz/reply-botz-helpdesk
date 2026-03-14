export interface LmsUserData {
  lmsUserId: string;
  email?: string;
  name?: string;
  role: 'student' | 'teacher' | 'admin' | 'parent';
  lmsRole?: string;
  courses?: Array<{ id: string; name: string }>;
}

export interface LmsCourseData {
  lmsCourseId: string;
  courseName: string;
  courseCode?: string;
  teacherIds?: string[];
  studentCount?: number;
}

export interface LmsAssignmentData {
  lmsAssignmentId: string;
  lmsCourseId: string;
  assignmentName: string;
  dueDate?: Date;
  description?: string;
}

export interface LmsAssignmentContext {
  assignment: LmsAssignmentData;
  course: LmsCourseData;
  studentContext?: {
    submitted: boolean;
    grade?: string;
    dueDate?: Date;
    isLate?: boolean;
  };
}

export interface LmsSyncResult {
  syncType: string;
  recordsSynced: number;
  errors: string[];
  startedAt: Date;
  completedAt: Date;
}

export type LmsCapability = 'user_sync' | 'course_sync' | 'assignment_sync' | 'grade_sync';

export interface ILmsProvider {
  readonly name: string;
  readonly platform: string;
  readonly capabilities: LmsCapability[];
  readonly authMethod: 'oauth2' | 'api_key' | 'lti';

  /**
   * Sync users from LMS (students, teachers, admins)
   */
  syncUsers(integrationId: string, courseId?: string): Promise<LmsSyncResult>;

  /**
   * Sync courses from LMS
   */
  syncCourses(integrationId: string): Promise<LmsSyncResult>;

  /**
   * Sync assignments from LMS for a specific course
   */
  syncAssignments(integrationId: string, courseId: string): Promise<LmsSyncResult>;

  /**
   * Get assignment context for AI support conversations
   */
  getAssignmentContext(
    integrationId: string,
    assignmentId: string,
    userId?: string,
  ): Promise<LmsAssignmentContext | null>;

  /**
   * Resolve a user by email address to their LMS user profile
   */
  resolveUserFromEmail(integrationId: string, email: string): Promise<LmsUserData | null>;

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: Buffer, signature: string, secret: string): boolean;

  /**
   * Process incoming webhook event
   */
  processWebhookEvent(event: Record<string, unknown>): Promise<void>;

  /**
   * Check if the integration credentials are valid
   */
  testConnection(integrationId: string): Promise<{ success: boolean; message: string }>;
}

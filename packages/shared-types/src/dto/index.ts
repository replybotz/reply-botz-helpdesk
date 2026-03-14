// Pagination
export interface PaginationDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth DTOs
export interface LoginDto {
  email: string;
  password: string;
  organizationSlug?: string;
}

export interface RegisterOrganizationDto {
  organizationName: string;
  organizationSlug: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
  iat?: number;
  exp?: number;
}

// LMS sync DTOs
export interface LmsSyncRequestDto {
  syncType: 'users' | 'courses' | 'assignments' | 'all';
  courseId?: string;
}

// AI chat DTOs
export interface AiChatRequestDto {
  conversationId?: string;
  message: string;
  lmsContext?: {
    platform?: string;
    courseId?: string;
    assignmentId?: string;
    userRole?: string;
  };
  modelConfig?: {
    provider?: string;
    model?: string;
  };
}

export interface AiChatResponseDto {
  conversationId: string;
  messageId: string;
  content: string;
  provider: string;
  model: string;
  tokensUsed?: number;
  moderationStatus?: string;
}

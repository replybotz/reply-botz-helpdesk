import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { EncryptionService } from '../../ferpa-compliance/encryption.service';
import { BaseLmsProvider } from './base-lms.provider';
import { LmsCapability, LmsSyncResult } from '../interfaces/lms-provider.interface';
import axios from 'axios';

@Injectable()
export class CanvasProvider extends BaseLmsProvider {
  readonly name = 'Canvas LMS';
  readonly platform = 'canvas';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync', 'assignment_sync', 'grade_sync'];
  readonly authMethod = 'api_key' as const;

  protected readonly logger = new Logger(CanvasProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {
    super();
  }

  private async getApiBase(integrationId: string): Promise<{ apiBase: string; apiKey: string }> {
    const integration = await this.prisma.lmsIntegration.findUniqueOrThrow({
      where: { id: integrationId },
    });
    const instanceUrl = integration.lmsInstanceUrl ?? 'https://canvas.instructure.com';
    const apiKey = this.encryption.decrypt(integration.apiKey!);
    return { apiBase: `${instanceUrl}/api/v1`, apiKey };
  }

  async syncUsers(integrationId: string, courseId?: string): Promise<LmsSyncResult> {
    const startedAt = new Date();
    const { apiBase, apiKey } = await this.getApiBase(integrationId);
    const integration = await this.prisma.lmsIntegration.findUniqueOrThrow({
      where: { id: integrationId },
    });

    let recordsSynced = 0;
    const errors: string[] = [];

    try {
      const endpoint = courseId
        ? `${apiBase}/courses/${courseId}/enrollments?type[]=StudentEnrollment&type[]=TeacherEnrollment`
        : `${apiBase}/accounts/1/users`;

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      for (const enrollment of response.data ?? []) {
        const user = enrollment.user ?? enrollment;
        const encryptedEmail = user.login_id ? this.encryption.encrypt(user.login_id) : undefined;
        const encryptedName = user.name ? this.encryption.encrypt(user.name) : undefined;
        const role = enrollment.type?.includes('Student') ? 'student' : 'teacher';

        await this.prisma.lmsUser.upsert({
          where: {
            lmsIntegrationId_lmsUserId: {
              lmsIntegrationId: integrationId,
              lmsUserId: String(user.id),
            },
          },
          update: { email: encryptedEmail, name: encryptedName, syncedAt: new Date() },
          create: {
            organizationId: integration.organizationId,
            lmsIntegrationId: integrationId,
            lmsUserId: String(user.id),
            lmsPlatform: this.platform,
            email: encryptedEmail,
            name: encryptedName,
            lmsRole: role,
            syncedAt: new Date(),
          },
        });
        recordsSynced++;
      }
    } catch (err) {
      errors.push((err as Error).message);
    }

    return this.createSyncResult('users', recordsSynced, errors, startedAt);
  }

  async syncCourses(integrationId: string): Promise<LmsSyncResult> {
    const startedAt = new Date();
    const { apiBase, apiKey } = await this.getApiBase(integrationId);

    let recordsSynced = 0;
    const errors: string[] = [];

    try {
      const response = await axios.get(`${apiBase}/courses?enrollment_state=active`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      for (const course of response.data ?? []) {
        await this.prisma.lmsCourse.upsert({
          where: {
            lmsIntegrationId_lmsCourseId: {
              lmsIntegrationId: integrationId,
              lmsCourseId: String(course.id),
            },
          },
          update: { courseName: course.name, courseCode: course.course_code, syncedAt: new Date() },
          create: {
            lmsIntegrationId: integrationId,
            lmsCourseId: String(course.id),
            lmsPlatform: this.platform,
            courseName: course.name,
            courseCode: course.course_code,
            syncedAt: new Date(),
          },
        });
        recordsSynced++;
      }
    } catch (err) {
      errors.push((err as Error).message);
    }

    return this.createSyncResult('courses', recordsSynced, errors, startedAt);
  }

  async syncAssignments(integrationId: string, courseId: string): Promise<LmsSyncResult> {
    const startedAt = new Date();
    const { apiBase, apiKey } = await this.getApiBase(integrationId);

    let recordsSynced = 0;
    const errors: string[] = [];

    try {
      const response = await axios.get(`${apiBase}/courses/${courseId}/assignments`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      for (const assignment of response.data ?? []) {
        await this.prisma.lmsAssignment.upsert({
          where: {
            lmsIntegrationId_lmsAssignmentId: {
              lmsIntegrationId: integrationId,
              lmsAssignmentId: String(assignment.id),
            },
          },
          update: {
            assignmentName: assignment.name,
            dueDate: assignment.due_at ? new Date(assignment.due_at) : null,
            description: assignment.description,
            syncedAt: new Date(),
          },
          create: {
            lmsIntegrationId: integrationId,
            lmsAssignmentId: String(assignment.id),
            lmsCourseId: courseId,
            lmsPlatform: this.platform,
            assignmentName: assignment.name,
            dueDate: assignment.due_at ? new Date(assignment.due_at) : null,
            description: assignment.description,
            syncedAt: new Date(),
          },
        });
        recordsSynced++;
      }
    } catch (err) {
      errors.push((err as Error).message);
    }

    return this.createSyncResult('assignments', recordsSynced, errors, startedAt);
  }

  async getAssignmentContext(integrationId: string, assignmentId: string) {
    const assignment = await this.prisma.lmsAssignment.findFirst({
      where: { lmsIntegrationId: integrationId, lmsAssignmentId: assignmentId },
    });
    if (!assignment) return null;
    const course = await this.prisma.lmsCourse.findFirst({
      where: { lmsIntegrationId: integrationId, lmsCourseId: assignment.lmsCourseId },
    });
    return {
      assignment: {
        lmsAssignmentId: assignment.lmsAssignmentId,
        lmsCourseId: assignment.lmsCourseId,
        assignmentName: assignment.assignmentName,
        dueDate: assignment.dueDate ?? undefined,
        description: assignment.description ?? undefined,
      },
      course: {
        lmsCourseId: course?.lmsCourseId ?? assignment.lmsCourseId,
        courseName: course?.courseName ?? 'Unknown Course',
        courseCode: course?.courseCode ?? undefined,
      },
    };
  }

  async resolveUserFromEmail(integrationId: string, email: string) {
    const users = await this.prisma.lmsUser.findMany({ where: { lmsIntegrationId: integrationId } });
    for (const user of users) {
      if (!user.email) continue;
      try {
        if (this.encryption.decrypt(user.email).toLowerCase() === email.toLowerCase()) {
          return {
            lmsUserId: user.lmsUserId,
            email,
            name: user.name ? this.encryption.decrypt(user.name) : undefined,
            role: (user.lmsRole ?? 'student') as 'student' | 'teacher' | 'admin' | 'parent',
          };
        }
      } catch { continue; }
    }
    return null;
  }

  async testConnection(integrationId: string) {
    try {
      const { apiBase, apiKey } = await this.getApiBase(integrationId);
      await axios.get(`${apiBase}/users/self`, { headers: { Authorization: `Bearer ${apiKey}` } });
      return { success: true, message: 'Connection successful' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }
}

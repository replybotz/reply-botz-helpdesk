import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { EncryptionService } from '../../ferpa-compliance/encryption.service';
import { BaseLmsProvider } from './base-lms.provider';
import { LmsCapability, LmsSyncResult, LmsUserData } from '../interfaces/lms-provider.interface';
import axios from 'axios';

@Injectable()
export class GoogleClassroomProvider extends BaseLmsProvider {
  readonly name = 'Google Classroom';
  readonly platform = 'google_classroom';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync', 'assignment_sync'];
  readonly authMethod = 'oauth2' as const;

  protected readonly logger = new Logger(GoogleClassroomProvider.name);
  private readonly apiBase = 'https://classroom.googleapis.com/v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {
    super();
  }

  async syncUsers(integrationId: string, courseId?: string): Promise<LmsSyncResult> {
    const startedAt = new Date();
    const integration = await this.getIntegration(integrationId);
    const accessToken = this.encryption.decrypt(integration.accessToken!);

    let recordsSynced = 0;
    const errors: string[] = [];

    try {
      // Get all courses if no specific courseId
      const courseIds = courseId ? [courseId] : await this.getCourseIds(accessToken);

      for (const cId of courseIds) {
        try {
          // Fetch students
          const studentsResp = await axios.get(
            `${this.apiBase}/courses/${cId}/students`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );

          for (const student of studentsResp.data.students ?? []) {
            await this.upsertLmsUser(integrationId, integration.organizationId, {
              lmsUserId: student.userId,
              email: student.profile?.emailAddress,
              name: student.profile?.name?.fullName,
              role: 'student',
              lmsRole: 'student',
              courses: [{ id: cId, name: '' }],
            });
            recordsSynced++;
          }

          // Fetch teachers
          const teachersResp = await axios.get(
            `${this.apiBase}/courses/${cId}/teachers`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );

          for (const teacher of teachersResp.data.teachers ?? []) {
            await this.upsertLmsUser(integrationId, integration.organizationId, {
              lmsUserId: teacher.userId,
              email: teacher.profile?.emailAddress,
              name: teacher.profile?.name?.fullName,
              role: 'teacher',
              lmsRole: 'teacher',
              courses: [{ id: cId, name: '' }],
            });
            recordsSynced++;
          }
        } catch (err) {
          errors.push(`Course ${cId}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      errors.push((err as Error).message);
    }

    await this.prisma.lmsIntegration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date() },
    });

    return this.createSyncResult('users', recordsSynced, errors, startedAt);
  }

  async syncCourses(integrationId: string): Promise<LmsSyncResult> {
    const startedAt = new Date();
    const integration = await this.getIntegration(integrationId);
    const accessToken = this.encryption.decrypt(integration.accessToken!);

    let recordsSynced = 0;
    const errors: string[] = [];

    try {
      const response = await axios.get(`${this.apiBase}/courses?courseStates=ACTIVE`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      for (const course of response.data.courses ?? []) {
        await this.prisma.lmsCourse.upsert({
          where: {
            lmsIntegrationId_lmsCourseId: {
              lmsIntegrationId: integrationId,
              lmsCourseId: course.id,
            },
          },
          update: {
            courseName: course.name,
            courseCode: course.section,
            syncedAt: new Date(),
          },
          create: {
            lmsIntegrationId: integrationId,
            lmsCourseId: course.id,
            lmsPlatform: this.platform,
            courseName: course.name,
            courseCode: course.section,
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
    const integration = await this.getIntegration(integrationId);
    const accessToken = this.encryption.decrypt(integration.accessToken!);

    let recordsSynced = 0;
    const errors: string[] = [];

    try {
      const response = await axios.get(
        `${this.apiBase}/courses/${courseId}/courseWork`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      for (const work of response.data.courseWork ?? []) {
        await this.prisma.lmsAssignment.upsert({
          where: {
            lmsIntegrationId_lmsAssignmentId: {
              lmsIntegrationId: integrationId,
              lmsAssignmentId: work.id,
            },
          },
          update: {
            assignmentName: work.title,
            dueDate: work.dueDate
              ? new Date(
                  `${work.dueDate.year}-${work.dueDate.month}-${work.dueDate.day}`,
                )
              : null,
            description: work.description,
            syncedAt: new Date(),
          },
          create: {
            lmsIntegrationId: integrationId,
            lmsAssignmentId: work.id,
            lmsCourseId: courseId,
            lmsPlatform: this.platform,
            assignmentName: work.title,
            dueDate: work.dueDate
              ? new Date(
                  `${work.dueDate.year}-${work.dueDate.month}-${work.dueDate.day}`,
                )
              : null,
            description: work.description,
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

  async getAssignmentContext(integrationId: string, assignmentId: string, userId?: string) {
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

  async resolveUserFromEmail(integrationId: string, email: string): Promise<LmsUserData | null> {
    const users = await this.prisma.lmsUser.findMany({
      where: { lmsIntegrationId: integrationId },
    });

    const encryptionSvc = this.encryption;
    for (const user of users) {
      if (!user.email) continue;
      try {
        const decryptedEmail = encryptionSvc.decrypt(user.email);
        if (decryptedEmail.toLowerCase() === email.toLowerCase()) {
          return {
            lmsUserId: user.lmsUserId,
            email: decryptedEmail,
            name: user.name ? encryptionSvc.decrypt(user.name) : undefined,
            role: (user.role?.toLowerCase() ?? 'student') as LmsUserData['role'],
            lmsRole: user.lmsRole ?? undefined,
          };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async testConnection(integrationId: string): Promise<{ success: boolean; message: string }> {
    try {
      const integration = await this.getIntegration(integrationId);
      if (!integration.accessToken) {
        return { success: false, message: 'No access token configured' };
      }
      const accessToken = this.encryption.decrypt(integration.accessToken);
      await axios.get(`${this.apiBase}/courses?pageSize=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return { success: true, message: 'Connection successful' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  private async getIntegration(integrationId: string) {
    const integration = await this.prisma.lmsIntegration.findUniqueOrThrow({
      where: { id: integrationId },
    });
    return integration;
  }

  private async getCourseIds(accessToken: string): Promise<string[]> {
    const response = await axios.get(`${this.apiBase}/courses?courseStates=ACTIVE`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return (response.data.courses ?? []).map((c: Record<string, string>) => c.id);
  }

  private async upsertLmsUser(
    integrationId: string,
    organizationId: string,
    data: LmsUserData,
  ) {
    const encryptedEmail = data.email ? this.encryption.encrypt(data.email) : undefined;
    const encryptedName = data.name ? this.encryption.encrypt(data.name) : undefined;

    await this.prisma.lmsUser.upsert({
      where: {
        lmsIntegrationId_lmsUserId: {
          lmsIntegrationId: integrationId,
          lmsUserId: data.lmsUserId,
        },
      },
      update: {
        email: encryptedEmail,
        name: encryptedName,
        lmsRole: data.lmsRole,
        syncedAt: new Date(),
      },
      create: {
        organizationId,
        lmsIntegrationId: integrationId,
        lmsUserId: data.lmsUserId,
        lmsPlatform: this.platform,
        email: encryptedEmail,
        name: encryptedName,
        lmsRole: data.lmsRole,
        syncedAt: new Date(),
      },
    });
  }
}

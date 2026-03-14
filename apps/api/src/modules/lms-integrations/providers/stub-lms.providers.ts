/**
 * Stub LMS providers for platforms not yet fully implemented.
 * Full implementations will be added in Phase 3.
 */
import { Injectable, Logger } from '@nestjs/common';
import { BaseLmsProvider } from './base-lms.provider';
import { LmsCapability, LmsSyncResult } from '../interfaces/lms-provider.interface';

abstract class StubLmsProvider extends BaseLmsProvider {
  async syncUsers(_integrationId: string): Promise<LmsSyncResult> {
    this.logger.warn(`${this.name} syncUsers not yet implemented`);
    return this.createSyncResult('users', 0, [`${this.name} sync not yet implemented`], new Date());
  }

  async syncCourses(_integrationId: string): Promise<LmsSyncResult> {
    this.logger.warn(`${this.name} syncCourses not yet implemented`);
    return this.createSyncResult('courses', 0, [`${this.name} sync not yet implemented`], new Date());
  }

  async syncAssignments(_integrationId: string, _courseId: string): Promise<LmsSyncResult> {
    this.logger.warn(`${this.name} syncAssignments not yet implemented`);
    return this.createSyncResult('assignments', 0, [`${this.name} sync not yet implemented`], new Date());
  }

  async getAssignmentContext(): Promise<null> {
    return null;
  }

  async resolveUserFromEmail(): Promise<null> {
    return null;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: `${this.name} integration not yet implemented` };
  }
}

@Injectable()
export class MoodleProvider extends StubLmsProvider {
  readonly name = 'Moodle';
  readonly platform = 'moodle';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync', 'assignment_sync'];
  readonly authMethod = 'api_key' as const;
  protected readonly logger = new Logger('Moodle');
}

@Injectable()
export class SchoologyProvider extends StubLmsProvider {
  readonly name = 'Schoology';
  readonly platform = 'schoology';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync', 'assignment_sync'];
  readonly authMethod = 'oauth2' as const;
  protected readonly logger = new Logger('Schoology');
}

@Injectable()
export class BlackboardProvider extends StubLmsProvider {
  readonly name = 'Blackboard Learn';
  readonly platform = 'blackboard';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync', 'assignment_sync', 'grade_sync'];
  readonly authMethod = 'oauth2' as const;
  protected readonly logger = new Logger('Blackboard');
}

@Injectable()
export class TalentLmsProvider extends StubLmsProvider {
  readonly name = 'TalentLMS';
  readonly platform = 'talentlms';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync'];
  readonly authMethod = 'api_key' as const;
  protected readonly logger = new Logger('TalentLMS');
}

@Injectable()
export class D2LBrightspaceProvider extends StubLmsProvider {
  readonly name = 'D2L Brightspace';
  readonly platform = 'd2l_brightspace';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync', 'assignment_sync', 'grade_sync'];
  readonly authMethod = 'oauth2' as const;
  protected readonly logger = new Logger('D2LBrightspace');
}

@Injectable()
export class CypherLearningProvider extends StubLmsProvider {
  readonly name = 'Cypher Learning';
  readonly platform = 'cypher_learning';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync', 'assignment_sync'];
  readonly authMethod = 'api_key' as const;
  protected readonly logger = new Logger('CypherLearning');
}

@Injectable()
export class AbsorbLmsProvider extends StubLmsProvider {
  readonly name = 'Absorb LMS';
  readonly platform = 'absorb_lms';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync'];
  readonly authMethod = 'api_key' as const;
  protected readonly logger = new Logger('AbsorbLMS');
}

@Injectable()
export class DiscoProvider extends StubLmsProvider {
  readonly name = 'Disco';
  readonly platform = 'disco';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync', 'assignment_sync'];
  readonly authMethod = 'api_key' as const;
  protected readonly logger = new Logger('Disco');
}

@Injectable()
export class LearnDashProvider extends StubLmsProvider {
  readonly name = 'LearnDash';
  readonly platform = 'learndash';
  readonly capabilities: LmsCapability[] = ['user_sync', 'course_sync', 'assignment_sync'];
  readonly authMethod = 'api_key' as const;
  protected readonly logger = new Logger('LearnDash');
}

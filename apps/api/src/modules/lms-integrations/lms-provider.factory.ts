import { Injectable, NotFoundException } from '@nestjs/common';
import { ILmsProvider } from './interfaces/lms-provider.interface';
import { GoogleClassroomProvider } from './providers/google-classroom.provider';
import { CanvasProvider } from './providers/canvas.provider';
import {
  MoodleProvider,
  SchoologyProvider,
  BlackboardProvider,
  TalentLmsProvider,
  D2LBrightspaceProvider,
  CypherLearningProvider,
  AbsorbLmsProvider,
  DiscoProvider,
  LearnDashProvider,
} from './providers/stub-lms.providers';

@Injectable()
export class LmsProviderFactory {
  private readonly providers: Map<string, ILmsProvider>;

  constructor(
    googleClassroom: GoogleClassroomProvider,
    canvas: CanvasProvider,
    moodle: MoodleProvider,
    schoology: SchoologyProvider,
    blackboard: BlackboardProvider,
    talentLms: TalentLmsProvider,
    d2lBrightspace: D2LBrightspaceProvider,
    cypherLearning: CypherLearningProvider,
    absorbLms: AbsorbLmsProvider,
    disco: DiscoProvider,
    learnDash: LearnDashProvider,
  ) {
    this.providers = new Map<string, ILmsProvider>([
      ['google_classroom', googleClassroom],
      ['canvas', canvas],
      ['moodle', moodle],
      ['schoology', schoology],
      ['blackboard', blackboard],
      ['talentlms', talentLms],
      ['d2l_brightspace', d2lBrightspace],
      ['cypher_learning', cypherLearning],
      ['absorb_lms', absorbLms],
      ['disco', disco],
      ['learndash', learnDash],
    ]);
  }

  getProvider(platform: string): ILmsProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new NotFoundException(`LMS provider not found: ${platform}`);
    }
    return provider;
  }

  getSupportedPlatforms(): string[] {
    return Array.from(this.providers.keys());
  }

  getAllProviders(): ILmsProvider[] {
    return Array.from(this.providers.values());
  }
}

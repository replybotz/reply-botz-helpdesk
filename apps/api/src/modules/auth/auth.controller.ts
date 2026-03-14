import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService, RegisterOrganizationDto, LoginDto } from './auth.service';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../infrastructure/decorators/current-user.decorator';
import { Public } from '../../infrastructure/decorators/public.decorator';
import { PrismaService } from '../../shared/database/prisma.service';
import { EncryptionService } from '../ferpa-compliance/encryption.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new organization and admin user' })
  async register(@Body() dto: RegisterOrganizationDto) {
    return this.authService.registerOrganization(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(
      dto,
      req.ip,
      req.get('user-agent'),
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Body() body: { refreshToken: string },
    @Req() req: Request,
  ) {
    return this.authService.refreshTokens(
      body.refreshToken,
      req.ip,
      req.get('user-agent'),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(@Body() body: { refreshToken: string }) {
    await this.authService.revokeRefreshToken(body.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getUserById(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mfa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup MFA — get QR code' })
  async setupMfa(@CurrentUser() user: CurrentUserPayload) {
    const dbUser = await this.authService.getUserById(user.sub);
    return this.mfaService.generateSecret(dbUser.email);
  }

  @UseGuards(JwtAuthGuard)
  @Put('mfa/enable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable MFA after verifying TOTP code' })
  async enableMfa(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { secret: string; token: string },
  ) {
    const valid = this.mfaService.verifyToken(body.secret, body.token);
    if (!valid) {
      return { success: false, message: 'Invalid MFA token' };
    }

    await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        mfaEnabled: true,
        mfaSecret: this.encryption.encrypt(body.secret),
      },
    });

    const backupCodes = this.mfaService.generateBackupCodes();
    return { success: true, backupCodes };
  }

  @UseGuards(JwtAuthGuard)
  @Put('mfa/disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA' })
  async disableMfa(@CurrentUser() user: CurrentUserPayload) {
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { success: true };
  }
}

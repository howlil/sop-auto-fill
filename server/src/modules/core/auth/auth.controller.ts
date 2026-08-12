import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard, type ApiSuccessResponse } from '../../../common';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  buildAccessTokenCookieOptions,
  buildClearAccessTokenCookieOptions,
  type JwtAccessPayload,
  type PublicUser,
} from './helpers/auth.shared';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login dengan Google Identity Services' })
  @ApiResponse({ status: 200, description: 'Login berhasil' })
  @ApiResponse({ status: 401, description: 'Google credential tidak valid' })
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<PublicUser>> {
    const result = await this.authService.loginWithGoogle(dto.credential);
    const isProduction = this.configService.get<string>('NODE_ENV', 'development') === 'production';
    res.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      result.accessToken,
      buildAccessTokenCookieOptions(result.cookieMaxAgeMs, isProduction),
    );
    return {
      success: true,
      message: 'Login berhasil',
      data: result.user,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  async me(
    @Req() req: Request & { user: JwtAccessPayload },
  ): Promise<ApiSuccessResponse<PublicUser>> {
    return {
      success: true,
      message: 'Data user berhasil diambil',
      data: await this.authService.getMe(req.user.sub),
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<{ success: true }>> {
    const isProduction = this.configService.get<string>('NODE_ENV', 'development') === 'production';
    res.clearCookie(
      ACCESS_TOKEN_COOKIE_NAME,
      buildClearAccessTokenCookieOptions(isProduction),
    );
    return {
      success: true,
      message: 'Logout berhasil',
      data: { success: true },
    };
  }
}

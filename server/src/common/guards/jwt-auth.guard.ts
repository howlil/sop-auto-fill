import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guard autentikasi JWT (cookie akses + strategi `jwt`). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

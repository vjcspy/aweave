import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Redirects root URL to the debate SPA.
 * User visits http://localhost:3456/ → redirects to /debate
 */
@Controller()
export class RootRedirectController {
  @Get('/')
  redirectToDebate(@Res() res: Response) {
    return res.redirect('/debate');
  }
}

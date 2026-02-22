import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { dirname, join } from 'path';

/**
 * Handles fallback routes for the Dashboard SPA.
 * Any non-API request under /dashboard/* that doesn't match a file
 * will return index.html for client-side routing.
 */
@Controller('dashboard')
export class DashboardSpaController {
  @Get('*')
  @ApiExcludeEndpoint()
  serveSpa(@Res() res: Response) {
    let rootPath: string;
    try {
      const pkgPath = require.resolve('@hod/aweave-dashboard-web/package.json');
      rootPath = join(dirname(pkgPath), 'dist');
    } catch {
      rootPath = join(process.cwd(), '..', '..', 'public', 'dashboard');
    }

    res.sendFile(join(rootPath, 'index.html'));
  }
}

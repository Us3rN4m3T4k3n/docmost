import { Controller, Get, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { join } from 'path';
import * as fs from 'node:fs';
import { EnvironmentService } from '../environment/environment.service';

@Controller()
export class StaticController {
  private readonly clientDistPath: string;
  private readonly indexFilePath: string;

  constructor(private readonly environmentService: EnvironmentService) {
    this.clientDistPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'client',
      'dist',
    );
    this.indexFilePath = join(this.clientDistPath, 'index.html');
  }

  @Get()
  serveRoot(@Res() reply: FastifyReply) {
    return this.serveIndexHtml(reply);
  }

  // Catch-all for SPA routes using parameter pattern
  // This will match any path like /setup/register, /home, etc.
  @Get(':path*')
  serveSpaRoute(@Res() reply: FastifyReply) {
    // Skip API routes, socket.io, collab, and share routes
    const url = reply.request.url;
    if (
      url.startsWith('/api') ||
      url.startsWith('/socket.io') ||
      url.startsWith('/collab') ||
      url === '/robots.txt' ||
      url.startsWith('/share/')
    ) {
      reply.code(404);
      return { message: `Cannot GET ${url}`, error: 'Not Found', statusCode: 404 };
    }
    return this.serveIndexHtml(reply);
  }

  private serveIndexHtml(reply: FastifyReply) {
    if (!fs.existsSync(this.indexFilePath)) {
      reply.code(404);
      return { message: 'Frontend not found', error: 'Not Found', statusCode: 404 };
    }

    // Read and transform the HTML
    const indexTemplateFilePath = join(this.clientDistPath, 'index-template.html');
    const windowVar = '<!--window-config-->';

    const configString = {
      ENV: this.environmentService.getNodeEnv(),
      APP_URL: this.environmentService.getAppUrl(),
      CLOUD: this.environmentService.isCloud(),
      FILE_UPLOAD_SIZE_LIMIT: this.environmentService.getFileUploadSizeLimit(),
      FILE_IMPORT_SIZE_LIMIT: this.environmentService.getFileImportSizeLimit(),
      DRAWIO_URL: this.environmentService.getDrawioUrl(),
      SUBDOMAIN_HOST: this.environmentService.isCloud()
        ? this.environmentService.getSubdomainHost()
        : undefined,
      COLLAB_URL: this.environmentService.getCollabUrl(),
      BILLING_TRIAL_DAYS: this.environmentService.isCloud()
        ? this.environmentService.getBillingTrialDays()
        : undefined,
      POSTHOG_HOST: this.environmentService.getPostHogHost(),
      POSTHOG_KEY: this.environmentService.getPostHogKey(),
    };

    const windowScriptContent = `<script>window.CONFIG=${JSON.stringify(configString)};</script>`;

    if (!fs.existsSync(indexTemplateFilePath)) {
      fs.copyFileSync(this.indexFilePath, indexTemplateFilePath);
    }

    const html = fs.readFileSync(indexTemplateFilePath, 'utf8');
    const transformedHtml = html.replace(windowVar, windowScriptContent);

    reply.type('text/html');
    return transformedHtml;
  }
}


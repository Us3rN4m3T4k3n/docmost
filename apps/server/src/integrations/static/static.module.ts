import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { join } from 'path';
import * as fs from 'node:fs';
import fastifyStatic from '@fastify/static';
import { EnvironmentService } from '../environment/environment.service';

@Module({})
export class StaticModule implements OnApplicationBootstrap {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly environmentService: EnvironmentService,
  ) {}

  public async onApplicationBootstrap() {
    console.log('StaticModule: Starting static file setup...');
    
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();

    const clientDistPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'client',
      'dist',
    );

    const indexFilePath = join(clientDistPath, 'index.html');

    console.log('StaticModule: Checking for frontend files...');
    console.log('StaticModule: clientDistPath:', clientDistPath);
    console.log('StaticModule: indexFilePath:', indexFilePath);
    console.log('StaticModule: clientDistPath exists:', fs.existsSync(clientDistPath));
    console.log('StaticModule: indexFilePath exists:', fs.existsSync(indexFilePath));
    
    if (fs.existsSync(clientDistPath) && fs.existsSync(indexFilePath)) {
      console.log('StaticModule: Frontend files found, setting up static serving...');
      const indexTemplateFilePath = join(clientDistPath, 'index-template.html');
      const windowVar = '<!--window-config-->';

      const configString = {
        ENV: this.environmentService.getNodeEnv(),
        APP_URL: this.environmentService.getAppUrl(),
        CLOUD: this.environmentService.isCloud(),
        FILE_UPLOAD_SIZE_LIMIT:
          this.environmentService.getFileUploadSizeLimit(),
        FILE_IMPORT_SIZE_LIMIT:
          this.environmentService.getFileImportSizeLimit(),
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
        fs.copyFileSync(indexFilePath, indexTemplateFilePath);
      }

      const html = fs.readFileSync(indexTemplateFilePath, 'utf8');
      const transformedHtml = html.replace(windowVar, windowScriptContent);

      fs.writeFileSync(indexFilePath, transformedHtml);

      // Register static files with wildcard disabled
      // We'll handle SPA routing manually to avoid conflicts with NestJS routes
      await app.register(fastifyStatic, {
        root: clientDistPath,
        wildcard: false,
        prefix: '/',
      });

      console.log('StaticModule: Static file serving registered');

      // Register explicit routes for root and common SPA paths first
      const serveIndexHtml = async (request: any, reply: any) => {
        console.log('StaticModule: Serving index.html for route:', request.url);
        reply.type('text/html');
        return fs.readFileSync(indexFilePath, 'utf8');
      };

      // Register root route
      app.get('/', serveIndexHtml);

      // Register catch-all route for SPA routing (must be last)
      // Fastify matches routes in order, so this will only catch unmatched routes
      app.get('*', async (request: any, reply: any) => {
        // Skip API routes, socket.io, collab, and share routes
        // These should have been matched by NestJS routes already
        if (
          request.url.startsWith('/api') ||
          request.url.startsWith('/socket.io') ||
          request.url.startsWith('/collab') ||
          request.url === '/robots.txt' ||
          request.url.startsWith('/share/')
        ) {
          // Let NestJS handle these (they should have been matched already)
          console.log('StaticModule: Skipping route (API/collab/share):', request.url);
          return reply.callNotFound();
        }

        // Check if the requested path exists as a static file
        const requestedPath = join(clientDistPath, request.url.split('?')[0]);
        const fileExists = fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile();
        
        // If file exists, let Fastify static serve it
        if (fileExists) {
          console.log('StaticModule: Serving static file:', request.url);
          return reply.sendFile(request.url.split('?')[0]);
        }
        
        // Otherwise, serve index.html for SPA routing
        return serveIndexHtml(request, reply);
      });
      
      console.log('StaticModule: SPA routes registered (root and catch-all)');

      console.log('StaticModule: Static serving setup complete');
    } else {
      console.error('StaticModule: Frontend files not found!');
      console.error('StaticModule: Expected clientDistPath:', clientDistPath);
      console.error('StaticModule: Expected indexFilePath:', indexFilePath);
      
      // List what's actually in the directory
      try {
        const parentDir = join(clientDistPath, '..');
        console.error('StaticModule: Parent directory contents:', fs.readdirSync(parentDir));
      } catch (err) {
        console.error('StaticModule: Cannot read parent directory:', err);
      }
    }
  }
}

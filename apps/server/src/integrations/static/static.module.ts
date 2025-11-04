import { Module, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { join } from 'path';
import * as fs from 'node:fs';
import fastifyStatic from '@fastify/static';
import { EnvironmentService } from '../environment/environment.service';

@Module({})
export class StaticModule implements OnModuleInit {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly environmentService: EnvironmentService,
  ) {}

  public async onModuleInit() {
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

      // Use setNotFoundHandler to serve index.html for SPA routes
      // This catches 404s from NestJS and serves the frontend
      // We need to wait for NestJS to finish initialization, so we use a small delay
      setImmediate(() => {
        try {
          app.setNotFoundHandler(async (request: any, reply: any) => {
            // Skip API routes, socket.io, collab, and share routes
            if (
              request.url.startsWith('/api') ||
              request.url.startsWith('/socket.io') ||
              request.url.startsWith('/collab') ||
              request.url === '/robots.txt' ||
              request.url.startsWith('/share/')
            ) {
              reply.code(404);
              return { message: `Cannot ${request.method} ${request.url}`, error: 'Not Found', statusCode: 404 };
            }

            // Check if the requested path exists as a static file
            const requestedPath = join(clientDistPath, request.url.split('?')[0]);
            const fileExists = fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile();
            
            // If file exists, let Fastify static serve it (shouldn't happen, but safety check)
            if (fileExists) {
              return reply.sendFile(request.url.split('?')[0]);
            }
            
            // Otherwise, serve index.html for SPA routing
            console.log('StaticModule: Serving index.html for SPA route:', request.url);
            reply.type('text/html');
            return fs.readFileSync(indexFilePath, 'utf8');
          });
          console.log('StaticModule: SPA not-found handler registered');
        } catch (error) {
          console.error('StaticModule: Failed to set not-found handler:', error);
          console.error('StaticModule: Error details:', error instanceof Error ? error.message : String(error));
        }
      });

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

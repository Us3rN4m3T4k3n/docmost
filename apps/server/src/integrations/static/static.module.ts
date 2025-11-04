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

      await app.register(fastifyStatic, {
        root: clientDistPath,
        wildcard: false,
        prefix: '/',
      });

      console.log('StaticModule: Static file serving registered');

      // Set up catch-all route for SPA routing (non-API routes)
      // This must be registered after fastifyStatic to avoid conflicts
      app.setNotFoundHandler((req: any, res: any) => {
        // Skip API routes and other excluded paths
        if (
          req.url.startsWith('/api') ||
          req.url.startsWith('/socket.io') ||
          req.url.startsWith('/collab') ||
          req.url === '/robots.txt'
        ) {
          res.code(404).send({ message: 'Not found' });
          return;
        }

        // Serve index.html for all other routes (SPA routing)
        console.log('StaticModule: Serving index.html for SPA route:', req.url);
        const stream = fs.createReadStream(indexFilePath);
        res.type('text/html').send(stream);
      });

      console.log('StaticModule: SPA catch-all handler registered');
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

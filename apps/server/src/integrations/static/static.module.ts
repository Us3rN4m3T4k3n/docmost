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

      const RENDER_PATH = '*';

      await app.register(fastifyStatic, {
        root: clientDistPath,
        wildcard: true,
      });

      console.log('StaticModule: Static file serving registered');
      console.log('StaticModule: Setting up catch-all route for:', RENDER_PATH);

      app.get(RENDER_PATH, (req: any, res: any) => {
        console.log('StaticModule: Serving index.html for route:', req.url);
        const stream = fs.createReadStream(indexFilePath);
        res.type('text/html').send(stream);
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

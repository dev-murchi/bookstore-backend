import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailConfigError } from '../../common/errors/mail-config.error';
import { MailTemplateError } from '../../common/errors/mail-template.error';
import {
  EmailTemplateKey,
  EmailTemplates,
} from '../../common/types/email-config.type';

import * as fs from 'fs';
import * as path from 'path';

export type MailTemplateContent = {
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class MailTemplateService {
  private readonly templates = new Map<EmailTemplateKey, MailTemplateContent>();
  private readonly emailTemplates: EmailTemplates;

  constructor(private readonly configService: ConfigService) {
    this.emailTemplates = this.getConfig<EmailTemplates>('email.templates');
    this.initializeTemplates();
  }
  private getConfig<T>(key: string): T {
    const value = this.configService.get<T>(key);
    if (!value) throw new MailConfigError(`Missing config value: ${key}`);
    return value;
  }

  private initializeTemplates() {
    try {
      for (const [key, { subject, fileName }] of Object.entries(
        this.emailTemplates,
      )) {
        this.templates.set(
          key as EmailTemplateKey,
          this.loadTemplate(subject, fileName),
        );
      }
    } catch (error) {
      console.error('Failed to load email templates:', error);
      throw new MailTemplateError('Failed to load email templates');
    }
  }

  private readTemplateFile(fileName: string): string {
    const filePath = path.join(
      __dirname,
      '../../assets/mail-templates',
      fileName,
    );
    try {
      return fs.readFileSync(filePath, 'utf-8').trim();
    } catch (error) {
      throw new MailTemplateError(`Failed to read template: ${fileName}`);
    }
  }

  private loadTemplate(subject: string, fileName: string): MailTemplateContent {
    return {
      subject,
      text: this.readTemplateFile(`text/${fileName}.text`),
      html: this.readTemplateFile(`html/${fileName}.html`),
    };
  }

  getTemplate(templateKey: EmailTemplateKey): MailTemplateContent {
    const template = this.templates.get(templateKey);
    if (!template) return null;
    return template;
  }

  fillMailTemplateContent(
    templateContent: string,
    templateFields: Map<string, string>,
  ): string {
    return templateContent.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const placeholder = `{{${key}}}`;
      return templateFields.has(placeholder)
        ? templateFields.get(placeholder)!
        : match;
    });
  }
}

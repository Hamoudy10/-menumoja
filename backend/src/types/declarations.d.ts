import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        restaurantId?: string;
        staffId?: string;
        type?: string;
      };
      restaurantId?: string;
      requestId?: string;
      /**
       * `params` and `query` are replaced at runtime by the validateParams /
       * validateQuery middleware with the zod-parsed scalar shape, so the
       * Express `string | string[]` typing does not apply to this app.
       */
      params: Record<string, string>;
      query: Record<string, string | undefined>;
    }
  }
}

declare module 'bullmq' {
  import { Redis } from 'ioredis';
  export class Queue {
    constructor(name: string, opts?: { connection?: any; defaultJobOptions?: any });
    add(name: string, data: any, opts?: any): Promise<any>;
    getJob(name: string): Promise<any | null>;
    getJobs(types?: string[]): Promise<any[]>;
    getActiveCount(): Promise<number>;
    getWaitingCount(): Promise<number>;
    close(): Promise<void>;
  }
  export class Worker {
    constructor(name: string, processor: (job: any) => Promise<void>, opts?: { connection?: any; concurrency?: number });
    on(event: string, handler: (...args: any[]) => void): void;
    close(): Promise<void>;
  }
  export class QueueScheduler {
    constructor(name: string, opts?: { connection?: any });
    close(): Promise<void>;
  }
  export type ConnectionOptions = { connection?: { host?: string; port?: number; url?: string } };
  export type WorkerOptions = { connection?: any; concurrency?: number };
  export type JobsOptions = { delay?: number; attempts?: number; backoff?: { type: string; delay: number }; removeOnComplete?: boolean; removeOnFail?: boolean };
  export type RepeatOptions = { pattern?: string; every?: number; limit?: number; key?: string };
}

declare module '@sentry/node' {
  export function init(options: { dsn?: string; environment?: string; tracesSampleRate?: number } & Record<string, any>): void;
  export function captureException(error: any): void;
  export function captureMessage(message: string): void;
  export namespace Handlers {
    export function requestHandler(): any;
    export function errorHandler(): any;
  }
}

declare module 'pdfkit' {
  class PDFDocument {
    constructor(options?: any);
    pipe(dest: any): any;
    fontSize(size: number): this;
    font(font: string): this;
    text(text: string, x?: number, y?: number, options?: any): this;
    image(path: string, x: number, y: number, options?: any): this;
    rect(x: number, y: number, w: number, h: number): this;
    fill(color: string): this;
    fillAndStroke(color: string, stroke: string): this;
    moveDown(lines?: number): this;
    end(): void;
    on(event: string, handler: (...args: any[]) => void): this;
  }
  export default PDFDocument;
}

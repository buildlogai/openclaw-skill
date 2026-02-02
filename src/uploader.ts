import type { BuildlogFile } from './types.js';

export interface UploadConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface UploadOptions {
  isPublic?: boolean;
  allowComments?: boolean;
  allowForks?: boolean;
  expiresIn?: number; // days
}

export interface UploadResult {
  success: boolean;
  id?: string;
  url?: string;
  shortUrl?: string;
  embedUrl?: string;
  error?: string;
  errorCode?: string;
}

export interface BuildlogInfo {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  views: number;
  isPublic: boolean;
}

const DEFAULT_BASE_URL = 'https://api.buildlog.ai';
const DEFAULT_TIMEOUT = 30000;

/**
 * BuildlogUploader - Upload buildlogs to buildlog.ai
 */
export class BuildlogUploader {
  private config: Required<UploadConfig>;

  constructor(config: UploadConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? '',
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    };
  }

  /**
   * Set API key (can be updated after construction)
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  /**
   * Upload a buildlog
   */
  async upload(buildlog: BuildlogFile, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      const response = await this.request<UploadResult>('/v1/buildlogs', {
        method: 'POST',
        body: JSON.stringify({
          buildlog,
          options: {
            isPublic: options.isPublic ?? true,
            allowComments: options.allowComments ?? true,
            allowForks: options.allowForks ?? true,
            expiresIn: options.expiresIn,
          },
        }),
      });

      return {
        success: true,
        id: response.id,
        url: response.url ?? `https://buildlog.ai/b/${response.id}`,
        shortUrl: response.shortUrl ?? `https://bldlg.ai/${response.id}`,
        embedUrl: response.embedUrl ?? `https://buildlog.ai/embed/${response.id}`,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Update an existing buildlog
   */
  async update(id: string, buildlog: Partial<BuildlogFile>): Promise<UploadResult> {
    try {
      const response = await this.request<UploadResult>(`/v1/buildlogs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ buildlog }),
      });

      return {
        success: true,
        id: response.id,
        url: response.url,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Delete a buildlog
   */
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request(`/v1/buildlogs/${id}`, {
        method: 'DELETE',
      });

      return { success: true };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get buildlog info
   */
  async getInfo(id: string): Promise<BuildlogInfo | null> {
    try {
      return await this.request<BuildlogInfo>(`/v1/buildlogs/${id}`, {
        method: 'GET',
      });
    } catch {
      return null;
    }
  }

  /**
   * List user's buildlogs
   */
  async list(options: {
    limit?: number;
    offset?: number;
    sort?: 'created' | 'views' | 'title';
  } = {}): Promise<{ buildlogs: BuildlogInfo[]; total: number }> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.sort) params.set('sort', options.sort);

    try {
      return await this.request<{ buildlogs: BuildlogInfo[]; total: number }>(
        `/v1/buildlogs?${params.toString()}`,
        { method: 'GET' }
      );
    } catch {
      return { buildlogs: [], total: 0 };
    }
  }

  /**
   * Generate a shareable link (for anonymous uploads)
   */
  async createShareLink(buildlog: BuildlogFile): Promise<UploadResult> {
    return this.upload(buildlog, {
      isPublic: true,
      allowComments: false,
      allowForks: true,
    });
  }

  /**
   * Validate API key
   */
  async validateApiKey(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }

    try {
      await this.request('/v1/auth/validate', { method: 'GET' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if connected to buildlog.ai
   */
  async ping(): Promise<boolean> {
    try {
      await this.request('/v1/health', { method: 'GET' });
      return true;
    } catch {
      return false;
    }
  }

  // Private methods

  private async request<T>(
    path: string,
    options: RequestInit
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'buildlog-openclaw-skill/2.0.0',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        throw new UploadError(
          errorData.message || `HTTP ${response.status}`,
          response.status.toString(),
          response.status
        );
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof UploadError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new UploadError('Request timeout', 'TIMEOUT', 408);
        }
        throw new UploadError(error.message, 'NETWORK_ERROR', 0);
      }

      throw new UploadError('Unknown error', 'UNKNOWN', 0);
    }
  }

  private handleError(error: unknown): UploadResult {
    if (error instanceof UploadError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'UNKNOWN',
    };
  }
}

/**
 * Custom error class for upload errors
 */
export class UploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * Convenience function to upload a buildlog
 */
export async function uploadBuildlog(
  buildlog: BuildlogFile,
  config: UploadConfig = {},
  options: UploadOptions = {}
): Promise<UploadResult> {
  const uploader = new BuildlogUploader(config);
  return uploader.upload(buildlog, options);
}

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
    expiresIn?: number;
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
/**
 * BuildlogUploader - Upload buildlogs to buildlog.ai
 */
export declare class BuildlogUploader {
    private config;
    constructor(config?: UploadConfig);
    /**
     * Set API key (can be updated after construction)
     */
    setApiKey(apiKey: string): void;
    /**
     * Upload a buildlog
     */
    upload(buildlog: BuildlogFile, options?: UploadOptions): Promise<UploadResult>;
    /**
     * Update an existing buildlog
     */
    update(id: string, buildlog: Partial<BuildlogFile>): Promise<UploadResult>;
    /**
     * Delete a buildlog
     */
    delete(id: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get buildlog info
     */
    getInfo(id: string): Promise<BuildlogInfo | null>;
    /**
     * List user's buildlogs
     */
    list(options?: {
        limit?: number;
        offset?: number;
        sort?: 'created' | 'views' | 'title';
    }): Promise<{
        buildlogs: BuildlogInfo[];
        total: number;
    }>;
    /**
     * Generate a shareable link (for anonymous uploads)
     */
    createShareLink(buildlog: BuildlogFile): Promise<UploadResult>;
    /**
     * Validate API key
     */
    validateApiKey(): Promise<boolean>;
    /**
     * Check if connected to buildlog.ai
     */
    ping(): Promise<boolean>;
    private request;
    private handleError;
}
/**
 * Custom error class for upload errors
 */
export declare class UploadError extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status: number);
}
/**
 * Convenience function to upload a buildlog
 */
export declare function uploadBuildlog(buildlog: BuildlogFile, config?: UploadConfig, options?: UploadOptions): Promise<UploadResult>;
//# sourceMappingURL=uploader.d.ts.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadError = exports.BuildlogUploader = void 0;
exports.uploadBuildlog = uploadBuildlog;
const DEFAULT_BASE_URL = 'https://api.buildlog.ai';
const DEFAULT_TIMEOUT = 30000;
/**
 * BuildlogUploader - Upload buildlogs to buildlog.ai
 */
class BuildlogUploader {
    config;
    constructor(config = {}) {
        this.config = {
            apiKey: config.apiKey ?? '',
            baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
            timeout: config.timeout ?? DEFAULT_TIMEOUT,
        };
    }
    /**
     * Set API key (can be updated after construction)
     */
    setApiKey(apiKey) {
        this.config.apiKey = apiKey;
    }
    /**
     * Upload a buildlog
     */
    async upload(buildlog, options = {}) {
        try {
            const response = await this.request('/v1/buildlogs', {
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
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    /**
     * Update an existing buildlog
     */
    async update(id, buildlog) {
        try {
            const response = await this.request(`/v1/buildlogs/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ buildlog }),
            });
            return {
                success: true,
                id: response.id,
                url: response.url,
            };
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    /**
     * Delete a buildlog
     */
    async delete(id) {
        try {
            await this.request(`/v1/buildlogs/${id}`, {
                method: 'DELETE',
            });
            return { success: true };
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    /**
     * Get buildlog info
     */
    async getInfo(id) {
        try {
            return await this.request(`/v1/buildlogs/${id}`, {
                method: 'GET',
            });
        }
        catch {
            return null;
        }
    }
    /**
     * List user's buildlogs
     */
    async list(options = {}) {
        const params = new URLSearchParams();
        if (options.limit)
            params.set('limit', options.limit.toString());
        if (options.offset)
            params.set('offset', options.offset.toString());
        if (options.sort)
            params.set('sort', options.sort);
        try {
            return await this.request(`/v1/buildlogs?${params.toString()}`, { method: 'GET' });
        }
        catch {
            return { buildlogs: [], total: 0 };
        }
    }
    /**
     * Generate a shareable link (for anonymous uploads)
     */
    async createShareLink(buildlog) {
        return this.upload(buildlog, {
            isPublic: true,
            allowComments: false,
            allowForks: true,
        });
    }
    /**
     * Validate API key
     */
    async validateApiKey() {
        if (!this.config.apiKey) {
            return false;
        }
        try {
            await this.request('/v1/auth/validate', { method: 'GET' });
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Check if connected to buildlog.ai
     */
    async ping() {
        try {
            await this.request('/v1/health', { method: 'GET' });
            return true;
        }
        catch {
            return false;
        }
    }
    // Private methods
    async request(path, options) {
        const url = `${this.config.baseUrl}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'buildlog-openclaw-skill/1.0.0',
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
                const errorData = await response.json().catch(() => ({}));
                throw new UploadError(errorData.message || `HTTP ${response.status}`, response.status.toString(), response.status);
            }
            // Handle empty responses
            const text = await response.text();
            if (!text) {
                return {};
            }
            return JSON.parse(text);
        }
        catch (error) {
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
    handleError(error) {
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
exports.BuildlogUploader = BuildlogUploader;
/**
 * Custom error class for upload errors
 */
class UploadError extends Error {
    code;
    status;
    constructor(message, code, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'UploadError';
    }
}
exports.UploadError = UploadError;
/**
 * Convenience function to upload a buildlog
 */
async function uploadBuildlog(buildlog, config = {}, options = {}) {
    const uploader = new BuildlogUploader(config);
    return uploader.upload(buildlog, options);
}
//# sourceMappingURL=uploader.js.map